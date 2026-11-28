import type { CacheCounters, CacheDimensionStat, CacheOutcome, CacheProviderReport, CacheReport, CacheSessionSource, CacheStat, WireProtocol } from '../types.js';
import { extractUsage, type UsageObservation, type UsageSample } from './usage.js';
export { extractUsage, type UsageSample } from './usage.js';

export interface CacheRequestMeta {
  providerId: string; modelId: string; profile: string; protocol: WireProtocol;
  sessionTag: string; sessionSource: CacheSessionSource; operationTag?: string; purpose?: string;
}
export interface CacheTicket { complete(observation: UsageObservation, outcome?: CacheOutcome): void }
interface SampleRecord { time: number; meta: CacheRequestMeta; observation: UsageObservation; outcome: CacheOutcome; cold: boolean; retry: boolean }
interface Dimension { meta: CacheRequestMeta; counters: CacheCounters }
interface ProviderBucket {
  counters: CacheCounters; recent: SampleRecord[]; sessions: Map<string, Dimension>; models: Map<string, Dimension>;
  operations: Map<string, number>; latestSessionTag: string;
}
const WINDOW = 20;
const MAX_PROVIDERS = 128;
const MAX_SESSIONS = 64;
const MAX_MODELS = 128;
const MAX_OPERATIONS = 256;
export const emptyCacheCounters = (): CacheCounters => ({
  requests: 0, success: 0, failed: 0, cancelled: 0, incomplete: 0,
  coldRequests: 0, fallbackRequests: 0, retryRequests: 0,
  usageRequests: 0, cacheReportedRequests: 0, missingUsageRequests: 0, unknownCacheRequests: 0, invalidUsageRequests: 0,
  promptTokens: 0, cachedTokens: 0, writtenTokens: 0, uncachedTokens: 0, knownPromptTokens: 0, hitRate: null, coverage: 0,
});
const validNumber = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
const sessionKey = (m: CacheRequestMeta): string => JSON.stringify([m.sessionTag, m.modelId, m.profile, m.protocol, m.purpose ?? '']);
const modelKey = (m: CacheRequestMeta): string => JSON.stringify([m.modelId, m.profile, m.protocol, m.purpose ?? '']);
function touch<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
  map.delete(key); map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value!);
}
function apply(c: CacheCounters, r: SampleRecord): void {
  c.requests++;
  if (r.outcome === 'success') c.success++;
  else if (r.outcome === 'cancelled') c.cancelled++;
  else if (r.outcome === 'incomplete') c.incomplete++;
  else c.failed++;
  if (r.cold) c.coldRequests++;
  if (r.retry) c.retryRequests++;
  if (r.meta.sessionSource === 'fallback') c.fallbackRequests++;
  const at = new Date(r.time).toISOString();
  c.since = !c.since || c.since > at ? at : c.since;
  c.lastAt = !c.lastAt || c.lastAt < at ? at : c.lastAt;
  const s = r.observation.sample;
  const valid = !!s && validNumber(s.prompt) && validNumber(s.cached) && validNumber(s.written);
  const consistent = valid && s.cached <= s.prompt && s.written <= s.prompt - s.cached;
  if (r.observation.malformed || r.observation.limitExceeded || s && !consistent) c.invalidUsageRequests++;
  if (!valid) c.missingUsageRequests++;
  else {
    c.usageRequests++;
    c.promptTokens += s.prompt;
    // Writes are meaningful even when upstream did not report a read-cache field.
    if (consistent) c.writtenTokens += s.written;
    if (consistent && s.cacheReported && !r.observation.malformed && !r.observation.limitExceeded) {
      c.cacheReportedRequests++;
      c.knownPromptTokens += s.prompt;
      c.cachedTokens += s.cached;
      c.uncachedTokens += s.prompt - s.cached - s.written;
    } else c.unknownCacheRequests++;
  }
  c.hitRate = c.knownPromptTokens > 0 ? c.cachedTokens / c.knownPromptTokens : null;
  c.coverage = c.requests > 0 ? c.cacheReportedRequests / c.requests : 0;
}
function sum(records: SampleRecord[]): CacheCounters {
  const counters = emptyCacheCounters();
  for (const record of records) apply(counters, record);
  return counters;
}
function sanitizeMeta(m: CacheRequestMeta): CacheRequestMeta {
  return { providerId: m.providerId.slice(0, 512), modelId: m.modelId.slice(0, 512), profile: m.profile.slice(0, 256),
    protocol: m.protocol, sessionTag: m.sessionTag.slice(0, 64), sessionSource: m.sessionSource,
    ...(m.operationTag ? { operationTag: m.operationTag.slice(0, 64) } : {}),
    ...(m.purpose ? { purpose: /^[a-z0-9._/-]{1,64}$/i.test(m.purpose) ? m.purpose : 'other' } : {}) };
}

/** Bounded, in-memory HTTP-attempt accounting. Unknown cache reporting never becomes a false 0% hit. */
export class CacheMetrics {
  private readonly providers = new Map<string, ProviderBucket>();
  private startedAt: string;
  constructor(private readonly now: () => number = Date.now) { this.startedAt = new Date(now()).toISOString(); }
  begin(input: CacheRequestMeta): CacheTicket {
    const meta = sanitizeMeta(input);
    const bucket = this.providers.get(meta.providerId) ?? { counters: emptyCacheCounters(), recent: [], sessions: new Map<string, Dimension>(), models: new Map<string, Dimension>(), operations: new Map<string, number>(), latestSessionTag: meta.sessionTag };
    touch(this.providers, meta.providerId, bucket, MAX_PROVIDERS);
    bucket.latestSessionTag = meta.sessionTag;
    const key = sessionKey(meta), cold = !bucket.sessions.has(key);
    const session = bucket.sessions.get(key) ?? { meta, counters: emptyCacheCounters() };
    const model = bucket.models.get(modelKey(meta)) ?? { meta, counters: emptyCacheCounters() };
    touch(bucket.sessions, key, session, MAX_SESSIONS);
    touch(bucket.models, modelKey(meta), model, MAX_MODELS);
    const previousAttempts = meta.operationTag ? bucket.operations.get(meta.operationTag) ?? 0 : 0;
    if (meta.operationTag) touch(bucket.operations, meta.operationTag, previousAttempts + 1, MAX_OPERATIONS);
    let settled = false;
    return { complete: (observation, explicitOutcome) => {
      if (settled) return;
      settled = true;
      // A reset or an eviction fences off older in-flight completions.
      if (this.providers.get(meta.providerId) !== bucket) return;
      const outcome: CacheOutcome = explicitOutcome ?? (observation.state === 'complete' ? 'success' : observation.state === 'failed' ? 'stream-error' : observation.state);
      const record: SampleRecord = { meta, time: this.now(), observation: { ...observation, ...(observation.sample ? { sample: { ...observation.sample } } : {}) }, outcome, cold, retry: previousAttempts > 0 };
      apply(bucket.counters, record);
      if (bucket.sessions.get(key) === session) apply(session.counters, record);
      if (bucket.models.get(modelKey(meta)) === model) apply(model.counters, record);
      bucket.recent.push(record);
      if (bucket.recent.length > WINDOW) bucket.recent.splice(0, bucket.recent.length - WINDOW);
    } };
  }
  /** Compatibility helper for deterministic text fixtures, not used by the streaming transport. */
  ingest(providerId: string, text: string, protocol?: WireProtocol): void {
    const sample = extractUsage(text, protocol);
    this.record(providerId, sample);
  }
  record(providerId: string, sample: UsageSample | undefined): void {
    this.begin({ providerId, modelId: '', profile: '', protocol: 'openai-responses', sessionTag: 'unknown', sessionSource: 'fallback' })
      .complete({ ...(sample ? { sample } : {}), state: 'complete', malformed: false, limitExceeded: false });
  }
  report(): CacheReport {
    const providers: CacheProviderReport[] = [...this.providers].map(([providerId, bucket]) => {
      const dimensions = (map: Map<string, Dimension>, session: boolean): CacheDimensionStat[] => [...map.values()].map(item => ({
        modelId: item.meta.modelId, profile: item.meta.profile, protocol: item.meta.protocol,
        ...(item.meta.purpose ? { purpose: item.meta.purpose } : {}),
        ...(session ? { sessionTag: item.meta.sessionTag, sessionSource: item.meta.sessionSource } : {}),
        counters: { ...item.counters },
        recent: sum(bucket.recent.filter(record => (session ? sessionKey(record.meta) === sessionKey(item.meta) : modelKey(record.meta) === modelKey(item.meta)))),
      }));
      return { providerId, lifetime: { ...bucket.counters }, recent: sum(bucket.recent), latestSessionTag: bucket.latestSessionTag,
        sessions: dimensions(bucket.sessions, true), models: dimensions(bucket.models, false) };
    });
    return { startedAt: this.startedAt, windowSize: WINDOW, providers };
  }
  /** Legacy summary retained so an older client can still display counts during a reload. */
  snapshot(): CacheStat[] {
    return [...this.providers].map(([providerId, b]) => ({ providerId, requests: b.counters.requests,
      promptTokens: b.counters.promptTokens, cachedTokens: b.counters.cachedTokens, hitRate: b.counters.hitRate ?? 0 }));
  }
  clear(providerId?: string): void {
    if (providerId !== undefined) this.providers.delete(providerId);
    else { this.providers.clear(); this.startedAt = new Date(this.now()).toISOString(); }
  }
}
