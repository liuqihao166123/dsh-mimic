import type { CacheCounters, CacheDiagnosticEntry, CacheDiagnosticsState, CacheDimensionStat, CachePrefixChange, CacheReport } from '../types.js';

export const COUNTER_KEYS = ['requests', 'success', 'failed', 'cancelled', 'incomplete', 'coldRequests', 'fallbackRequests', 'retryRequests',
  'usageRequests', 'cacheReportedRequests', 'missingUsageRequests', 'unknownCacheRequests', 'invalidUsageRequests',
  'promptTokens', 'cachedTokens', 'writtenTokens', 'uncachedTokens', 'knownPromptTokens'] as const;
const PROTOCOLS = ['anthropic-messages', 'openai-responses', 'openai-chat-completions'];
const CHANGES = ['cold', 'model', 'profile', 'protocol', 'endpoint', 'cache-key', 'system', 'tools', 'parameters', 'history', 'append', 'unchanged', 'unknown'];
const OUTCOMES = ['success', 'http-error', 'stream-error', 'cancelled', 'incomplete'];
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const text = (v: unknown, max = 512): v is string => typeof v === 'string' && v.length <= max;
const time = (v: unknown): boolean => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const rate = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const tag = (v: unknown, prefix: string): v is string => typeof v === 'string' && new RegExp('^' + prefix + '-[a-f0-9]{16,24}$').test(v);
const safeText = (v: string): string => v.replace(/\bBearer\s+[^\s]+/gi, '[REDACTED]').replace(/\bsk-(?:proj-)?[a-z0-9_-]{6,}/gi, '[REDACTED]');
function validCounters(v: unknown): v is CacheCounters {
  return object(v) && COUNTER_KEYS.every(key => count(v[key])) && (v.hitRate === null || rate(v.hitRate)) && rate(v.coverage)
    && (v.since === undefined || time(v.since)) && (v.lastAt === undefined || time(v.lastAt));
}
function validDimension(v: unknown): v is CacheDimensionStat {
  return object(v) && text(v.modelId) && text(v.profile, 256) && PROTOCOLS.includes(String(v.protocol))
    && (v.sessionTag === undefined || tag(v.sessionTag, 's')) && (v.sessionSource === undefined || ['host', 'fallback'].includes(String(v.sessionSource)))
    && (v.purpose === undefined || typeof v.purpose === 'string' && /^[a-z0-9._/-]{1,64}$/i.test(v.purpose))
    && validCounters(v.counters) && validCounters(v.recent);
}
export function validCacheReport(v: unknown): boolean {
  return v === undefined || object(v) && time(v.startedAt) && count(v.windowSize) && Number(v.windowSize) >= 1 && Number(v.windowSize) <= 100
    && Array.isArray(v.providers) && v.providers.length <= 128 && v.providers.every(p => object(p) && text(p.providerId)
      && validCounters(p.lifetime) && validCounters(p.recent) && (p.latestSessionTag === undefined || tag(p.latestSessionTag, 's'))
      && Array.isArray(p.sessions) && p.sessions.length <= 64 && p.sessions.every(validDimension)
      && Array.isArray(p.models) && p.models.length <= 128 && p.models.every(validDimension));
}
function validDiagnostic(v: unknown): v is CacheDiagnosticEntry {
  if (!object(v)) return false;
  return typeof v.id === 'string' && /^d-[a-z0-9-]{1,80}$/.test(v.id) && time(v.time) && text(v.providerId) && text(v.modelId) && text(v.profile, 256)
    && PROTOCOLS.includes(String(v.protocol)) && tag(v.sessionTag, 's') && ['host', 'fallback'].includes(String(v.sessionSource))
    && (v.purpose === undefined || typeof v.purpose === 'string' && /^[a-z0-9._/-]{1,64}$/i.test(v.purpose))
    && count(v.attempt) && (v.cacheKeyTag === undefined || tag(v.cacheKeyTag, 'k')) && CHANGES.includes(String(v.change))
    && Array.isArray(v.changed) && v.changed.length <= CHANGES.length && v.changed.every(c => CHANGES.includes(String(c)))
    && ['messages', 'previousMessages', 'sharedMessages'].every(key => count(v[key]))
    && (v.firstChangedMessage === undefined || count(v.firstChangedMessage) && v.firstChangedMessage >= 1)
    && typeof v.comparable === 'boolean'
    && ['system', 'tools', 'parameters'].every(key => object(v[key]) && tag(v[key].tag, 'h') && count(v[key].chars))
    && (v.outcome === undefined || OUTCOMES.includes(String(v.outcome)))
    && ['promptTokens', 'cachedTokens', 'writtenTokens'].every(key => v[key] === undefined || count(v[key]))
    && (v.cacheReported === undefined || typeof v.cacheReported === 'boolean') && (v.hitRate === undefined || v.hitRate === null || rate(v.hitRate));
}
export function validCacheDiagnostics(v: unknown): boolean {
  return v === undefined || object(v) && typeof v.enabled === 'boolean' && count(v.maxEntries) && Number(v.maxEntries) >= 1 && Number(v.maxEntries) <= 500
    && count(v.maxSessions) && Number(v.maxSessions) >= 1 && Number(v.maxSessions) <= 256 && v.keyScope === 'runtime'
    && Array.isArray(v.entries) && v.entries.length <= Number(v.maxEntries) && v.entries.every(validDiagnostic);
}
export function projectCounters(v: CacheCounters): CacheCounters {
  return { ...Object.fromEntries(COUNTER_KEYS.map(key => [key, v[key]])), hitRate: v.hitRate, coverage: v.coverage,
    ...(v.since ? { since: v.since } : {}), ...(v.lastAt ? { lastAt: v.lastAt } : {}) } as CacheCounters;
}
function projectDimension(v: CacheDimensionStat): CacheDimensionStat {
  return { modelId: safeText(v.modelId), profile: safeText(v.profile), protocol: v.protocol,
    ...(v.sessionTag ? { sessionTag: v.sessionTag } : {}), ...(v.sessionSource ? { sessionSource: v.sessionSource } : {}), ...(v.purpose ? { purpose: v.purpose } : {}),
    counters: projectCounters(v.counters), recent: projectCounters(v.recent) };
}
export function projectCacheReport(v: CacheReport): CacheReport {
  return { startedAt: v.startedAt, windowSize: v.windowSize, providers: v.providers.map(p => ({ providerId: p.providerId,
    lifetime: projectCounters(p.lifetime), recent: projectCounters(p.recent), ...(p.latestSessionTag ? { latestSessionTag: p.latestSessionTag } : {}),
    sessions: p.sessions.map(projectDimension), models: p.models.map(projectDimension) })) };
}
export function projectCacheDiagnostics(v: CacheDiagnosticsState): CacheDiagnosticsState {
  return { enabled: v.enabled, maxEntries: v.maxEntries, maxSessions: v.maxSessions, keyScope: 'runtime', entries: v.entries.map(e => ({
    id: e.id, time: e.time, providerId: e.providerId, modelId: safeText(e.modelId), profile: safeText(e.profile), protocol: e.protocol,
    sessionTag: e.sessionTag, sessionSource: e.sessionSource, ...(e.purpose ? { purpose: e.purpose } : {}), attempt: e.attempt,
    ...(e.cacheKeyTag ? { cacheKeyTag: e.cacheKeyTag } : {}), change: e.change, changed: [...e.changed],
    messages: e.messages, previousMessages: e.previousMessages, sharedMessages: e.sharedMessages, comparable: e.comparable,
    ...(e.firstChangedMessage !== undefined ? { firstChangedMessage: e.firstChangedMessage } : {}),
    system: { tag: e.system.tag, chars: e.system.chars }, tools: { tag: e.tools.tag, chars: e.tools.chars }, parameters: { tag: e.parameters.tag, chars: e.parameters.chars },
    ...(e.outcome ? { outcome: e.outcome } : {}), ...(e.promptTokens !== undefined ? { promptTokens: e.promptTokens } : {}),
    ...(e.cachedTokens !== undefined ? { cachedTokens: e.cachedTokens } : {}), ...(e.writtenTokens !== undefined ? { writtenTokens: e.writtenTokens } : {}),
    ...(e.cacheReported !== undefined ? { cacheReported: e.cacheReported } : {}), ...(e.hitRate !== undefined ? { hitRate: e.hitRate } : {}),
  })) };
}
export function combineCounters(items: CacheCounters[]): CacheCounters {
  const result = { ...Object.fromEntries(COUNTER_KEYS.map(key => [key, 0])), hitRate: null, coverage: 0 } as CacheCounters;
  for (const item of items) {
    for (const key of COUNTER_KEYS) result[key] += item[key];
    if (item.since && (!result.since || item.since < result.since)) result.since = item.since;
    if (item.lastAt && (!result.lastAt || item.lastAt > result.lastAt)) result.lastAt = item.lastAt;
  }
  result.hitRate = result.knownPromptTokens > 0 ? result.cachedTokens / result.knownPromptTokens : null;
  result.coverage = result.requests > 0 ? result.cacheReportedRequests / result.requests : 0;
  return result;
}
export const PREFIX_CHANGE_LABELS: Record<CachePrefixChange, string> = { cold: '首次观测', model: '模型变化', profile: '身份模板变化', protocol: '协议变化', endpoint: '上游地址变化',
  'cache-key': '缓存键变化', system: '系统指令变化', tools: '工具定义变化', parameters: '请求参数变化', history: '历史消息改写', append: '仅追加消息', unchanged: '前缀保持一致', unknown: '超出比较范围' };
