import { API_PATH } from '../types.js';
import type { ClientKind, Json, ListenerEntry, PanelState, ProfileOverrides, ProviderInfo, ProviderRule } from '../types.js';

export type ProfileInfo = PanelState['profiles'][number];
export type PublicPanelState = Omit<PanelState, 'config'> & {
  config: Pick<PanelState['config'], 'schemaVersion' | 'revision' | 'providers' | 'listener'>;
};
export interface RuleDraft {
  client: ClientKind;
  profile: string;
  restrictModels: boolean;
  modelIdsText: string;
  overridesText: string;
  instructionsText: string;
  concurrencyText: string;
  concurrencyMode: 'queue' | 'reject';
}
export interface ProviderDraft { form: RuleDraft; baseline: RuleDraft }
export interface EditorSession {
  snapshot: PublicPanelState | null;
  selectedProviderId: string;
  drafts: Record<string, ProviderDraft>;
  revisionStale: boolean;
}
export type PanelApiRequest =
  | { action: 'state' }
  | { action: 'save'; providerId: string; rule: ProviderRule; revision: number }
  | { action: 'listener'; enabled: boolean; revision: number }
  | { action: 'logs' }
  | { action: 'clear' };
export interface PanelApiReply { state?: PublicPanelState; entries?: ListenerEntry[] }
export interface PanelApi { call(request: PanelApiRequest, signal?: AbortSignal): Promise<PanelApiReply> }
export type FetchLike = (path: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export const EDITABLE_OVERRIDE_KEYS = [
  'version', 'runtimeVersion', 'sdkVersion', 'beta', 'identity', 'originator',
  'metadataFormat', 'extraHeaders',
] as const;
const TEXT_OVERRIDES = ['version', 'runtimeVersion', 'sdkVersion', 'identity', 'originator'] as const;
const HEADER_TEXT_OVERRIDES = ['version', 'runtimeVersion', 'sdkVersion', 'originator'] as const;
const PRIVATE_KEY = /authorization|cookie|apikey|token|password|secret|credential|accountid|deviceid|sessionid|requestid|userid/i;
// Match the host identity-header contract; request/session IDs are editable but still redacted in listener entries.
const CLIENT_IDENTITY_HEADER = /^(user-agent|originator|anthropic-(version|beta|client)|x-app|x-stainless-[a-z-]+|x-(claude-code-session-id|client-request-id|codex-[a-z-]+)|session_id|openai-client)$/i;
const PRIVATE_IDENTITY_HEADER = /(?:^|[-_])(auth(?:orization|entication)?|api[-_]?key|token|credential|secret|password|cookie|account(?:[-_]?id)?|device(?:[-_]?id)?)(?:$|[-_])/i;
const PRIVATE_CONTENT = /^(system|instructions|messages|input|output|prompt|content|text|arguments|tools|tool_?results?|tool_?calls?)$/i;
const MASK = '[REDACTED]';

export class DraftValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'DraftValidationError'; }
}
export class PanelRpcError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code = 'RPC_ERROR', status = 0) {
    super(redactText(message)); this.name = 'PanelRpcError'; this.code = code; this.status = status;
  }
}
export function isRevisionConflict(error: unknown): boolean {
  return error instanceof PanelRpcError && (error.status === 409 || /conflict|revision.*(stale|mismatch)|stale.*revision/i.test(error.code));
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function privateKey(key: string): boolean { return PRIVATE_KEY.test(key.replace(/[-_\s]/g, '')); }
function editableIdentityHeader(key: string): boolean {
  return CLIENT_IDENTITY_HEADER.test(key) && !PRIVATE_IDENTITY_HEADER.test(key);
}

/** Display projection only: credentials and persistent account/device identity never enter the editor. */
export function visibleOverrides(overrides: ProfileOverrides | undefined): ProfileOverrides {
  if (!overrides) return {};
  const result: ProfileOverrides = {};
  for (const key of TEXT_OVERRIDES) if (typeof overrides[key] === 'string') result[key] = overrides[key];
  if (Array.isArray(overrides.beta)) result.beta = overrides.beta.filter(value => typeof value === 'string');
  if (overrides.metadataFormat === 'legacy' || overrides.metadataFormat === 'json') result.metadataFormat = overrides.metadataFormat;
  if (typeof overrides.instructions === 'string') result.instructions = overrides.instructions;
  if (overrides.extraHeaders && isObject(overrides.extraHeaders)) {
    result.extraHeaders = Object.fromEntries(Object.entries(overrides.extraHeaders)
      .filter(([key, value]) => editableIdentityHeader(key) && typeof value === 'string' && value.length <= 4096 && !/[\r\n]/.test(value))
      .map(([key, value]) => [key, redactText(String(value))]));
    if (!Object.keys(result.extraHeaders).length) delete result.extraHeaders;
  }
  return result;
}
/** DSH 官方供应商（DeepSeek 官方 / 官方账号）不能也不需要伪装，面板里不列。 */
export const OFFICIAL_ADAPTER = /^llm-deepseek/;
export function configuredProviders(providers: ProviderInfo[]): ProviderInfo[] {
  return providers.filter(provider => provider.configured === true && !OFFICIAL_ADAPTER.test(provider.adapter))
    .slice().sort((a, b) => a.label.localeCompare(b.label, 'zh-CN') || a.id.localeCompare(b.id));
}
export function profilesForClient(profiles: ProfileInfo[], client: ClientKind): ProfileInfo[] {
  return profiles.filter(profile => profile.client === client);
}
export function parseModelIds(text: string): string[] {
  return [...new Set(text.split(/[,\r\n]+/).map(value => value.trim()).filter(Boolean))];
}
export function ruleToDraft(rule: ProviderRule | undefined, profiles: ProfileInfo[]): RuleDraft {
  const client = rule?.client ?? 'none';
  const overrides = visibleOverrides(rule?.overrides);
  const instructionsText = overrides.instructions ?? '';
  delete overrides.instructions;
  return {
    client,
    profile: client === 'none' ? '' : rule?.profile ?? profilesForClient(profiles, client)[0]?.id ?? '',
    restrictModels: Boolean(rule?.modelIds?.length),
    modelIdsText: rule?.modelIds?.join('\n') ?? '',
    overridesText: JSON.stringify(overrides, null, 2),
    instructionsText,
    concurrencyText: rule?.concurrency ? String(rule.concurrency) : '',
    concurrencyMode: rule?.concurrencyMode === 'reject' ? 'reject' : 'queue',
  };
}
export function setDraftClient(draft: RuleDraft, client: ClientKind, profiles: ProfileInfo[]): RuleDraft {
  if (draft.client === client) return draft;
  return { ...draft, client, profile: client === 'none' ? '' : profilesForClient(profiles, client)[0]?.id ?? '' };
}
function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}
function draftKey(draft: RuleDraft): string {
  const concurrency = draft.concurrencyText.trim() || '0';
  if (draft.client === 'none') return JSON.stringify(['none', concurrency, draft.concurrencyMode]);
  let overrides: unknown;
  try { overrides = stableValue(JSON.parse(draft.overridesText || '{}')); }
  catch { overrides = ['invalid-json', draft.overridesText]; }
  return JSON.stringify([draft.client, draft.profile.trim(), draft.restrictModels,
    draft.restrictModels ? parseModelIds(draft.modelIdsText).sort() : [], overrides, draft.instructionsText, concurrency, draft.concurrencyMode]);
}
export function isDraftDirty(draft: ProviderDraft): boolean { return draftKey(draft.form) !== draftKey(draft.baseline); }

export function parseOverrides(text: string, instructions: string): ProfileOverrides | undefined {
  let input: unknown;
  try { input = JSON.parse(text.trim() || '{}'); }
  catch { throw new DraftValidationError('覆盖 JSON 格式有误，请检查引号与逗号。'); }
  if (!isObject(input)) throw new DraftValidationError('高级覆盖应为一个 JSON 对象。');
  const allowed = new Set<string>(EDITABLE_OVERRIDE_KEYS);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new DraftValidationError(key === 'instructions'
      ? 'instructions 请填写在完整指令模板文本框中。'
      : '高级覆盖仅支持列出的公开 profile 字段。');
  }
  const result: ProfileOverrides = {};
  for (const key of TEXT_OVERRIDES) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !value.trim()) throw new DraftValidationError(key + ' 应为非空字符串。');
    if (HEADER_TEXT_OVERRIDES.includes(key as typeof HEADER_TEXT_OVERRIDES[number]) && (/[\r\n]/.test(value) || value.length > 512)) {
      throw new DraftValidationError(key + ' 应为单行版本或客户端标识。');
    }
    result[key] = key === 'identity' ? value : value.trim();
  }
  if (input.beta !== undefined) {
    if (!Array.isArray(input.beta) || input.beta.length > 64 || input.beta.some(value => typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value))) {
      throw new DraftValidationError('beta 应为单行字符串数组。');
    }
    result.beta = [...new Set((input.beta as string[]).map(value => value.trim()))];
  }
  if (input.metadataFormat !== undefined) {
    if (input.metadataFormat !== 'legacy' && input.metadataFormat !== 'json') throw new DraftValidationError('metadataFormat 应为 legacy 或 json。');
    result.metadataFormat = input.metadataFormat;
  }
  if (input.extraHeaders !== undefined) {
    if (!isObject(input.extraHeaders) || Object.keys(input.extraHeaders).length > 64) throw new DraftValidationError('extraHeaders 应为最多 64 项的字符串键值对象。');
    const entries = Object.entries(input.extraHeaders);
    for (const [key, value] of entries) {
      if (!editableIdentityHeader(key) || typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value)) {
        throw new DraftValidationError('额外请求头仅支持列出的客户端身份字段；值应为最多 4096 字符的单行字符串。');
      }
    }
    result.extraHeaders = Object.fromEntries(entries) as Record<string, string>;
    if (!entries.length) delete result.extraHeaders;
  }
  if (instructions.trim()) {
    if (instructions.length > 250_000) throw new DraftValidationError('完整指令模板请控制在 250000 字符以内。');
    result.instructions = instructions;
  }
  return Object.keys(result).length ? result : undefined;
}
export function parseConcurrency(text: string): number {
  const value = text.trim();
  if (!value) return 0;
  if (!/^\d{1,2}$/.test(value)) throw new DraftValidationError('并发上限应为 0-64 的整数（0 表示不限制）。');
  const limit = Number(value);
  if (limit > 64) throw new DraftValidationError('并发上限应为 0-64 的整数（0 表示不限制）。');
  return limit;
}
export function draftToRule(draft: RuleDraft, profiles: ProfileInfo[]): ProviderRule {
  const concurrency = parseConcurrency(draft.concurrencyText);
  const concurrencyMode = draft.concurrencyMode === 'reject' ? 'reject' : 'queue';
  if (draft.client === 'none') return concurrency > 0 ? { client: 'none', concurrency, ...(concurrencyMode === 'reject' ? { concurrencyMode } : {}) } : { client: 'none' };
  if (!profilesForClient(profiles, draft.client).some(profile => profile.id === draft.profile)) {
    throw new DraftValidationError('请选择与目标客户端对应的可用 profile。');
  }
  const rule: ProviderRule = { client: draft.client, profile: draft.profile };
  if (concurrency > 0) { rule.concurrency = concurrency; if (concurrencyMode === 'reject') rule.concurrencyMode = concurrencyMode; }
  if (draft.restrictModels) {
    const models = parseModelIds(draft.modelIdsText);
    if (!models.length) throw new DraftValidationError('至少选择一个模型，或关闭模型限制。');
    if (models.length > 500 || models.some(model => model.length > 512)) throw new DraftValidationError('模型限制列表过长。');
    rule.modelIds = models;
  }
  const overrides = parseOverrides(draft.overridesText, draft.instructionsText);
  if (overrides) rule.overrides = overrides;
  return rule;
}
export function draftProblem(draft: RuleDraft | undefined, profiles: ProfileInfo[]): string {
  if (!draft) return '';
  try { draftToRule(draft, profiles); return ''; }
  catch (error) { return error instanceof DraftValidationError ? error.message : '请检查当前规则。'; }
}

export function emptyEditorSession(): EditorSession {
  return { snapshot: null, selectedProviderId: '', drafts: {}, revisionStale: false };
}
export function projectPanelState(state: PanelState | PublicPanelState): PublicPanelState {
  const rules = Object.fromEntries(Object.entries(state.config.providers).map(([id, rule]) => {
    const clean: ProviderRule = { client: rule.client };
    if (rule.profile !== undefined) clean.profile = rule.profile;
    if (rule.modelIds !== undefined) clean.modelIds = [...rule.modelIds];
    if (rule.concurrency !== undefined && rule.concurrency > 0) clean.concurrency = rule.concurrency;
    if (clean.concurrency && rule.concurrencyMode === 'reject') clean.concurrencyMode = 'reject';
    const overrides = visibleOverrides(rule.overrides);
    if (Object.keys(overrides).length) clean.overrides = overrides;
    return [id, clean];
  }));
  return {
    providers: state.providers.map(provider => ({ id: provider.id, label: provider.label, adapter: provider.adapter,
      modelIds: [...provider.modelIds], configured: provider.configured, ...(provider.protocol ? { protocol: provider.protocol } : {}) })),
    config: { schemaVersion: 1, revision: state.config.revision, providers: rules,
      listener: { enabled: state.config.listener.enabled, maxEntries: state.config.listener.maxEntries } },
    runtime: { transport: state.runtime.transport, registrations: state.runtime.registrations, detail: redactText(state.runtime.detail),
      ...(state.runtime.concurrency ? { concurrency: state.runtime.concurrency.map(item => ({ providerId: item.providerId, limit: item.limit, active: item.active, queued: item.queued })) } : {}),
      ...(state.runtime.cache ? { cache: state.runtime.cache.map(item => ({ providerId: item.providerId, requests: item.requests, promptTokens: item.promptTokens, cachedTokens: item.cachedTokens, hitRate: item.hitRate })) } : {}) },
    profiles: state.profiles.map(profile => ({ id: profile.id, client: profile.client, version: profile.version,
      label: profile.label, evidence: redactText(profile.evidence) })),
    entries: state.entries.map(redactListenerEntry),
  };
}
/** Refresh is a rebase, never a draft reset. A successful save resets only its own provider. */
export function reconcileState(previous: EditorSession, incoming: PanelState | PublicPanelState, savedProviderId?: string): EditorSession {
  const snapshot = projectPanelState(incoming);
  const providers = configuredProviders(snapshot.providers);
  const drafts = { ...previous.drafts };
  for (const provider of providers) {
    const baseline = ruleToDraft(snapshot.config.providers[provider.id], snapshot.profiles);
    const old = previous.drafts[provider.id];
    drafts[provider.id] = { baseline, form: provider.id !== savedProviderId && old && isDraftDirty(old) ? old.form : baseline };
  }
  const selectedStillConfigured = providers.some(provider => provider.id === previous.selectedProviderId);
  const selectedDraft = previous.drafts[previous.selectedProviderId];
  const keepRemovedDraft = selectedDraft && isDraftDirty(selectedDraft);
  // Fresh open (no prior selection) lands on the provider that is currently simulating a client,
  // so the panel always shows "what is being simulated right now" instead of the first provider.
  const simulatingId = providers.find(provider => {
    const rule = snapshot.config.providers[provider.id];
    return rule !== undefined && rule.client !== 'none';
  })?.id;
  const fallbackId = previous.selectedProviderId === ''
    ? simulatingId ?? providers[0]?.id ?? ''
    : providers[0]?.id ?? '';
  return { snapshot, drafts, revisionStale: false,
    selectedProviderId: selectedStillConfigured || keepRemovedDraft ? previous.selectedProviderId : fallbackId };
}

/** Providers that currently have a non-None rule, i.e. the clients being simulated right now. */
export function simulatingRules(snapshot: PublicPanelState, providers: ProviderInfo[]): { provider: ProviderInfo; rule: ProviderRule }[] {
  const result: { provider: ProviderInfo; rule: ProviderRule }[] = [];
  for (const provider of providers) {
    const rule = snapshot.config.providers[provider.id];
    if (rule && rule.client !== 'none') result.push({ provider, rule });
  }
  return result;
}
export function selectProvider(session: EditorSession, providerId: string): EditorSession {
  if (!session.snapshot || !configuredProviders(session.snapshot.providers).some(provider => provider.id === providerId)) return session;
  return { ...session, selectedProviderId: providerId };
}
export function updateDraft(session: EditorSession, providerId: string, patch: Partial<RuleDraft>): EditorSession {
  const draft = session.drafts[providerId];
  if (!draft) return session;
  return { ...session, drafts: { ...session.drafts, [providerId]: { ...draft, form: { ...draft.form, ...patch } } } };
}
export function restoreSelectedDraft(session: EditorSession): EditorSession {
  const draft = session.drafts[session.selectedProviderId];
  return draft ? { ...session, drafts: { ...session.drafts, [session.selectedProviderId]: { ...draft, form: draft.baseline } } } : session;
}
export function markRevisionConflict(session: EditorSession): EditorSession { return { ...session, revisionStale: true }; }
export function buildSaveRequest(session: EditorSession): Extract<PanelApiRequest, { action: 'save' }> {
  if (!session.snapshot) throw new DraftValidationError('请先读取供应商状态。');
  if (session.revisionStale) throw new DraftValidationError('请先刷新已保存状态；当前草稿会保留。');
  const providerId = session.selectedProviderId;
  if (!configuredProviders(session.snapshot.providers).some(provider => provider.id === providerId)) {
    throw new DraftValidationError('当前供应商已从 DSH 配置移除，草稿已保留。');
  }
  const draft = session.drafts[providerId];
  if (!draft) throw new DraftValidationError('请选择供应商。');
  return { action: 'save', providerId, rule: draftToRule(draft.form, session.snapshot.profiles), revision: session.snapshot.config.revision };
}

export function redactText(text: string): string {
  return text
    .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer ' + MASK)
    .replace(/\bsk-(?:proj-)?[a-z0-9_-]{6,}/gi, MASK)
    .replace(/((?:token|api[_-]?key|password|secret|account[_-]?id|device[_-]?id)=)[^&\s]+/gi, '$1' + MASK)
    .replace(/user_[a-f0-9]+_account_[a-z0-9-]+_session_[a-z0-9-]+/gi, MASK)
    .slice(0, 4000);
}
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin + parsed.pathname : '[endpoint hidden]';
  } catch { return '[endpoint hidden]'; }
}
export function redactValue(value: unknown, key = '', depth = 0, privateContent = false): Json {
  if (privateKey(key)) {
    const publicCount = /^(maxtokens|maxoutputtokens|maxcompletiontokens|inputtokens|outputtokens|totaltokens|reasoningtokens|budgettokens|cachecreationinputtokens|cachereadinputtokens)$/i;
    return typeof value === 'number' && Number.isFinite(value) && publicCount.test(key.replace(/[-_\s]/g, '')) ? value : MASK;
  }
  if (depth > 12) return '[nested content omitted]';
  const sensitive = privateContent || PRIVATE_CONTENT.test(key);
  if (typeof value === 'string') return sensitive ? '[REDACTED: ' + value.length + ' characters]' : redactText(value);
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map(item => redactValue(item, '', depth + 1, sensitive));
    if (value.length > 50) items.push('[' + (value.length - 50) + ' more items]');
    return items;
  }
  if (isObject(value)) return Object.fromEntries(Object.entries(value).slice(0, 100).map(([name, item]) => [name, redactValue(item, name, depth + 1, sensitive)]));
  return null;
}
export function redactListenerEntry(entry: ListenerEntry): ListenerEntry {
  return { id: entry.id, time: entry.time, providerId: entry.providerId, modelId: entry.modelId,
    client: entry.client, profile: entry.profile, url: redactUrl(entry.url), protocol: entry.protocol,
    targetProtocol: entry.targetProtocol, headers: redactValue(entry.headers) as Record<string, string>,
    body: redactValue(entry.body) as ListenerEntry['body'], ...(entry.status !== undefined ? { status: entry.status } : {}),
    ...(entry.error ? { error: redactText(entry.error) } : {}) };
}
const PROTOCOLS = ['anthropic-messages', 'openai-responses', 'openai-chat-completions'];
function stringList(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function validListenerEntry(value: unknown): value is ListenerEntry {
  if (!isObject(value)) return false;
  return ['id', 'time', 'providerId', 'modelId', 'profile', 'url'].every(key => typeof value[key] === 'string')
    && (value.client === 'claude-code' || value.client === 'codex')
    && PROTOCOLS.includes(String(value.protocol)) && PROTOCOLS.includes(String(value.targetProtocol))
    && isObject(value.headers) && Object.values(value.headers).every(header => typeof header === 'string')
    && isObject(value.body) && (value.status === undefined || typeof value.status === 'number')
    && (value.error === undefined || typeof value.error === 'string');
}
function validConcurrencyStats(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every(item => isObject(item)
    && typeof item.providerId === 'string'
    && Number.isSafeInteger(item.limit) && Number(item.limit) >= 0 && Number(item.limit) <= 64
    && Number.isSafeInteger(item.active) && Number.isSafeInteger(item.queued));
}
function validCacheStats(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every(item => isObject(item)
    && typeof item.providerId === 'string'
    && Number.isSafeInteger(item.requests) && Number(item.requests) >= 0
    && Number.isSafeInteger(item.promptTokens) && Number(item.promptTokens) >= 0
    && Number.isSafeInteger(item.cachedTokens) && Number(item.cachedTokens) >= 0
    && typeof item.hitRate === 'number' && Number.isFinite(item.hitRate) && item.hitRate >= 0 && item.hitRate <= 1);
}
function validPanelState(value: unknown): value is PanelState {
  if (!isObject(value) || !isObject(value.config) || !isObject(value.runtime)) return false;
  const config = value.config;
  if (config.schemaVersion !== 1 || !Number.isSafeInteger(config.revision) || Number(config.revision) < 0
    || !isObject(config.providers) || !isObject(config.listener) || typeof config.listener.enabled !== 'boolean'
    || !Number.isSafeInteger(config.listener.maxEntries) || Number(config.listener.maxEntries) < 0
    || !['active', 'waiting', 'unsupported'].includes(String(value.runtime.transport))
    || typeof value.runtime.detail !== 'string' || !Number.isSafeInteger(value.runtime.registrations)
    || !validConcurrencyStats(value.runtime.concurrency) || !validCacheStats(value.runtime.cache)) return false;
  return Object.values(config.providers).every(rule => isObject(rule) && ['none', 'claude-code', 'codex'].includes(String(rule.client))
    && (rule.profile === undefined || typeof rule.profile === 'string')
    && (rule.modelIds === undefined || stringList(rule.modelIds))
    && (rule.concurrency === undefined || (Number.isSafeInteger(rule.concurrency) && Number(rule.concurrency) >= 0 && Number(rule.concurrency) <= 64))
    && (rule.concurrencyMode === undefined || ['queue', 'reject'].includes(String(rule.concurrencyMode)))
    && (rule.overrides === undefined || isObject(rule.overrides)))
    && Array.isArray(value.providers) && value.providers.every(provider => isObject(provider)
      && ['id', 'label', 'adapter'].every(key => typeof provider[key] === 'string')
      && stringList(provider.modelIds) && typeof provider.configured === 'boolean'
      && (provider.protocol === undefined || PROTOCOLS.includes(String(provider.protocol))))
    && Array.isArray(value.profiles) && value.profiles.every(profile => isObject(profile)
      && ['id', 'label', 'version', 'evidence'].every(key => typeof profile[key] === 'string')
      && (profile.client === 'claude-code' || profile.client === 'codex'))
    && Array.isArray(value.entries) && value.entries.every(validListenerEntry);
}
export function createPanelApi(fetcher?: FetchLike): PanelApi {
  return { async call(request, signal) {
    const response = await (fetcher ?? ((path, options) => fetch(path, options)))(API_PATH, {
      method: 'POST', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), ...(signal ? { signal } : {}),
    });
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new PanelRpcError('服务返回了非 JSON 响应，请刷新后重试。', 'INVALID_RESPONSE', response.status); }
    if (!isObject(payload)) throw new PanelRpcError('服务响应格式有误。', 'INVALID_RESPONSE', response.status);
    if (payload.ok !== true) throw new PanelRpcError(typeof payload.error === 'string' ? payload.error : '请求未完成，请重试。',
      typeof payload.code === 'string' ? payload.code : 'RPC_ERROR', response.status);
    if (!response.ok) throw new PanelRpcError('请求返回 HTTP ' + response.status + '。', 'HTTP_ERROR', response.status);
    const reply: PanelApiReply = {};
    if (payload.state !== undefined) {
      if (!validPanelState(payload.state)) throw new PanelRpcError('服务状态格式有误。', 'INVALID_RESPONSE', response.status);
      reply.state = projectPanelState(payload.state);
    }
    if (payload.entries !== undefined) {
      if (!Array.isArray(payload.entries) || !payload.entries.every(validListenerEntry)) {
        throw new PanelRpcError('服务监听记录格式有误。', 'INVALID_RESPONSE', response.status);
      }
      reply.entries = payload.entries.map(redactListenerEntry);
    }
    if (request.action === 'state' || request.action === 'save' || request.action === 'listener') {
      if (!reply.state) throw new PanelRpcError('服务未返回最新配置状态。', 'INVALID_RESPONSE', response.status);
    } else if (request.action === 'logs' && !reply.state && !reply.entries) {
      throw new PanelRpcError('服务未返回监听记录。', 'INVALID_RESPONSE', response.status);
    } else if (request.action === 'clear' && !reply.state && !reply.entries) reply.entries = [];
    return reply;
  } };
}
