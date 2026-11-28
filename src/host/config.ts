import { randomBytes, randomUUID } from 'node:crypto';
import { listProfiles } from '../core/profiles.js';
import { SETTINGS_NS } from '../types.js';
import type { PluginConfig, ProfileOverrides, ProviderRule } from '../types.js';
import type { SettingsHost } from './contracts.js';

export class RpcError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); this.name = 'RpcError'; }
}
export function defaultConfig(): PluginConfig {
  return { schemaVersion: 1, revision: 0, providers: {}, listener: { enabled: false, maxEntries: 50 }, identity: { deviceId: randomBytes(32).toString('hex'), accountId: randomUUID() } };
}
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function text(v: unknown, max = 1024): v is string { return typeof v === 'string' && v.length <= max; }
const blocked = new Set(['__proto__', 'constructor', 'prototype']);
const identityHeader = /^(user-agent|originator|anthropic-(version|beta|client)|x-app|x-stainless-[a-z-]+|x-(claude-code-session-id|client-request-id|codex-[a-z-]+)|session_id|openai-client)$/i;
const privateHeader = /(?:^|[-_])(auth(?:orization|entication)?|api[-_]?key|token|credential|secret|password|cookie|account(?:[-_]?id)?|device(?:[-_]?id)?)(?:$|[-_])/i;
export function validateRule(value: unknown): ProviderRule {
  if (!object(value) || !['none', 'claude-code', 'codex'].includes(String(value.client))) throw new RpcError('INVALID_RULE', '请选择 None、Claude Code 或 Codex。');
  const rule: ProviderRule = { client: value.client as ProviderRule['client'] };
  if (value.profile !== undefined) {
    if (!text(value.profile, 120)) throw new RpcError('INVALID_PROFILE', '配置档案标识无效。');
    if (rule.client !== 'none' && !listProfiles().some(p => p.id === value.profile && p.client === rule.client)) throw new RpcError('INVALID_PROFILE', '档案与所选客户端不匹配。');
    rule.profile = value.profile;
  }
  if (value.modelIds !== undefined) {
    if (!Array.isArray(value.modelIds) || value.modelIds.length > 500 || value.modelIds.some(x => !text(x, 512) || !x.length)) throw new RpcError('INVALID_MODELS', '模型限制应为模型标识数组。');
    rule.modelIds = [...new Set(value.modelIds as string[])];
  }
  if (value.concurrency !== undefined) {
    const limit = Number(value.concurrency);
    if (!Number.isInteger(limit) || limit < 0 || limit > 64) throw new RpcError('INVALID_CONCURRENCY', '并发上限应为 0-64 的整数（0 表示不限制）。');
    if (limit > 0) rule.concurrency = limit;
  }
  if (value.concurrencyMode !== undefined) {
    if (!['queue', 'reject'].includes(String(value.concurrencyMode))) throw new RpcError('INVALID_CONCURRENCY_MODE', '并发超限处理应为 queue（排队）或 reject（直接拒绝）。');
    if ((rule.concurrency ?? 0) > 0) rule.concurrencyMode = value.concurrencyMode as 'queue' | 'reject';
  }
  if (value.baseUrl !== undefined) {
    if (!text(value.baseUrl, 4096)) throw new RpcError('INVALID_BASE_URL', '连接地址格式无效。');
    let u: URL; try { u = new URL(value.baseUrl); } catch { throw new RpcError('INVALID_BASE_URL', '连接地址格式无效。'); }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new RpcError('INVALID_BASE_URL', '连接地址应为 HTTP(S) URL。');
    rule.baseUrl = value.baseUrl;
  }
  if (value.overrides !== undefined) {
    if (!object(value.overrides)) throw new RpcError('INVALID_OVERRIDES', '高级覆盖应为 JSON 对象。');
    const overrides: ProfileOverrides = {};
    const stringKeys = ['version', 'runtimeVersion', 'sdkVersion', 'identity', 'instructions', 'originator', 'accountId', 'deviceId'] as const;
    for (const key of stringKeys) if (value.overrides[key] !== undefined) {
      if (!text(value.overrides[key], key === 'instructions' ? 250000 : 4096)) throw new RpcError('INVALID_OVERRIDES', '高级覆盖字段格式无效：' + key);
      overrides[key] = value.overrides[key] as string;
    }
    if (value.overrides.metadataFormat !== undefined) {
      if (!['legacy', 'json'].includes(String(value.overrides.metadataFormat))) throw new RpcError('INVALID_OVERRIDES', 'metadataFormat 应为 legacy 或 json。');
      overrides.metadataFormat = value.overrides.metadataFormat as 'legacy' | 'json';
    }
    if (value.overrides.beta !== undefined) {
      const beta = value.overrides.beta;
      if (!Array.isArray(beta) || beta.length > 64 || beta.some(x => !text(x, 200) || /[\r\n]/.test(x))) throw new RpcError('INVALID_OVERRIDES', 'beta 应为字符串数组。');
      overrides.beta = beta as string[];
    }
    if (value.overrides.extraHeaders !== undefined) {
      if (!object(value.overrides.extraHeaders) || Object.keys(value.overrides.extraHeaders).length > 64) throw new RpcError('INVALID_HEADERS', '客户端身份头格式无效。');
      const headers: Record<string, string> = {};
      for (const [name, val] of Object.entries(value.overrides.extraHeaders)) {
        if (!identityHeader.test(name) || privateHeader.test(name) || !text(val, 4096) || /[\r\n]/.test(val)) throw new RpcError('INVALID_HEADERS', '高级头仅接受客户端身份字段：' + name);
        headers[name] = val;
      }
      overrides.extraHeaders = headers;
    }
    rule.overrides = overrides;
  }
  return rule;
}
export function normalizeConfig(value: unknown, fallback = defaultConfig()): PluginConfig {
  if (!object(value)) return structuredClone(fallback);
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) throw new RpcError('CONFIG_VERSION', '插件配置版本需要迁移。');
  const cfg = structuredClone(fallback);
  cfg.revision = Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 ? Number(value.revision) : 0;
  cfg.providers = {};
  if (object(value.providers)) for (const [id, rule] of Object.entries(value.providers)) {
    if (blocked.has(id) || !id.length || id.length > 256) throw new RpcError('INVALID_PROVIDER', '供应商标识无效。');
    cfg.providers[id] = validateRule(rule);
  }
  let activeProvider: string | undefined;
  for (const [id, rule] of Object.entries(cfg.providers)) {
    if (rule.client === 'none') continue;
    if (activeProvider === undefined) activeProvider = id;
    else cfg.providers[id] = rule.concurrency ? { client: 'none', concurrency: rule.concurrency, ...(rule.concurrencyMode ? { concurrencyMode: rule.concurrencyMode } : {}) } : { client: 'none' };
  }
  if (object(value.listener)) {
    cfg.listener.enabled = value.listener.enabled === true;
    const limit = Number(value.listener.maxEntries);
    cfg.listener.maxEntries = Number.isInteger(limit) && limit >= 1 && limit <= 500 ? limit : 50;
  }
  if (object(value.identity)) {
    if (text(value.identity.deviceId, 128) && /^[a-f0-9]{64}$/i.test(value.identity.deviceId)) cfg.identity.deviceId = value.identity.deviceId;
    if (text(value.identity.accountId, 80) && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.identity.accountId)) cfg.identity.accountId = value.identity.accountId;
  }
  return cfg;
}
export function publicConfig(config: PluginConfig): PluginConfig {
  const copy = structuredClone(config);
  copy.identity = { deviceId: '[redacted]', accountId: '[redacted]' };
  for (const rule of Object.values(copy.providers)) { delete rule.baseUrl; if (rule.overrides) { delete rule.overrides.accountId; delete rule.overrides.deviceId; } }
  return copy;
}
export class ConfigStore {
  private current: PluginConfig;
  private documentRevision: number | undefined;
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly settings: SettingsHost, initial?: unknown, readonly namespace = SETTINGS_NS) { this.current = normalizeConfig(initial); this.refresh(); }
  refresh(): PluginConfig {
    const own = this.settings.describe({ redactSecrets: false }).find(d => d.ns === this.namespace);
    this.documentRevision = own?.revision;
    if (own && object(own.value)) this.current = normalizeConfig(own.value.config, this.current);
    return structuredClone(this.current);
  }
  snapshot(): PluginConfig { return this.refresh(); }
  peek(): Readonly<PluginConfig> { return this.current; }
  async change(revision: unknown, mutate: (config: PluginConfig) => void): Promise<PluginConfig> {
    const prior = this.queue;
    let unlock: () => void = () => {};
    this.queue = new Promise<void>(resolve => { unlock = resolve; });
    await prior;
    try {
      const current = this.refresh();
      const observedDocumentRevision = this.documentRevision;
      if (revision !== current.revision) throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存；当前草稿仍保留。', 409);
      if (this.settings.writable === false) throw new RpcError('READ_ONLY', '当前配置为只读。', 409);
      mutate(current); current.revision++;
      const next = normalizeConfig(current, this.current);
      if (observedDocumentRevision === undefined) throw new RpcError('SETTINGS_NOT_READY', '插件配置命名空间正在加载，请稍后刷新。', 503);
      let receipt: unknown;
      try { receipt = await this.settings.replace(this.namespace, { config: next }, observedDocumentRevision); }
      catch (error) {
        if (object(error) && (error.name === 'SettingsConflictError' || error.code === 'REVISION_CONFLICT')) throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存；当前草稿仍保留。', 409);
        throw error;
      }
      if (object(receipt) && (receipt.ok === false || ['error', 'rejected', 'conflict'].includes(String(receipt.status)))) throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存。', 409);
      this.current = next;
      return structuredClone(next);
    } finally { unlock(); }
  }
  saveProvider(providerId: string, value: unknown, revision: unknown): Promise<PluginConfig> {
    if (blocked.has(providerId) || !providerId.length || providerId.length > 256) throw new RpcError('INVALID_PROVIDER', '供应商标识无效。');
    const input = validateRule(value);
    return this.change(revision, config => {
      const previous = config.providers[providerId];
      const rule = { ...input };
      // The panel deliberately never returns or posts these private/native-connection fields.
      if (previous?.baseUrl && rule.baseUrl === undefined) rule.baseUrl = previous.baseUrl;
      if (previous?.overrides?.accountId || previous?.overrides?.deviceId) rule.overrides = { ...rule.overrides, ...(previous.overrides.accountId ? { accountId: previous.overrides.accountId } : {}), ...(previous.overrides.deviceId ? { deviceId: previous.overrides.deviceId } : {}) };
      config.providers[providerId] = rule;
      // Single-simulation invariant: only one supplier may simulate a client at a time.
      // Saving a simulating rule resets every other supplier to plain passthrough.
      if (rule.client !== 'none') {
        for (const id of Object.keys(config.providers)) {
          if (id === providerId) continue;
          const keep = config.providers[id].concurrency;
          const keepMode = config.providers[id].concurrencyMode;
          config.providers[id] = keep ? { client: 'none', concurrency: keep, ...(keepMode ? { concurrencyMode: keepMode } : {}) } : { client: 'none' };
        }
      }
    });
  }
}
