import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheMetrics } from '../src/host/metrics.js';
import { defaultConfig, publicConfig } from '../src/host/config.js';
import { createPanelApi, projectPanelState } from '../src/client/model.js';
import { combineCounters, projectCacheDiagnostics, projectCacheReport, validCacheDiagnostics, validCacheReport } from '../src/client/cache-model.js';
import type { CacheDiagnosticEntry, CacheDiagnosticsState, PanelState } from '../src/types.js';

const sessionTag = 's-' + 'a'.repeat(24);
function metrics(): CacheMetrics {
  const result = new CacheMetrics(() => 1700000000000);
  const ticket = result.begin({ providerId: 'p', modelId: 'model-a', profile: 'codex-cli/0.107.0', protocol: 'openai-responses', sessionTag, sessionSource: 'host' });
  ticket.complete({ state: 'complete', malformed: false, limitExceeded: false, sample: { prompt: 100, cached: 90, written: 0, cacheReported: true } });
  return result;
}
function entry(): CacheDiagnosticEntry {
  const fingerprint = { tag: 'h-' + 'b'.repeat(24), chars: 15 };
  return { id: 'd-1', time: '2023-11-14T22:13:20.000Z', providerId: 'p', modelId: 'model-a', profile: 'codex-cli/0.107.0', protocol: 'openai-responses', sessionTag, sessionSource: 'host', attempt: 1,
    cacheKeyTag: 'k-' + 'c'.repeat(24), change: 'append', changed: ['append'], messages: 3, previousMessages: 2, sharedMessages: 2, comparable: true,
    system: { ...fingerprint }, tools: { ...fingerprint }, parameters: { ...fingerprint }, outcome: 'success', promptTokens: 100, cachedTokens: 90, writtenTokens: 0, cacheReported: true, hitRate: 0.9 };
}
function diagnostics(): CacheDiagnosticsState { return { enabled: true, maxEntries: 100, maxSessions: 64, keyScope: 'runtime', entries: [entry()] }; }
function panel(): PanelState {
  return { config: publicConfig(defaultConfig()), providers: [], profiles: [], entries: [], runtime: { transport: 'active', detail: 'fixture', registrations: 1, cacheReport: metrics().report(), cacheDiagnostics: diagnostics() } };
}

test('cache client accepts bounded reports produced by the host and retains unknown separately from zero', () => {
  const m = metrics();
  m.begin({ providerId: 'unknown', modelId: 'm', profile: 'p', protocol: 'openai-responses', sessionTag, sessionSource: 'host' })
    .complete({ state: 'complete', malformed: false, limitExceeded: false, sample: { prompt: 20, cached: 0, written: 0, cacheReported: false } });
  const report = m.report();
  assert.equal(validCacheReport(report), true);
  const unknown = projectCacheReport(report).providers.find(p => p.providerId === 'unknown')!.lifetime;
  assert.equal(unknown.hitRate, null); assert.equal(unknown.unknownCacheRequests, 1); assert.equal(unknown.cacheReportedRequests, 0);
});

test('cache client rejects raw session identifiers and invalid counters at every public dimension', () => {
  const original = metrics().report();
  for (const mutate of [
    (r: typeof original) => { r.providers[0]!.latestSessionTag = 'raw-session-id'; },
    (r: typeof original) => { r.providers[0]!.sessions[0]!.sessionTag = 'raw-session-id'; },
    (r: typeof original) => { r.providers[0]!.lifetime.promptTokens = -1; },
    (r: typeof original) => { r.providers[0]!.recent.hitRate = Number.NaN; },
    (r: typeof original) => { r.windowSize = 101; },
  ]) { const changed = structuredClone(original); mutate(changed); assert.equal(validCacheReport(changed), false); }
});

test('cache diagnostic client rejects non-HMAC fingerprints and unknown protocol/change kinds', () => {
  assert.equal(validCacheDiagnostics(diagnostics()), true);
  for (const mutate of [
    (e: CacheDiagnosticEntry) => { e.sessionTag = 'session-private-canary'; },
    (e: CacheDiagnosticEntry) => { e.system.tag = 'plaintext-system-private-canary'; },
    (e: CacheDiagnosticEntry) => { e.cacheKeyTag = 'cache-key-private-canary'; },
    (e: CacheDiagnosticEntry) => { e.firstChangedMessage = 0; },
    (e: CacheDiagnosticEntry) => { e.hitRate = 2; },
  ]) { const changed = diagnostics(); mutate(changed.entries[0]!); assert.equal(validCacheDiagnostics(changed), false); }
  assert.equal(validCacheDiagnostics({ ...diagnostics(), keyScope: 'persistent' }), false);
});

test('cache public projections whitelist nested fields and remove injected raw data', () => {
  const report = metrics().report();
  Object.assign(report, { rawMessages: 'PRIVATE_CANARY' });
  Object.assign(report.providers[0]!, { sessionId: 'PRIVATE_CANARY' });
  Object.assign(report.providers[0]!.sessions[0]!, { requestBody: 'PRIVATE_CANARY' });
  Object.assign(report.providers[0]!.lifetime, { credentials: 'PRIVATE_CANARY' });
  const diag = diagnostics();
  Object.assign(diag.entries[0]!, { endpoint: 'PRIVATE_CANARY', messagesRaw: 'PRIVATE_CANARY', sessionId: 'PRIVATE_CANARY' });
  Object.assign(diag.entries[0]!.system, { text: 'PRIVATE_CANARY' });
  const projected = { report: projectCacheReport(report), diag: projectCacheDiagnostics(diag) };
  assert.equal(JSON.stringify(projected).includes('PRIVATE_CANARY'), false);
  projected.diag.entries[0]!.changed.push('unknown');
  assert.deepEqual(diag.entries[0]!.changed, ['append']);
});

test('cache public projection masks credential-shaped model and profile values', () => {
  const diag = diagnostics();
  diag.entries[0]!.modelId = 'Bearer PRIVATE_CANARY';
  diag.entries[0]!.profile = 'sk-PRIVATE_CANARY';
  assert.equal(JSON.stringify(projectCacheDiagnostics(diag)).includes('PRIVATE_CANARY'), false);
});

test('cache dimension aggregation weights known input tokens rather than averaging percentages', () => {
  const a = metrics().report().providers[0]!.lifetime;
  const b = { ...a, promptTokens: 900, knownPromptTokens: 900, cachedTokens: 90, uncachedTokens: 810, hitRate: 0.1 };
  const result = combineCounters([a, b]);
  assert.equal(result.hitRate, 0.18); assert.equal(result.requests, 2); assert.equal(result.promptTokens, 1000);
  assert.equal(combineCounters([]).hitRate, null);
});

test('cache control RPC replies require state and preserve only the public projected report', async () => {
  for (const request of [{ action: 'cache-reset' }, { action: 'cache-diagnostics', enabled: false }, { action: 'cache-diagnostics-clear', providerId: 'p' }] as const) {
    const state = panel(); Object.assign(state.runtime, { rawSession: 'PRIVATE_CANARY' });
    const api = createPanelApi(async () => new Response(JSON.stringify({ ok: true, state }), { headers: { 'content-type': 'application/json' } }));
    const reply = await api.call(request);
    assert.ok(reply.state); assert.equal(JSON.stringify(reply).includes('PRIVATE_CANARY'), false);
    assert.equal(validCacheReport(reply.state.runtime.cacheReport), true);
  }
});

test('malformed cache reports fail the RPC boundary instead of entering React state', async () => {
  const state = panel(); state.runtime.cacheDiagnostics!.entries[0]!.sessionTag = 'raw-private-session';
  const api = createPanelApi(async () => new Response(JSON.stringify({ ok: true, state })));
  await assert.rejects(api.call({ action: 'state' }), /结构|格式|有效|响应/);
  const safe = projectPanelState(panel()); assert.equal(safe.runtime.cacheDiagnostics!.keyScope, 'runtime');
});
