import { createHmac, randomBytes } from 'node:crypto';
import type {
  CacheDiagnosticEntry, CacheDiagnosticsState, CacheFingerprint, CacheOutcome, CachePrefixChange,
  CacheSessionSource, TransformContext, TransformResult,
} from '../types.js';

interface Options { enabled?: boolean; maxEntries?: number; maxSessions?: number; maxMessages?: number }
interface Budget { chars: number; nodes: number }
interface Fingerprint extends CacheFingerprint { digest: string; complete: boolean }
interface Baseline {
  providerKey: string; attempt: number; model: string; profile: string; protocol: string; endpoint: Fingerprint;
  cacheKey: Fingerprint; system: Fingerprint; tools: Fingerprint; parameters: Fingerprint;
  history: Fingerprint[]; messages: number; complete: boolean;
}
interface Field { present: boolean; value?: unknown; complete: boolean }
const MAX_CHARS = 4 * 1024 * 1024;
const MAX_NODES = 131_072;
const MAX_DEPTH = 64;
const MAX_KEYS = 8192;
const EXCLUDED = new Set(['input', 'messages', 'system', 'instructions', 'tools', 'model', 'metadata', 'session', 'sessionid', 'requestid', 'promptcachekey']);
const OUTCOMES = new Set<CacheOutcome>(['success', 'http-error', 'stream-error', 'cancelled', 'incomplete']);
const limit = (value: number | undefined, fallback: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(1, Math.trunc(value))) : fallback;
const text = (value: unknown, max: number): string => typeof value === 'string' ? value.slice(0, max) : '';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
function field(value: object, key: string): Field {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor ? { present: true, value: descriptor.value, complete: 'value' in descriptor } : { present: false, complete: true };
}
function keys(value: object): string[] {
  const result: string[] = [];
  for (const key in value) if (Object.hasOwn(value, key)) {
    if (result.length >= MAX_KEYS) throw new Error('diagnostic-bound');
    result.push(key);
  }
  // Preserve JSON field order: schema or message reordering can alter the rendered prefix.
  return result;
}
function copy(entry: CacheDiagnosticEntry): CacheDiagnosticEntry {
  return { ...entry, changed: [...entry.changed], system: { ...entry.system }, tools: { ...entry.tools }, parameters: { ...entry.parameters } };
}
const publicFingerprint = ({ tag, chars }: Fingerprint): CacheFingerprint => ({ tag, chars });
const different = (a: Fingerprint, b: Fingerprint): boolean => a.complete && b.complete && a.digest !== b.digest;

/** Passive, bounded HTTP-attempt diagnostics. No request body or header is changed or retained.
 * The secret is private runtime memory; all exported tags are domain-separated keyed hashes.
 * Fingerprint chars count JSON characters, not tokens or retained prompt text. */
export class PrefixDiagnostics {
  #secret = randomBytes(32);
  private enabled: boolean;
  private readonly maxEntries: number;
  private readonly maxSessions: number;
  private readonly maxMessages: number;
  private readonly sessions = new Map<string, Baseline>();
  private readonly pending = new Map<string, CacheDiagnosticEntry>();
  private readonly entryProviders = new Map<string, string>();
  private entries: CacheDiagnosticEntry[] = [];
  private sequence = 0;

  constructor(options: Options = {}) {
    this.enabled = options.enabled ?? true;
    this.maxEntries = limit(options.maxEntries, 100, 500);
    this.maxSessions = limit(options.maxSessions, 64, 256);
    this.maxMessages = limit(options.maxMessages, 2048, 8192);
  }

  private digest(domain: string, value: string): string {
    return createHmac('sha256', this.#secret).update(domain).update('\0').update(value).digest('hex');
  }
  sessionTag(sessionId: string): string { return 's-' + this.digest('session', sessionId).slice(0, 24); }

  /** Stream JSON into the HMAC; no serialized prompt survives this call.
   * Limits, unsupported values, accessors and cycles produce an incomparable fingerprint. */
  private fingerprint(domain: string, value: unknown, budget: Budget): Fingerprint {
    const hash = createHmac('sha256', this.#secret).update(domain).update('\0');
    let chars = 0, complete = true;
    const ancestors = new Set<object>();
    const write = (chunk: string): void => {
      if (budget.chars + chunk.length > MAX_CHARS) throw new Error('diagnostic-bound');
      budget.chars += chunk.length; chars += chunk.length; hash.update(chunk);
    };
    const string = (value: string): void => {
      if (value.length > MAX_CHARS - budget.chars) throw new Error('diagnostic-bound');
      write(JSON.stringify(value));
    };
    const visit = (value: unknown, depth: number): void => {
      if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error('diagnostic-bound');
      if (value === null) { write('null'); return; }
      if (typeof value === 'string') { string(value); return; }
      if (typeof value === 'boolean') { write(String(value)); return; }
      if (typeof value === 'number' && Number.isFinite(value)) { write(JSON.stringify(value)); return; }
      if (!value || typeof value !== 'object' || ancestors.has(value)) throw new Error('diagnostic-value');
      const array = Array.isArray(value), prototype: unknown = Object.getPrototypeOf(value);
      if (!array && prototype !== null && prototype !== Object.prototype) throw new Error('diagnostic-value');
      ancestors.add(value);
      if (array) {
        if (value.length > MAX_NODES - budget.nodes) throw new Error('diagnostic-bound');
        write('[');
        for (let i = 0; i < value.length; i++) {
          const item = field(value, String(i));
          if (!item.present || !item.complete) throw new Error('diagnostic-value');
          if (i) write(','); visit(item.value, depth + 1);
        }
        write(']');
      } else {
        write('{'); let first = true;
        for (const key of keys(value)) {
          const item = field(value, key);
          if (!item.complete) throw new Error('diagnostic-value');
          if (!first) write(','); first = false;
          string(key); write(':'); visit(item.value, depth + 1);
        }
        write('}');
      }
      ancestors.delete(value);
    };
    try { visit(value, 0); } catch { complete = false; hash.update('\0incomplete'); }
    const digest = hash.digest('hex');
    return { tag: (domain === 'cache-key' ? 'k-' : 'h-') + digest.slice(0, 24), chars, digest, complete };
  }

  observe(result: TransformResult, context: TransformContext, meta?: { sessionSource?: CacheSessionSource; purpose?: string }): CacheDiagnosticEntry | undefined {
    if (!this.enabled) return;
    const budget: Budget = { chars: 0, nodes: 0 }, parts: unknown[] = [], history: Fingerprint[] = [];
    let complete = true, messages = 0, bodyModel: unknown;
    let systemValue: unknown = [], toolsValue: unknown = null, cacheValue: unknown = null;
    const parameters: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    try {
      if (!object(result.body)) throw new Error('diagnostic-body');
      const bodyKeys = keys(result.body), values = new Map<string, Field>();
      for (const key of bodyKeys) {
        const item = field(result.body, key); values.set(key, item);
        if (!item.complete) complete = false;
        if (!EXCLUDED.has(key.replace(/[-_]/g, '').toLowerCase())) parameters[key] = item.value;
      }
      bodyModel = values.get('model')?.value;
      for (const key of ['instructions', 'system']) {
        const item = values.get(key);
        if (item) parts.push([key, item.value]);
      }
      toolsValue = values.has('tools') ? values.get('tools')!.value : null;
      cacheValue = values.has('prompt_cache_key') ? values.get('prompt_cache_key')!.value : null;
      const input = values.get('input'), chat = values.get('messages');
      if (input && chat) complete = false;
      const selected = input ?? chat;
      const historyValue = selected?.value;
      const list: unknown[] = typeof historyValue === 'string' && input ? [historyValue] : Array.isArray(historyValue) ? historyValue : [];
      if (selected && !Array.isArray(historyValue) && !(typeof historyValue === 'string' && input)) complete = false;
      messages = list.length;
      if (messages > this.maxMessages) complete = false;
      for (let i = 0; i < Math.min(messages, this.maxMessages); i++) {
        const item = field(list, String(i));
        if (!item.present || !item.complete) { complete = false; break; }
        const value = item.value;
        if (object(value)) {
          const role = field(value, 'role');
          if (!role.complete) complete = false;
          if (role.value === 'system' || role.value === 'developer') parts.push([input ? 'input' : 'messages', i, value]);
        }
        const fingerprint = this.fingerprint('message', value, budget); history.push(fingerprint);
        if (!fingerprint.complete) { complete = false; break; }
      }
      systemValue = parts;
    } catch { complete = false; }
    const system = this.fingerprint('system', systemValue, budget), tools = this.fingerprint('tools', toolsValue, budget);
    const parameterHash = this.fingerprint('parameters', parameters, budget), cacheKey = this.fingerprint('cache-key', cacheValue, budget);
    let endpointValue: unknown = null;
    try {
      if (result.url.length > 65_536) throw new Error('diagnostic-bound');
      const url = new URL(result.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('diagnostic-endpoint');
      endpointValue = url.origin + url.pathname;
    } catch { complete = false; }
    const endpoint = this.fingerprint('endpoint', endpointValue, budget);
    const sessionId = typeof context.identity.sessionId === 'string' ? context.identity.sessionId : '';
    const providerId = text(context.identity.providerId, 512), modelId = text(typeof bodyModel === 'string' ? bodyModel : context.identity.modelId, 512);
    const profile = text(result.profile, 256), providerKey = this.digest('provider', context.identity.providerId);
    const sessionKey = providerKey + ':' + this.digest('session', sessionId), previous = this.sessions.get(sessionKey);
    const attempt = Math.min(Number.MAX_SAFE_INTEGER, (previous?.attempt ?? 0) + 1);
    const model = this.digest('model', typeof bodyModel === 'string' ? bodyModel : context.identity.modelId);
    const profileKey = this.digest('profile', JSON.stringify([context.rule.client, result.profile]));
    complete = complete && !!sessionId && system.complete && tools.complete && parameterHash.complete && cacheKey.complete && endpoint.complete;
    const comparable = complete && (!previous || previous.complete);
    const changed: CachePrefixChange[] = [];
    let sharedMessages = 0, firstChangedMessage: number | undefined;
    if (!previous) changed.push('cold');
    else {
      if (previous.model !== model) changed.push('model');
      if (previous.profile !== profileKey) changed.push('profile');
      if (previous.protocol !== result.targetProtocol) changed.push('protocol');
      for (const [name, current, prior] of [
        ['endpoint', endpoint, previous.endpoint], ['cache-key', cacheKey, previous.cacheKey],
        ['system', system, previous.system], ['tools', tools, previous.tools], ['parameters', parameterHash, previous.parameters],
      ] as const) if (different(current, prior)) changed.push(name);
      if (comparable) {
        while (sharedMessages < Math.min(history.length, previous.history.length) && history[sharedMessages]!.digest === previous.history[sharedMessages]!.digest) sharedMessages++;
        if (sharedMessages < Math.min(messages, previous.messages) || messages < previous.messages) {
          changed.push('history'); firstChangedMessage = sharedMessages + 1;
        } else if (messages > previous.messages) changed.push('append');
      }
    }
    if (!comparable) changed.push('unknown');
    if (!changed.length) changed.push('unchanged');
    const purpose = meta?.purpose === undefined ? undefined : /^[a-z0-9._/-]{1,64}$/i.test(meta.purpose) ? meta.purpose : 'other';
    const entry: CacheDiagnosticEntry = {
      id: 'd-' + (++this.sequence).toString(16), time: new Date().toISOString(), providerId, modelId, profile, protocol: result.targetProtocol,
      sessionTag: this.sessionTag(sessionId), sessionSource: meta?.sessionSource ?? (sessionId ? 'host' : 'fallback'),
      ...(purpose === undefined ? {} : { purpose }), attempt,
      ...(cacheValue === null || cacheValue === undefined ? {} : { cacheKeyTag: cacheKey.tag }),
      change: changed[0]!, changed, messages, previousMessages: previous?.messages ?? 0, sharedMessages,
      ...(firstChangedMessage === undefined ? {} : { firstChangedMessage }), comparable,
      system: publicFingerprint(system), tools: publicFingerprint(tools), parameters: publicFingerprint(parameterHash),
    };
    // Keys contain only a provider HMAC and session HMAC. The LRU stores no request objects.
    this.sessions.delete(sessionKey);
    this.sessions.set(sessionKey, { providerKey, attempt, model, profile: profileKey, protocol: result.targetProtocol, endpoint, cacheKey, system, tools, parameters: parameterHash, history, messages, complete });
    while (this.sessions.size > this.maxSessions) this.sessions.delete(this.sessions.keys().next().value!);
    this.entries.unshift(entry); this.pending.set(entry.id, entry); this.entryProviders.set(entry.id, providerKey);
    for (const evicted of this.entries.splice(this.maxEntries)) { this.pending.delete(evicted.id); this.entryProviders.delete(evicted.id); }
    return copy(entry);
  }

  complete(id: string, result: { outcome: CacheOutcome; promptTokens?: number; cachedTokens?: number; writtenTokens?: number; cacheReported?: boolean; hitRate?: number | null }): void {
    const entry = this.pending.get(id);
    if (!this.enabled || !entry) return;
    this.pending.delete(id);
    entry.outcome = OUTCOMES.has(result.outcome) ? result.outcome : 'incomplete';
    for (const key of ['promptTokens', 'cachedTokens', 'writtenTokens'] as const) {
      const value = result[key];
      if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) entry[key] = value;
    }
    if (typeof result.cacheReported === 'boolean') entry.cacheReported = result.cacheReported;
    if (result.hitRate === null || typeof result.hitRate === 'number' && Number.isFinite(result.hitRate) && result.hitRate >= 0 && result.hitRate <= 1) entry.hitRate = result.hitRate;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    // Past redacted records remain visible; no pending completion or baseline crosses a pause.
    this.sessions.clear(); this.pending.clear();
  }
  clear(providerId?: string): void {
    if (providerId === undefined) { this.entries = []; this.sessions.clear(); this.pending.clear(); this.entryProviders.clear(); return; }
    const providerKey = this.digest('provider', providerId);
    for (const [key, baseline] of this.sessions) if (baseline.providerKey === providerKey) this.sessions.delete(key);
    this.entries = this.entries.filter(entry => {
      if (this.entryProviders.get(entry.id) !== providerKey) return true;
      this.pending.delete(entry.id); this.entryProviders.delete(entry.id); return false;
    });
  }
  snapshot(): CacheDiagnosticsState {
    return { enabled: this.enabled, maxEntries: this.maxEntries, maxSessions: this.maxSessions, keyScope: 'runtime', entries: this.entries.map(copy) };
  }
}
