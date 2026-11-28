import assert from 'node:assert/strict';
import test from 'node:test';
import { CacheMetrics, emptyCacheCounters } from '../src/host/metrics.js';
import type { CacheRequestMeta } from '../src/host/metrics.js';
import type { UsageObservation, UsageSample } from '../src/host/usage.js';
import type { CacheOutcome, CacheProviderReport } from '../src/types.js';

const EPOCH = Date.parse('2026-11-28T00:00:00.000Z');
const sample = (prompt = 100, cached = 75, written = 0, cacheReported = true): UsageSample => ({ prompt, cached, written, cacheReported });
function observation(usage?: UsageSample, state: UsageObservation['state'] = 'complete', extra: Partial<UsageObservation> = {}): UsageObservation {
  if (arguments.length === 0) usage = sample();
  return { ...(usage ? { sample: usage } : {}), state, malformed: false, limitExceeded: false, ...extra };
}
const meta = (extra: Partial<CacheRequestMeta> = {}): CacheRequestMeta => ({
  providerId: 'provider-a', modelId: 'model-a', profile: 'codex', protocol: 'openai-responses', sessionTag: 'session-a', sessionSource: 'host', ...extra,
});
function record(metrics: CacheMetrics, usage?: UsageSample, extra: Partial<CacheRequestMeta> = {}, state: UsageObservation['state'] = 'complete', outcome?: CacheOutcome): void {
  if (arguments.length < 2) usage = sample();
  metrics.begin(meta(extra)).complete(observation(usage, state), outcome);
}
function provider(metrics: CacheMetrics, id = 'provider-a'): CacheProviderReport {
  const result = metrics.report().providers.find(item => item.providerId === id);
  assert.ok(result, 'expected provider ' + id); return result;
}

test('empty counters and report have no fabricated cache hit rate or coverage', () => {
  const counters = emptyCacheCounters();
  assert.equal(counters.hitRate, null); assert.equal(counters.coverage, 0);
  assert.equal(counters.requests, 0); assert.equal(counters.knownPromptTokens, 0);
  assert.equal(counters.since, undefined); assert.equal(counters.lastAt, undefined);
  const metrics = new CacheMetrics(() => EPOCH);
  assert.deepEqual(metrics.report(), { startedAt: new Date(EPOCH).toISOString(), windowSize: 20, providers: [] });
  assert.deepEqual(metrics.snapshot(), []);
});

test('hit rate weights known token denominators and excludes unknown or missing usage', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(100, 100)); record(metrics, sample(900, 0));
  record(metrics, sample(10000, 0, 0, false)); record(metrics, undefined);
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 4); assert.equal(c.success, 4);
  assert.equal(c.promptTokens, 11000); assert.equal(c.knownPromptTokens, 1000); assert.equal(c.cachedTokens, 100);
  assert.equal(c.hitRate, 0.1); assert.equal(c.coverage, 0.5);
  assert.equal(c.usageRequests, 3); assert.equal(c.cacheReportedRequests, 2);
  assert.equal(c.missingUsageRequests, 1); assert.equal(c.unknownCacheRequests, 1); assert.equal(c.invalidUsageRequests, 0);
});

test('explicit zero cache read remains known while an absent cache field stays unknown', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(100, 0, 0, false));
  assert.equal(provider(metrics).lifetime.hitRate, null);
  record(metrics, sample(100, 0));
  const c = provider(metrics).lifetime;
  assert.equal(c.hitRate, 0); assert.equal(c.knownPromptTokens, 100);
  assert.equal(c.cacheReportedRequests, 1); assert.equal(c.unknownCacheRequests, 1); assert.equal(c.coverage, 0.5);
});

test('pure cache writes are counted without inventing a known cache-read denominator', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(200, 0, 200, false)); record(metrics, sample(992, 980, 2));
  const c = provider(metrics).lifetime;
  assert.equal(c.promptTokens, 1192); assert.equal(c.writtenTokens, 202);
  assert.equal(c.knownPromptTokens, 992); assert.equal(c.cachedTokens, 980); assert.equal(c.uncachedTokens, 10);
  assert.equal(c.hitRate, 980 / 992); assert.equal(c.unknownCacheRequests, 1);
});

test('a reported zero-token sample is measured but has no nonzero denominator', () => {
  const metrics = new CacheMetrics(() => EPOCH); record(metrics, sample(0, 0));
  const c = provider(metrics).lifetime;
  assert.equal(c.usageRequests, 1); assert.equal(c.cacheReportedRequests, 1); assert.equal(c.coverage, 1);
  assert.equal(c.hitRate, null); assert.equal(c.missingUsageRequests, 0);
});

test('malformed and limited observations remain invalid and are excluded from known hit rate', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  metrics.begin(meta()).complete(observation(sample(100, 100), 'complete', { malformed: true }));
  metrics.begin(meta()).complete(observation(sample(100, 100), 'complete', { limitExceeded: true }));
  metrics.begin(meta()).complete(observation(undefined, 'incomplete', { malformed: true }));
  const c = provider(metrics).lifetime;
  assert.equal(c.invalidUsageRequests, 3); assert.equal(c.knownPromptTokens, 0); assert.equal(c.cachedTokens, 0);
  assert.equal(c.hitRate, null); assert.equal(c.cacheReportedRequests, 0); assert.equal(c.unknownCacheRequests, 2);
  assert.equal(c.missingUsageRequests, 1); assert.equal(c.usageRequests, 2);
});

test('numeric invalid samples are counted as invalid and never enter token totals', () => {
  for (const invalid of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    for (const field of ['prompt', 'cached', 'written'] as const) {
      const metrics = new CacheMetrics(() => EPOCH);
      record(metrics, { ...sample(), [field]: invalid });
      const c = provider(metrics).lifetime;
      assert.equal(c.invalidUsageRequests, 1, field + '=' + invalid);
      assert.equal(c.usageRequests, 0); assert.equal(c.promptTokens, 0); assert.equal(c.knownPromptTokens, 0);
      assert.equal(c.cachedTokens, 0); assert.equal(c.writtenTokens, 0); assert.equal(c.hitRate, null);
    }
  }
});

test('inconsistent cache counters are invalid rather than clamped into a hit rate', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(100, 101)); record(metrics, sample(100, 75, 26));
  const c = provider(metrics).lifetime;
  assert.equal(c.invalidUsageRequests, 2); assert.equal(c.unknownCacheRequests, 2);
  assert.equal(c.cacheReportedRequests, 0); assert.equal(c.knownPromptTokens, 0); assert.equal(c.hitRate, null);
  assert.equal(c.writtenTokens, 0); assert.equal(c.cachedTokens, 0);
});

test('failed, cancelled and incomplete attempts are separate and preserve observed usage', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics); record(metrics, sample(), {}, 'failed'); record(metrics, sample(), {}, 'cancelled'); record(metrics, sample(), {}, 'incomplete');
  record(metrics, undefined, {}, 'complete', 'http-error');
  record(metrics, undefined, {}, 'complete', 'stream-error');
  record(metrics, sample(10, 0), {}, 'complete', 'cancelled');
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 7); assert.equal(c.success, 1); assert.equal(c.failed, 3); assert.equal(c.cancelled, 2); assert.equal(c.incomplete, 1);
  assert.equal(c.usageRequests, 5); assert.equal(c.promptTokens, 410); assert.equal(c.cachedTokens, 300);
  assert.equal(c.knownPromptTokens, 410); assert.equal(c.hitRate, 300 / 410);
});

test('providers and session/model dimensions remain isolated across every grouping key', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics); record(metrics);
  record(metrics, sample(), { providerId: 'provider-b' });
  record(metrics, sample(), { sessionTag: 'session-b' });
  record(metrics, sample(), { modelId: 'model-b' });
  record(metrics, sample(), { profile: 'claude-code' });
  record(metrics, sample(), { protocol: 'openai-chat-completions' });
  record(metrics, sample(), { purpose: 'compaction' });
  const a = provider(metrics), b = provider(metrics, 'provider-b');
  assert.equal(a.lifetime.requests, 7); assert.equal(b.lifetime.requests, 1);
  assert.equal(a.sessions.length, 6); assert.equal(a.models.length, 5);
  const session = a.sessions.find(item => item.sessionTag === 'session-a' && item.modelId === 'model-a' && item.profile === 'codex' && item.protocol === 'openai-responses' && !item.purpose)!;
  assert.equal(session.counters.requests, 2); assert.equal(session.sessionSource, 'host');
  const model = a.models.find(item => item.modelId === 'model-a' && item.profile === 'codex' && item.protocol === 'openai-responses' && !item.purpose)!;
  assert.equal(model.counters.requests, 3); assert.equal(model.sessionTag, undefined);
  assert.equal(a.latestSessionTag, 'session-a');
});

test('recent window keeps the last twenty completed attempts per provider', () => {
  let clock = EPOCH;
  const metrics = new CacheMetrics(() => clock++);
  for (let i = 0; i < 5; i++) record(metrics, sample(100, 100), { sessionTag: 'old-session', modelId: 'old-model' });
  for (let i = 0; i < 20; i++) record(metrics, sample(10, 0), { sessionTag: 'new-session', modelId: 'new-model' });
  record(metrics, sample(), { providerId: 'provider-b' });
  const a = provider(metrics), b = provider(metrics, 'provider-b');
  assert.equal(a.lifetime.requests, 25); assert.equal(a.lifetime.cachedTokens, 500);
  assert.equal(a.recent.requests, 20); assert.equal(a.recent.promptTokens, 200); assert.equal(a.recent.cachedTokens, 0); assert.equal(a.recent.hitRate, 0);
  assert.equal(a.sessions.find(item => item.sessionTag === 'old-session')!.recent.requests, 0);
  assert.equal(a.models.find(item => item.modelId === 'old-model')!.recent.requests, 0);
  assert.equal(a.sessions.find(item => item.sessionTag === 'new-session')!.recent.requests, 20);
  assert.equal(b.recent.requests, 1); assert.notEqual(a.recent.since, a.lifetime.since);
});

test('recent window follows completion order rather than request begin order', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  const tickets = Array.from({ length: 21 }, (_, i) => ({ ticket: metrics.begin(meta()), i }));
  for (const { ticket, i } of tickets.reverse()) ticket.complete(observation(sample(i + 1, i === 20 ? 21 : 0)));
  const p = provider(metrics);
  assert.equal(p.lifetime.requests, 21); assert.equal(p.lifetime.cachedTokens, 21);
  assert.equal(p.recent.requests, 20); assert.equal(p.recent.promptTokens, 210); assert.equal(p.recent.cachedTokens, 0);
});

test('first observation is marked once at begin even before its in-flight request completes', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  const first = metrics.begin(meta({ sessionSource: 'fallback' }));
  const second = metrics.begin(meta({ sessionSource: 'fallback' }));
  second.complete(observation(undefined, 'failed')); first.complete(observation());
  record(metrics, sample(), { sessionTag: 'session-b' });
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 3); assert.equal(c.coldRequests, 2); assert.equal(c.fallbackRequests, 2);
  assert.equal(c.success, 2); assert.equal(c.failed, 1);
});

test('same logical operation counts each HTTP attempt and marks subsequent attempts as retries', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  const first = metrics.begin(meta({ operationTag: 'round-1' }));
  const second = metrics.begin(meta({ operationTag: 'round-1' }));
  second.complete(observation(sample(), 'failed')); first.complete(observation());
  record(metrics, sample(), { operationTag: 'round-2' });
  record(metrics, sample(), { operationTag: 'round-1' });
  record(metrics); record(metrics);
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 6); assert.equal(c.retryRequests, 2); assert.equal(c.coldRequests, 1);
  record(metrics, sample(), { providerId: 'provider-b', operationTag: 'round-1' });
  assert.equal(provider(metrics, 'provider-b').lifetime.retryRequests, 0);
});

test('ticket completion is idempotent and explicit transport outcomes take precedence', () => {
  const metrics = new CacheMetrics(() => EPOCH), ticket = metrics.begin(meta());
  ticket.complete(observation(sample(), 'complete'), 'http-error');
  ticket.complete(observation(sample(999, 999), 'cancelled'));
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 1); assert.equal(c.failed, 1); assert.equal(c.cancelled, 0); assert.equal(c.promptTokens, 100);
});

test('provider reset fences old in-flight tickets even after the provider is re-created', () => {
  let clock = EPOCH;
  const metrics = new CacheMetrics(() => clock), old = metrics.begin(meta());
  record(metrics, sample(), { providerId: 'provider-b' });
  const startedAt = metrics.report().startedAt;
  metrics.clear('provider-a'); clock += 1000;
  record(metrics, sample(10, 0)); old.complete(observation(sample(999, 999)));
  assert.equal(provider(metrics).lifetime.requests, 1); assert.equal(provider(metrics).lifetime.promptTokens, 10);
  assert.equal(provider(metrics, 'provider-b').lifetime.requests, 1); assert.equal(metrics.report().startedAt, startedAt);
});

test('global reset changes startedAt and prevents all old in-flight completions from returning', () => {
  let clock = EPOCH;
  const metrics = new CacheMetrics(() => clock), a = metrics.begin(meta()), b = metrics.begin(meta({ providerId: 'provider-b' }));
  record(metrics); clock += 10000; metrics.clear();
  a.complete(observation()); b.complete(observation());
  assert.deepEqual(metrics.report(), { startedAt: new Date(clock).toISOString(), windowSize: 20, providers: [] });
});

test('provider buckets are bounded to 128 with LRU access and old ticket fencing', () => {
  const metrics = new CacheMetrics(() => EPOCH), old = metrics.begin(meta({ providerId: 'provider-0' }));
  for (let i = 1; i <= 128; i++) record(metrics, sample(1, 0), { providerId: 'provider-' + i });
  assert.equal(metrics.report().providers.length, 128);
  assert.equal(metrics.report().providers.some(item => item.providerId === 'provider-0'), false);
  record(metrics, sample(2, 0), { providerId: 'provider-0' }); old.complete(observation(sample(999, 999)));
  assert.equal(provider(metrics, 'provider-0').lifetime.requests, 1); assert.equal(provider(metrics, 'provider-0').lifetime.promptTokens, 2);
  record(metrics, sample(1, 0), { providerId: 'provider-2' });
  record(metrics, sample(1, 0), { providerId: 'new-provider' });
  assert.equal(metrics.report().providers.length, 128);
  assert.equal(metrics.report().providers.some(item => item.providerId === 'provider-2'), true);
  assert.equal(metrics.report().providers.some(item => item.providerId === 'provider-3'), false);
});

test('session buckets are bounded to 64 and evicted in-flight dimensions stay detached', () => {
  const metrics = new CacheMetrics(() => EPOCH), old = metrics.begin(meta({ sessionTag: 'session-0' }));
  for (let i = 1; i <= 64; i++) record(metrics, sample(1, 0), { sessionTag: 'session-' + i });
  old.complete(observation(sample(1, 0)));
  let p = provider(metrics);
  assert.equal(p.sessions.length, 64); assert.equal(p.sessions.some(item => item.sessionTag === 'session-0'), false);
  assert.equal(p.lifetime.requests, 65); assert.equal(p.models[0]!.counters.requests, 65);
  record(metrics, sample(1, 0), { sessionTag: 'session-0' }); p = provider(metrics);
  assert.equal(p.sessions.length, 64); assert.equal(p.sessions.find(item => item.sessionTag === 'session-0')!.counters.requests, 1);
  assert.equal(p.lifetime.coldRequests, 66);
});

test('model buckets are bounded to 128 and evicted in-flight dimensions stay detached', () => {
  const metrics = new CacheMetrics(() => EPOCH), old = metrics.begin(meta({ modelId: 'model-0' }));
  for (let i = 1; i <= 128; i++) record(metrics, sample(1, 0), { modelId: 'model-' + i });
  old.complete(observation(sample(1, 0)));
  let p = provider(metrics);
  assert.equal(p.models.length, 128); assert.equal(p.models.some(item => item.modelId === 'model-0'), false);
  assert.equal(p.lifetime.requests, 129);
  record(metrics, sample(1, 0), { modelId: 'model-0' }); p = provider(metrics);
  assert.equal(p.models.length, 128); assert.equal(p.models.find(item => item.modelId === 'model-0')!.counters.requests, 1);
});

test('logical operation history is bounded to the most recent 256 tags', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(0, 0), { operationTag: 'operation-0' });
  for (let i = 1; i <= 256; i++) record(metrics, sample(0, 0), { operationTag: 'operation-' + i });
  record(metrics, sample(0, 0), { operationTag: 'operation-0' });
  record(metrics, sample(0, 0), { operationTag: 'operation-256' });
  const c = provider(metrics).lifetime;
  assert.equal(c.requests, 259); assert.equal(c.retryRequests, 1); assert.equal(c.coldRequests, 1);
});

test('metadata is copied on begin and report counter objects are detached snapshots', () => {
  const metrics = new CacheMetrics(() => EPOCH), input = meta(), ticket = metrics.begin(input);
  input.providerId = 'changed'; input.sessionTag = 'changed'; input.modelId = 'changed';
  ticket.complete(observation());
  const first = provider(metrics);
  assert.equal(first.sessions[0]!.sessionTag, 'session-a'); assert.equal(first.models[0]!.modelId, 'model-a');
  first.lifetime.requests = 999; first.recent.cachedTokens = 999;
  first.sessions[0]!.counters.requests = 999; first.models[0]!.recent.cachedTokens = 999;
  const second = provider(metrics);
  assert.equal(second.lifetime.requests, 1); assert.equal(second.recent.cachedTokens, 75);
  assert.equal(second.sessions[0]!.counters.requests, 1); assert.equal(second.models[0]!.recent.cachedTokens, 75);
});

test('reported metadata has bounded identifiers and a restricted purpose label', () => {
  const metrics = new CacheMetrics(() => EPOCH);
  record(metrics, sample(), { providerId: 'p'.repeat(600), modelId: 'm'.repeat(600), profile: 'f'.repeat(300), sessionTag: 's'.repeat(80), operationTag: 'o'.repeat(80), purpose: 'private free text' });
  const p = metrics.report().providers[0]!;
  assert.equal(p.providerId.length, 512); assert.equal(p.models[0]!.modelId.length, 512);
  assert.equal(p.models[0]!.profile.length, 256); assert.equal(p.sessions[0]!.sessionTag!.length, 64);
  assert.equal(p.models[0]!.purpose, 'other'); assert.equal(p.sessions[0]!.purpose, 'other');
});

test('completed observations are copied so caller mutation cannot change recent aggregates', () => {
  const metrics = new CacheMetrics(() => EPOCH), incoming = observation();
  metrics.begin(meta()).complete(incoming);
  incoming.sample!.prompt = 999; incoming.sample!.cached = 999; incoming.state = 'failed'; incoming.malformed = true;
  const p = provider(metrics);
  assert.equal(p.lifetime.promptTokens, 100); assert.equal(p.recent.promptTokens, 100);
  assert.equal(p.recent.cachedTokens, 75); assert.equal(p.recent.invalidUsageRequests, 0);
});

test('timestamps use completion time and legacy summary remains compatible', () => {
  let clock = EPOCH;
  const metrics = new CacheMetrics(() => clock), first = metrics.begin(meta());
  clock += 1000; const second = metrics.begin(meta());
  clock += 1000; second.complete(observation(undefined));
  clock += 1000; first.complete(observation(sample(100, 75)));
  const c = provider(metrics).lifetime;
  assert.equal(c.since, new Date(EPOCH + 2000).toISOString()); assert.equal(c.lastAt, new Date(EPOCH + 3000).toISOString());
  assert.deepEqual(metrics.snapshot(), [{ providerId: 'provider-a', requests: 2, promptTokens: 100, cachedTokens: 75, hitRate: 0.75 }]);
  const unknown = new CacheMetrics(() => EPOCH); unknown.record('provider-a', undefined);
  assert.equal(unknown.snapshot()[0]!.hitRate, 0); assert.equal(provider(unknown).lifetime.hitRate, null);
});
