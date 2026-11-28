import test from 'node:test';
import assert from 'node:assert/strict';
import { PrefixDiagnostics } from '../src/host/diagnostics.js';
import type { CacheDiagnosticEntry, CacheSessionSource, Json, JsonObject, TransformContext, TransformResult } from '../src/types.js';

function context(sessionId = 'session-a', providerId = 'provider-a'): TransformContext {
  return { identity: { providerId, modelId: 'identity-model', sessionId, requestId: 'request-a', url: 'https://relay.invalid/v1/responses', protocol: 'openai-responses' }, rule: { client: 'codex', profile: 'fixture-profile' }, deviceId: 'device-private', accountId: 'account-private' };
}
function body(input: Json[] | string = [{ role: 'user', content: 'hello' }]): JsonObject {
  return { model: 'wire-model', instructions: 'system-v1', input, tools: [{ type: 'function', name: 'read', parameters: { type: 'object' } }], prompt_cache_key: 'key-a', temperature: 0.3 };
}
function request(value = body(), overrides: Partial<TransformResult> = {}): TransformResult {
  return { url: 'https://relay.invalid/v1/responses', method: 'POST', headers: new Headers(), body: value, changed: true, originalProtocol: 'openai-responses', targetProtocol: 'openai-responses', toolNames: {}, profile: 'fixture-profile', ...overrides };
}
function observe(diagnostics: PrefixDiagnostics, result = request(), ctx = context(), meta?: { sessionSource?: CacheSessionSource; purpose?: string }): CacheDiagnosticEntry {
  const entry = diagnostics.observe(result, ctx, meta); assert.ok(entry); return entry;
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
}

test('diagnostics have fixed defaults, runtime scope, and finite option bounds', () => {
  assert.deepEqual(new PrefixDiagnostics().snapshot(), { enabled: true, maxEntries: 100, maxSessions: 64, keyScope: 'runtime', entries: [] });
  const small = new PrefixDiagnostics({ maxEntries: -100, maxSessions: 0, maxMessages: 0 });
  assert.equal(small.snapshot().maxEntries, 1); assert.equal(small.snapshot().maxSessions, 1);
  assert.equal(observe(small, request(body(['a', 'b']))).comparable, false);
  const big = new PrefixDiagnostics({ maxEntries: 1e9, maxSessions: 1e9, maxMessages: 1e9 });
  assert.equal(big.snapshot().maxEntries, 500); assert.equal(big.snapshot().maxSessions, 256);
  assert.equal(observe(big, request(body(Array.from({ length: 8193 }, () => 'a')))).comparable, false);
  const invalid = new PrefixDiagnostics({ maxEntries: NaN, maxSessions: Infinity, maxMessages: NaN });
  assert.equal(invalid.snapshot().maxEntries, 100); assert.equal(invalid.snapshot().maxSessions, 64);
  assert.equal(new PrefixDiagnostics({ maxEntries: 2.9 }).snapshot().maxEntries, 2);
});

test('snapshots contain no private canaries, raw IDs, URL, prompts, tools or parameter values; observing is passive', () => {
  const secrets = ['SESSION_PRIVATE_CANARY', 'REQUEST_PRIVATE_CANARY', 'CACHE_KEY_PRIVATE_CANARY', 'SYSTEM_PRIVATE_CANARY', 'INSTRUCTIONS_PRIVATE_CANARY', 'MESSAGE_PRIVATE_CANARY', 'TOOL_PRIVATE_CANARY', 'ARG_PRIVATE_CANARY', 'PARAM_PRIVATE_CANARY', 'META_PRIVATE_CANARY', 'AUTH_PRIVATE_CANARY', 'QUERY_PRIVATE_CANARY', 'PATH_PRIVATE_CANARY'];
  const ctx = context(secrets[0]); ctx.identity.requestId = secrets[1];
  const value: JsonObject = {
    ...body([{ role: 'user', content: secrets[5], arguments: { key: secrets[7] } }]),
    system: [{ type: 'text', text: secrets[3] }], instructions: secrets[4], prompt_cache_key: secrets[2],
    tools: [{ name: secrets[6], input_schema: { properties: { q: { default: secrets[7] } } } }],
    text: { format: { description: secrets[8] } }, metadata: { nested: secrets[9] }, session_id: secrets[0], request_id: secrets[1],
  };
  const result = request(value, { url: 'https://user:password@relay.invalid/' + secrets[12] + '?token=' + secrets[11] + '#fragment', headers: new Headers({ authorization: secrets[10], 'session-id': secrets[0] }) });
  const before = JSON.stringify(result.body), headers = [...result.headers], url = result.url;
  freeze(result.body); Object.freeze(result);
  const diagnostics = new PrefixDiagnostics(), entry = observe(diagnostics, result, ctx);
  const serialized = JSON.stringify(diagnostics.snapshot());
  for (const secret of secrets) assert.ok(!serialized.includes(secret), secret);
  assert.ok(!serialized.includes('relay.invalid')); assert.ok(!serialized.includes('password'));
  assert.equal(JSON.stringify(result.body), before); assert.deepEqual([...result.headers], headers); assert.equal(result.url, url);
  assert.match(entry.id, /^d-[a-f0-9]+$/); assert.match(entry.sessionTag, /^s-[a-f0-9]{24}$/); assert.match(entry.cacheKeyTag!, /^k-[a-f0-9]{24}$/);
  for (const fingerprint of [entry.system, entry.tools, entry.parameters]) { assert.match(fingerprint.tag, /^h-[a-f0-9]{24}$/); assert.ok(fingerprint.chars > 0); }
  assert.ok(!JSON.stringify(diagnostics).includes(secrets[0]));
});

test('HMAC tags are stable within one runtime, independently keyed across runtimes and domain separated', () => {
  const one = new PrefixDiagnostics(), two = new PrefixDiagnostics();
  assert.equal(one.sessionTag('session-a'), one.sessionTag('session-a'));
  assert.notEqual(one.sessionTag('session-a'), one.sessionTag('session-b'));
  assert.notEqual(one.sessionTag('session-a'), two.sessionTag('session-a'));
  assert.match(one.sessionTag('operation:raw-request-id'), /^s-[a-f0-9]{24}$/);
  const first = observe(one), next = observe(one), other = observe(two);
  assert.equal(first.sessionTag, next.sessionTag); assert.equal(first.system.tag, next.system.tag); assert.equal(first.tools.tag, next.tools.tag);
  assert.equal(first.parameters.tag, next.parameters.tag); assert.equal(first.cacheKeyTag, next.cacheKeyTag);
  assert.notEqual(first.system.tag, other.system.tag); assert.notEqual(first.cacheKeyTag, other.cacheKeyTag);
  assert.notEqual(first.system.tag.slice(2), first.tools.tag.slice(2));
});

test('cold, unchanged, append, history edits and compressed histories have exact shared prefixes', () => {
  const diagnostics = new PrefixDiagnostics();
  const first = observe(diagnostics, request(body(['one', 'two'])));
  assert.equal(first.change, 'cold'); assert.equal(first.attempt, 1); assert.equal(first.messages, 2); assert.equal(first.previousMessages, 0);
  const unchanged = observe(diagnostics, request(body(['one', 'two'])));
  assert.equal(unchanged.change, 'unchanged'); assert.equal(unchanged.sharedMessages, 2); assert.equal(unchanged.firstChangedMessage, undefined);
  const append = observe(diagnostics, request(body(['one', 'two', 'three'])));
  assert.equal(append.change, 'append'); assert.equal(append.sharedMessages, 2); assert.equal(append.previousMessages, 2); assert.equal(append.messages, 3);
  const edit = observe(diagnostics, request(body(['one', 'edited', 'three'])));
  assert.equal(edit.change, 'history'); assert.equal(edit.sharedMessages, 1); assert.equal(edit.firstChangedMessage, 2);
  const compressed = observe(diagnostics, request(body(['one'])));
  assert.equal(compressed.change, 'history'); assert.equal(compressed.sharedMessages, 1); assert.equal(compressed.firstChangedMessage, 2);
  assert.equal(compressed.attempt, 5); assert.equal(compressed.comparable, true);
});

test('string input is one message and message order or nested tool arguments remain observable only as hashes', () => {
  const diagnostics = new PrefixDiagnostics();
  assert.equal(observe(diagnostics, request(body('one'))).messages, 1);
  assert.equal(observe(diagnostics, request(body('one'))).change, 'unchanged');
  const edit = observe(diagnostics, request(body('two'))); assert.equal(edit.change, 'history'); assert.equal(edit.firstChangedMessage, 1);
  const messages: Json[] = [{ type: 'function_call', arguments: '{"x":"one"}' }, { type: 'function_call_output', output: 'output' }];
  observe(diagnostics, request(body(messages)));
  const changed = observe(diagnostics, request(body([{ type: 'function_call', arguments: '{"x":"two"}' }, messages[1]])));
  assert.equal(changed.change, 'history'); assert.equal(changed.firstChangedMessage, 1);
  const reordered = observe(diagnostics, request(body([...messages].reverse())));
  assert.equal(reordered.change, 'history'); assert.equal(reordered.sharedMessages, 0);
});

test('JSON object field order is retained for tool schemas and message fingerprints', () => {
  const diagnostics = new PrefixDiagnostics();
  const first = body([{ role: 'user', content: 'hello' }]);
  first.tools = [{ name: 'read', parameters: { type: 'object', properties: { x: { type: 'string' } } } }];
  observe(diagnostics, request(first));
  const reorderedTool = { ...first, tools: [{ name: 'read', parameters: { properties: { x: { type: 'string' } }, type: 'object' } }] };
  assert.equal(observe(diagnostics, request(reorderedTool)).change, 'tools');
  const reorderedMessage = { ...reorderedTool, input: [{ content: 'hello', role: 'user' }] };
  const changed = observe(diagnostics, request(reorderedMessage));
  assert.equal(changed.change, 'history'); assert.equal(changed.firstChangedMessage, 1);
});

test('system, tools, cache key and parameters change independently, with early components first', () => {
  const diagnostics = new PrefixDiagnostics(); observe(diagnostics);
  const system = body(); system.instructions = 'system-v2';
  assert.equal(observe(diagnostics, request(system)).change, 'system');
  const tools = { ...system, tools: [{ name: 'changed-tool' }] };
  assert.equal(observe(diagnostics, request(tools)).change, 'tools');
  const key = { ...tools, prompt_cache_key: 'key-b' };
  assert.equal(observe(diagnostics, request(key)).change, 'cache-key');
  const parameters = { ...key, temperature: 0.9, reasoning: { effort: 'high' } };
  assert.equal(observe(diagnostics, request(parameters)).change, 'parameters');
  const all = { ...parameters, instructions: 'system-v3', tools: [], temperature: 0.5, input: ['changed-history'] };
  const entry = observe(diagnostics, request(all));
  assert.equal(entry.change, 'system'); assert.deepEqual(entry.changed, ['system', 'tools', 'parameters', 'history']);
  assert.equal(entry.firstChangedMessage, 1);
});

test('chat and Responses system/developer items participate in the system component', () => {
  for (const protocol of ['openai-chat-completions', 'openai-responses'] as const) {
    for (const role of ['system', 'developer']) {
      const diagnostics = new PrefixDiagnostics(), key = protocol === 'openai-responses' ? 'input' : 'messages';
      const value: JsonObject = { model: 'wire-model', [key]: [{ role, content: 'policy-a' }, { role: 'user', content: 'hello' }] };
      observe(diagnostics, request(value, { targetProtocol: protocol }));
      const next = structuredClone(value); (next[key] as JsonObject[])[0].content = 'policy-b';
      const entry = observe(diagnostics, request(next, { targetProtocol: protocol }));
      assert.equal(entry.change, 'system'); assert.ok(entry.changed.includes('history')); assert.equal(entry.firstChangedMessage, 1);
    }
  }
  const diagnostics = new PrefixDiagnostics(), original = body(); original.system = [{ type: 'text', text: 'one' }];
  observe(diagnostics, request(original)); original.system = [{ type: 'text', text: 'two' }];
  assert.equal(observe(diagnostics, request(original)).change, 'system');
});

test('wire model wins over identity model and model changes stay within the same session baseline', () => {
  const diagnostics = new PrefixDiagnostics(), first = observe(diagnostics);
  assert.equal(first.modelId, 'wire-model');
  const model = body(); model.model = 'other-wire-model';
  const changed = observe(diagnostics, request(model));
  assert.equal(changed.change, 'model'); assert.equal(changed.sessionTag, first.sessionTag); assert.equal(changed.attempt, 2);
  delete model.model;
  const fallback = observe(diagnostics, request(model)); assert.equal(fallback.modelId, 'identity-model'); assert.equal(fallback.change, 'model');
});

test('profile, target protocol and endpoint changes are distinct, and only origin/path affect endpoint', () => {
  const diagnostics = new PrefixDiagnostics(); observe(diagnostics);
  assert.equal(observe(diagnostics, request(body(), { url: 'https://user:password@relay.invalid/v1/responses?token=private#x' })).change, 'unchanged');
  assert.equal(observe(diagnostics, request(body(), { url: 'https://relay.invalid/v2/responses' })).change, 'endpoint');
  assert.equal(observe(diagnostics, request(body(), { url: 'https://other.invalid/v2/responses' })).change, 'endpoint');
  assert.equal(observe(diagnostics, request(body(), { profile: 'other-profile' })).change, 'profile');
  assert.equal(observe(diagnostics, request(body(), { profile: 'other-profile', targetProtocol: 'anthropic-messages' })).change, 'protocol');
  const ctx = context(); ctx.rule.client = 'claude-code';
  assert.equal(observe(diagnostics, request(body(), { profile: 'other-profile', targetProtocol: 'anthropic-messages' }), ctx).change, 'profile');
});

test('excluded metadata and correlation IDs never create parameter changes; remaining fields do', () => {
  const diagnostics = new PrefixDiagnostics(), initial = body();
  initial.metadata = { id: 'private-a' }; initial.session = 'private-a'; initial.requestId = 'private-a';
  observe(diagnostics, request(initial));
  const next: JsonObject = { ...initial, metadata: { id: 'private-b' }, session: 'private-b', requestId: 'private-b', session_id: 'changed', request_id: 'changed' };
  assert.equal(observe(diagnostics, request(next)).change, 'unchanged');
  next.metadata = { entirely: 'different' };
  const withControl = { ...next, prompt_cache_retention: '24h' };
  assert.equal(observe(diagnostics, request(withControl)).change, 'parameters');
});

test('session and provider baselines isolate requests and attempt numbers count HTTP retries', () => {
  const diagnostics = new PrefixDiagnostics();
  const a = observe(diagnostics, request(), context('one', 'provider-a'));
  const b = observe(diagnostics, request(body(['different'])), context('two', 'provider-a'));
  const other = observe(diagnostics, request(body(['other-provider'])), context('one', 'provider-b'));
  assert.equal(a.change, 'cold'); assert.equal(b.change, 'cold'); assert.equal(other.change, 'cold');
  assert.notEqual(a.sessionTag, b.sessionTag); assert.equal(a.sessionTag, other.sessionTag);
  const retryContext = context('one', 'provider-a'); retryContext.identity.requestId = 'same-logical-request-id';
  const retry = observe(diagnostics, request(), retryContext);
  assert.equal(retry.change, 'unchanged'); assert.equal(retry.attempt, 2);
  assert.equal(observe(diagnostics, request(), retryContext).attempt, 3);
});

test('fallback source is explicit and unsafe purpose values are reduced to other', () => {
  const diagnostics = new PrefixDiagnostics();
  const fallback = observe(diagnostics, request(), context('fallback-operation'), { sessionSource: 'fallback', purpose: 'agent/main' });
  assert.equal(fallback.sessionSource, 'fallback'); assert.equal(fallback.purpose, 'agent/main');
  const other = observe(diagnostics, request(), context(), { purpose: 'private purpose with content' });
  assert.equal(other.sessionSource, 'host'); assert.equal(other.purpose, 'other');
  const missing = observe(diagnostics, request(), context(''));
  assert.equal(missing.sessionSource, 'fallback'); assert.equal(missing.comparable, false); assert.ok(missing.changed.includes('unknown'));
});

test('truncated histories never claim unchanged or append, including the first request after recovery', () => {
  const diagnostics = new PrefixDiagnostics({ maxMessages: 2 });
  observe(diagnostics, request(body(['one', 'two'])));
  const overflow = observe(diagnostics, request(body(['one', 'two', 'three'])));
  assert.equal(overflow.change, 'unknown'); assert.equal(overflow.comparable, false); assert.equal(overflow.messages, 3); assert.equal(overflow.sharedMessages, 0);
  assert.equal(observe(diagnostics, request(body(['one', 'two', 'changed-beyond-limit']))).change, 'unknown');
  const recovered = observe(diagnostics, request(body(['one', 'two'])));
  assert.equal(recovered.change, 'unknown'); assert.equal(recovered.comparable, false);
  assert.equal(observe(diagnostics, request(body(['one', 'two']))).change, 'unchanged');
});

test('deep, oversize, cyclic, accessor and unsupported inputs produce incomparable records without leaking or invoking accessors', () => {
  const values: JsonObject[] = [];
  let deep: Json = 'leaf'; for (let i = 0; i < 70; i++) deep = { nested: deep };
  values.push({ ...body(), text: deep }, body(['PRIVATE_OVERFLOW_' + 'x'.repeat(4 * 1024 * 1024)]));
  const cyclic = body(); cyclic.cycle = cyclic; values.push(cyclic);
  const accessor = body(); Object.defineProperty(accessor, 'text', { enumerable: true, get() { throw new Error('PRIVATE_ACCESSOR_CALLED'); } }); values.push(accessor);
  values.push({ ...body(), input: { unexpected: 'PRIVATE_UNSUPPORTED_INPUT' } });
  for (const value of values) {
    const diagnostics = new PrefixDiagnostics();
    assert.doesNotThrow(() => observe(diagnostics, request(value)));
    const entry = observe(diagnostics, request(value));
    assert.equal(entry.comparable, false); assert.ok(entry.changed.includes('unknown'));
    assert.ok(!entry.changed.includes('unchanged')); assert.ok(!entry.changed.includes('append'));
    for (const canary of ['PRIVATE_OVERFLOW', 'PRIVATE_ACCESSOR', 'PRIVATE_UNSUPPORTED_INPUT']) assert.ok(!JSON.stringify(diagnostics.snapshot()).includes(canary));
  }
  const diagnostics = new PrefixDiagnostics(); observe(diagnostics);
  assert.equal(observe(diagnostics, request(body(), { url: 'invalid-url' })).comparable, false);
});

test('LRU sessions and entry limits are independent and evicted completions are ignored', () => {
  const diagnostics = new PrefixDiagnostics({ maxEntries: 2, maxSessions: 2 });
  const a = observe(diagnostics, request(), context('a'));
  observe(diagnostics, request(), context('b'));
  assert.equal(observe(diagnostics, request(), context('a')).change, 'unchanged');
  assert.equal(diagnostics.snapshot().entries.length, 2);
  observe(diagnostics, request(), context('c'));
  assert.equal(observe(diagnostics, request(), context('a')).change, 'unchanged');
  const b = observe(diagnostics, request(), context('b'));
  assert.equal(b.change, 'cold'); assert.equal(b.attempt, 1);
  diagnostics.complete(a.id, { outcome: 'success', promptTokens: 100 });
  assert.equal(diagnostics.snapshot().entries.length, 2); assert.ok(diagnostics.snapshot().entries.every(entry => entry.promptTokens === undefined));
});

test('disabling stops observations and late completions; re-enabling starts cold with retained redacted records', () => {
  const diagnostics = new PrefixDiagnostics(); const before = observe(diagnostics);
  diagnostics.setEnabled(false);
  assert.equal(diagnostics.observe(request(), context()), undefined);
  diagnostics.complete(before.id, { outcome: 'success', promptTokens: 100 });
  assert.equal(diagnostics.snapshot().entries.length, 1); assert.equal(diagnostics.snapshot().entries[0].outcome, undefined);
  diagnostics.setEnabled(true);
  assert.equal(observe(diagnostics).change, 'cold'); assert.equal(diagnostics.snapshot().entries[0].attempt, 1);
  diagnostics.complete(before.id, { outcome: 'success' });
  assert.equal(diagnostics.snapshot().entries[1].outcome, undefined);
  diagnostics.setEnabled(true); assert.equal(observe(diagnostics).change, 'unchanged');
  const disabled = new PrefixDiagnostics({ enabled: false }); assert.equal(disabled.observe(request(), context()), undefined); disabled.setEnabled(true); assert.equal(observe(disabled).change, 'cold');
});

test('provider clear removes matching records and baselines, global clear also fences late completions', () => {
  const diagnostics = new PrefixDiagnostics();
  const a = observe(diagnostics, request(), context('a', 'provider-a'));
  observe(diagnostics, request(), context('a', 'provider-b'));
  diagnostics.clear('provider-a'); assert.equal(diagnostics.snapshot().entries.length, 1); assert.equal(diagnostics.snapshot().entries[0].providerId, 'provider-b');
  assert.equal(observe(diagnostics, request(), context('a', 'provider-b')).change, 'unchanged');
  assert.equal(observe(diagnostics, request(), context('a', 'provider-a')).change, 'cold');
  diagnostics.complete(a.id, { outcome: 'success' }); assert.ok(diagnostics.snapshot().entries.every(entry => entry.outcome === undefined));
  const stale = observe(diagnostics); diagnostics.clear(); assert.deepEqual(diagnostics.snapshot().entries, []);
  const fresh = observe(diagnostics); assert.notEqual(fresh.id, stale.id); assert.equal(fresh.change, 'cold');
  diagnostics.complete(stale.id, { outcome: 'success' }); assert.equal(diagnostics.snapshot().entries[0].outcome, undefined);
  const longProvider = 'provider-' + 'x'.repeat(600); observe(diagnostics, request(), context('long', longProvider)); diagnostics.clear(longProvider);
  assert.equal(diagnostics.snapshot().entries.some(entry => entry.providerId.length === 512), false);
});

test('observe and snapshot return deep copies of public records', () => {
  const diagnostics = new PrefixDiagnostics(), returned = observe(diagnostics);
  returned.system.tag = 'changed'; returned.changed.push('unknown');
  const view = diagnostics.snapshot(); view.entries[0].tools.chars = 999; view.entries[0].changed.push('unknown'); view.entries.length = 0;
  const fresh = diagnostics.snapshot(); assert.equal(fresh.entries.length, 1); assert.notEqual(fresh.entries[0].system.tag, 'changed'); assert.notEqual(fresh.entries[0].tools.chars, 999); assert.deepEqual(fresh.entries[0].changed, ['cold']);
  assert.equal(observe(diagnostics).change, 'unchanged');
});

test('complete attaches normalized usage once and keeps invalid or unknown fields out of snapshots', () => {
  const diagnostics = new PrefixDiagnostics(), entry = observe(diagnostics);
  diagnostics.complete(entry.id, { outcome: 'success', promptTokens: 200, cachedTokens: 120, writtenTokens: 30, cacheReported: true, hitRate: 0.6 });
  const complete = diagnostics.snapshot().entries[0];
  assert.equal(complete.outcome, 'success'); assert.equal(complete.promptTokens, 200); assert.equal(complete.cachedTokens, 120); assert.equal(complete.writtenTokens, 30); assert.equal(complete.cacheReported, true); assert.equal(complete.hitRate, 0.6);
  diagnostics.complete(entry.id, { outcome: 'stream-error', promptTokens: 1 }); assert.deepEqual(diagnostics.snapshot().entries[0], complete);
  const unknown = observe(diagnostics); diagnostics.complete(unknown.id, { outcome: 'cancelled', cacheReported: false, hitRate: null });
  assert.equal(diagnostics.snapshot().entries[0].hitRate, null); assert.equal(diagnostics.snapshot().entries[0].promptTokens, undefined);
  const invalid = observe(diagnostics); diagnostics.complete(invalid.id, { outcome: 'http-error', promptTokens: -1, cachedTokens: NaN, writtenTokens: Infinity, hitRate: 2 });
  const last = diagnostics.snapshot().entries[0]; assert.equal(last.outcome, 'http-error'); assert.equal(last.promptTokens, undefined); assert.equal(last.cachedTokens, undefined); assert.equal(last.writtenTokens, undefined); assert.equal(last.hitRate, undefined);
});
