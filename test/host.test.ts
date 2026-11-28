import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { once } from 'node:events';
import { defaultConfig, ConfigStore, publicConfig, validateRule, RpcError } from '../src/host/config.js';
import { PanelController, createApiHandler } from '../src/host/api.js';
import { discoverProviders } from '../src/host/providers.js';
import { RequestListener } from '../src/host/listener.js';
import { installTransport, detectProtocol } from '../src/host/transport.js';
import { ProviderLimiter } from '../src/host/limiter.js';
import type { TransportLease, TransportScope } from '../src/host/transport.js';
import type { LlmDirectory, SettingsHost, SettingsDescriptor } from '../src/host/contracts.js';
import { API_PATH, SETTINGS_NS } from '../src/types.js';
import type { JsonObject, PluginConfig, ProviderRule, TransformResult } from '../src/types.js';

class FakeSettings implements SettingsHost {
  writable = true;
  docs: SettingsDescriptor[];
  writes: { ns: string; value: unknown; expected: number | undefined }[] = [];
  described = 0;
  beforeWrite?: () => void;
  constructor(config = defaultConfig(), readonly ns = SETTINGS_NS) {
    this.docs = [{ ns, revision: 7, value: { config } }, { ns: 'native-adapter', revision: 91, value: { channels: { a: { baseURL: 'https://upstream.invalid/proxy/v1?token=secret-query', api: 'openai-responses', apiKey: 'secret-native-key' }, b: { baseURL: 'https://other.invalid/v1', api: 'anthropic-messages' } } } }];
  }
  describe(_options?: { redactSecrets?: boolean }): SettingsDescriptor[] { this.described++; return structuredClone(this.docs); }
  configure(): () => void { return () => {}; }
  async replace(ns: string, value: unknown, expected?: number): Promise<void> {
    this.beforeWrite?.();
    const row = this.docs.find(x => x.ns === ns)!;
    if (row.revision !== expected) throw Object.assign(new Error('settings changed'), { name: 'SettingsConflictError' });
    this.writes.push({ ns, value: structuredClone(value), expected }); row.value = structuredClone(value); row.revision++;
  }
}
const llm: LlmDirectory = {
  listProviders: () => [{ id: 'a', name: '供应商 A' }, { id: 'b', name: '供应商 B' }, { id: 'native', name: '原生供应商' }, { id: 'deepseek-official', name: 'DeepSeek' }],
  listConfigurableProviders: () => [...['a', 'b'].map(provider => ({ provider, settingsNs: 'native-adapter', settingsPath: ['channels', provider] })), { provider: 'deepseek-official', settingsNs: 'llm-deepseek', settingsPath: ['channels', 'deepseek'] }],
  listModels: async id => id === 'b' ? Promise.reject(new Error('catalogue unavailable')) : [{ id: 'model-' + id }, { id: 'model-' + id }],
};
function setup(config = defaultConfig(), ns = SETTINGS_NS) {
  const settings = new FakeSettings(config, ns), store = new ConfigStore(settings, undefined, ns), listener = new RequestListener();
  const controller = new PanelController(store, llm, settings, listener, () => ({ transport: 'active', detail: 'fixture', registrations: 1 }));
  return { settings, store, listener, controller };
}
function scope(providerId = 'a', client: ProviderRule['client'] = 'claude-code', listener = new RequestListener()): TransportScope {
  return { identity: { providerId, modelId: 'model-' + providerId, sessionId: '3f263161-d383-4d6b-a183-14c8465b0ef4', requestId: '339c24fb-e41a-49df-a961-4e069aa4e751' }, rule: { client, ...(client === 'claude-code' ? { profile: 'claude-code/2.1.63' } : {}) }, deviceId: 'a'.repeat(64), accountId: 'a6f4a739-a8b6-4bca-b74d-dfbe39c7bc6f', record: (r, c) => listener.record(r, c), onError: () => {} };
}
const chat = (model = 'model-a'): JsonObject => ({ model, messages: [{ role: 'system', content: 'PROJECT_PRIVATE_INSTRUCTIONS' }, { role: 'user', content: '用户原始文字：proxy_read 与日期 2026-11-25 保持原样。' }], max_tokens: 256 });
const anthropicReply: JsonObject = { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'model-a', content: [{ type: 'text', text: 'capture-ok' }], stop_reason: 'end_turn', usage: { input_tokens: 9, output_tokens: 2 } };
const responsesReply: JsonObject = { id: 'resp_fixture', object: 'response', status: 'completed', model: 'model-b', output: [{ id: 'm1', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'responses-ok', annotations: [] }] }], usage: { input_tokens: 9, output_tokens: 2, total_tokens: 11 } };
const chatReply: JsonObject = { id: 'chat_fixture', object: 'chat.completion', model: 'model-native', choices: [{ index: 0, message: { role: 'assistant', content: 'native-ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 } };
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
async function withTransport(fn: (lease: TransportLease) => Promise<void>, fixture: typeof fetch): Promise<void> {
  const original = globalThis.fetch; globalThis.fetch = fixture; const lease = installTransport();
  try { await fn(lease); } finally { lease.release(); globalThis.fetch = original; }
}
async function values<T>(iterable: AsyncIterable<T>): Promise<T[]> { const out: T[] = []; for await (const x of iterable) out.push(x); return out; }
async function serve(handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>): Promise<{ server: Server; base: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => { void Promise.resolve(handler(req, res)).catch(error => { res.statusCode = 500; res.end(String(error)); }); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { server, base: 'http://127.0.0.1:' + address.port, close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) };
}

test('default identity is stable and independent; public view masks private identity and connection', () => {
  const cfg = defaultConfig(); cfg.providers.a = { client: 'claude-code', baseUrl: 'https://fixture.invalid/v1?token=secret-query', overrides: { accountId: cfg.identity.accountId, deviceId: cfg.identity.deviceId } };
  assert.match(cfg.identity.deviceId, /^[a-f0-9]{64}$/); assert.match(cfg.identity.accountId, /^[a-f0-9-]{36}$/);
  const view = publicConfig(cfg); assert.equal(view.identity.deviceId, '[redacted]'); assert.equal(view.identity.accountId, '[redacted]');
  assert.equal(view.providers.a.baseUrl, undefined); assert.equal(view.providers.a.overrides?.deviceId, undefined); assert.notEqual(cfg.identity.deviceId, view.identity.deviceId);
  assert.equal(cfg.providers.a.baseUrl, 'https://fixture.invalid/v1?token=secret-query');
});
test('provider save only writes own entry id and preserves other suppliers and private native fields', async () => {
  const cfg = defaultConfig(); cfg.providers.a = { client: 'claude-code', baseUrl: 'https://fixture.invalid/v1', overrides: { accountId: cfg.identity.accountId, deviceId: cfg.identity.deviceId } }; cfg.providers.b = { client: 'none' };
  const { settings, store } = setup(cfg, 'bundle-generated-id'); const native = structuredClone(settings.docs[1]); const identity = structuredClone(cfg.identity);
  await store.saveProvider('a', { client: 'codex', modelIds: ['model-a'] }, 0);
  const current = store.snapshot(); assert.equal(current.providers.a.client, 'codex'); assert.equal(current.providers.a.baseUrl, cfg.providers.a.baseUrl); assert.equal(current.providers.a.overrides?.accountId, identity.accountId);
  assert.deepEqual(current.providers.b, { client: 'none' }); assert.deepEqual(current.identity, identity); assert.deepEqual(settings.docs[1], native);
  assert.equal(settings.writes.length, 1); assert.equal(settings.writes[0].ns, 'bundle-generated-id'); assert.equal(settings.writes[0].expected, 7);
});
test('concurrent stale saves conflict rather than losing an earlier provider write', async () => {
  const { store } = setup(); const result = await Promise.allSettled([store.saveProvider('a', { client: 'codex' }, 0), store.saveProvider('b', { client: 'claude-code' }, 0)]);
  assert.equal(result[0].status, 'fulfilled'); assert.equal(result[1].status, 'rejected');
  if (result[1].status === 'rejected') assert.equal((result[1].reason as RpcError).code, 'REVISION_CONFLICT');
  assert.equal(store.snapshot().revision, 1); assert.equal(store.snapshot().providers.b, undefined);
});
test('actual SettingsConflictError during commit is translated to revision conflict and never overwritten', async () => {
  const { store, settings } = setup(); settings.beforeWrite = () => { settings.docs[0].revision++; (settings.docs[0].value as { config: PluginConfig }).config.providers.b = { client: 'none' }; };
  await assert.rejects(store.saveProvider('a', { client: 'codex' }, 0), (e: unknown) => e instanceof RpcError && e.code === 'REVISION_CONFLICT' && e.status === 409);
  assert.equal(settings.writes.length, 0); assert.deepEqual(store.snapshot().providers.b, { client: 'none' });
});
test('readonly settings and missing namespace produce actionable errors without native writes', async () => {
  const { store, settings } = setup(); settings.writable = false;
  await assert.rejects(store.saveProvider('a', { client: 'none' }, 0), (e: unknown) => e instanceof RpcError && e.code === 'READ_ONLY');
  settings.writable = true; settings.docs = settings.docs.filter(x => x.ns !== SETTINGS_NS);
  await assert.rejects(store.saveProvider('a', { client: 'codex' }, 0), (e: unknown) => e instanceof RpcError && e.code === 'SETTINGS_NOT_READY');
  assert.equal(settings.writes.length, 0);
});
test('rule validation rejects identity header credential suffixes and permits legitimate session identities', () => {
  for (const header of ['authorization', 'cookie', 'x-stainless-api-key', 'x-codex-device-id', 'x-codex-access-token', 'x-stainless-authentication']) {
    assert.throws(() => validateRule({ client: 'claude-code', overrides: { extraHeaders: { [header]: 'secret' } } }), (e: unknown) => e instanceof RpcError && e.code === 'INVALID_HEADERS');
  }
  for (const header of ['x-client-request-id', 'x-claude-code-session-id', 'session_id']) assert.equal(validateRule({ client: 'claude-code', overrides: { extraHeaders: { [header]: 'fixture' } } }).overrides?.extraHeaders?.[header], 'fixture');
  assert.throws(() => validateRule({ client: 'codex', overrides: { extraHeaders: { originator: 'line\r\ninjected' } } }));
  assert.throws(() => validateRule({ client: 'codex', profile: 'claude-code-2.1.63' }));
});
test('discovery uses configured provider ids, masks URL queries, deduplicates models, and tolerates failed catalogue', async () => {
  const { settings } = setup(); const providers = await discoverProviders(llm, settings);
  assert.equal(providers.length, 3); assert.ok(!providers.some(x => x.id === 'deepseek-official'), 'official DeepSeek providers are hidden from the panel'); const a = providers.find(x => x.id === 'a')!; assert.equal(a.baseUrl, 'https://upstream.invalid/proxy/v1'); assert.equal(a.protocol, 'openai-responses'); assert.deepEqual(a.modelIds, ['model-a']);
  assert.deepEqual(providers.find(x => x.id === 'b')!.modelIds, []); assert.ok(!JSON.stringify(providers).includes('secret-native-key')); assert.ok(!JSON.stringify(providers).includes('secret-query'));
});
test('panel saves current supplier only; removed suppliers remain blocked and drafts survive conflicts', async () => {
  const { controller, store } = setup(); await controller.call({ action: 'save', providerId: 'a', rule: { client: 'codex' }, revision: 0 });
  assert.equal(store.snapshot().providers.a.client, 'codex'); await assert.rejects(controller.call({ action: 'save', providerId: 'a', rule: { client: 'none' }, revision: 0 }), (e: unknown) => e instanceof RpcError && e.status === 409);
  await assert.rejects(controller.call({ action: 'save', providerId: 'removed', rule: { client: 'codex' }, revision: 1 }), (e: unknown) => e instanceof RpcError && e.code === 'UNKNOWN_PROVIDER');
  await controller.call({ action: 'listener', enabled: true, revision: 1 }); assert.equal(store.snapshot().listener.enabled, true);
  assert.deepEqual(await controller.call({ action: 'logs' }), { ok: true, entries: [] });
  await controller.call({ action: 'clear' }); assert.equal(store.snapshot().revision, 2);
});
test('protocol routing recognizes only generation endpoints', () => {
  assert.equal(detectProtocol('https://fixture.invalid/prefix/v1/messages?beta=true'), 'anthropic-messages'); assert.equal(detectProtocol('https://fixture.invalid/prefix/v1/responses/'), 'openai-responses');
  assert.equal(detectProtocol('https://fixture.invalid/v1/chat/completions'), 'openai-chat-completions'); assert.equal(detectProtocol('https://fixture.invalid/v1/files'), undefined); assert.equal(detectProtocol('https://fixture.invalid/oauth/token'), undefined);
});
test('outside scope and None calls pass the exact native input/init without touching getters', async () => {
  let calls = 0; const input = new URL('https://fixture.invalid/v1/chat/completions');
  const init: RequestInit = Object.defineProperties({}, { body: { get: () => { throw new Error('BODY_READ'); } }, headers: { get: () => { throw new Error('HEADERS_READ'); } } });
  await withTransport(async lease => {
    await fetch(input, init); const native = { async *[Symbol.asyncIterator]() { yield 1; } };
    assert.equal(lease.bypass(() => native), native);
    await lease.run(scope('native', 'none'), () => fetch(input, { method: 'POST', body: 'untouched' }));
  }, (async (u, options) => { if (!calls) { assert.equal(u, input); assert.equal(options, init); } calls++; return jsonResponse(chatReply); }) as typeof fetch);
  assert.equal(calls, 2);
});
test('enabled non-generation and wrong-base calls bypass body and header access', async () => {
  let calls = 0; const init = { method: 'POST' } as RequestInit;
  Object.defineProperties(init, { body: { get: () => { throw new Error('BODY_READ'); } }, headers: { get: () => { throw new Error('HEADERS_READ'); } } });
  await withTransport(async lease => {
    const s = scope(); s.rule.baseUrl = 'https://fixture.invalid/v1';
    await lease.run(s, () => fetch('https://fixture.invalid/oauth/token', init)); await lease.run(s, () => fetch('https://other.invalid/v1/messages', init));
  }, (async () => { calls++; return jsonResponse({ ok: true }); }) as typeof fetch);
  assert.equal(calls, 2);
});
test('transformation is atomic; malformed JSON is not partially forwarded', async () => {
  let calls = 0; const errors: string[] = [];
  await withTransport(async lease => { const s = scope(); s.onError = code => errors.push(code);
    await assert.rejects(lease.run(s, () => fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: '{bad-json' })));
  }, (async () => { calls++; return jsonResponse({}); }) as typeof fetch);
  assert.equal(calls, 0); assert.deepEqual(errors, ['INVALID_JSON_BODY']);
});
test('Claude conversion preserves input and auth, transforms headers/body together, and returns native response shape', async () => {
  const captured: { url: string; init: RequestInit }[] = [], original = chat(), before = structuredClone(original), headers = new Headers({ authorization: 'Bearer FIXTURE_KEY', 'user-agent': 'native-client', 'x-stainless-helper-method': 'removed', 'content-length': '999' });
  await withTransport(async lease => {
    const result = await lease.run(scope(), () => fetch('https://fixture.invalid/proxy/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(original) })); const data = await result.json() as { choices: { message: { content: string } }[] };
    assert.equal(data.choices[0].message.content, 'capture-ok');
  }, (async (url, init) => { captured.push({ url: String(url), init: init! }); return jsonResponse(anthropicReply); }) as typeof fetch);
  const item = captured[0]; assert.equal(item.url, 'https://fixture.invalid/proxy/v1/messages'); const outHeaders = new Headers(item.init.headers);
  assert.equal(outHeaders.get('authorization'), 'Bearer FIXTURE_KEY'); assert.match(outHeaders.get('user-agent')!, /^claude-cli\/.+ \(external, cli\)$/); assert.equal(outHeaders.get('x-stainless-helper-method'), null); assert.equal(outHeaders.get('content-length'), null);
  const body = JSON.parse(String(item.init.body)) as { system: { text: string; cache_control?: { ttl: string } }[]; messages: unknown[]; metadata: { user_id: string } };
  assert.match(body.system[0].text, /^x-anthropic-billing-header:/); assert.ok(body.system[1].text.includes('Claude')); assert.ok(body.system.some(x => x.cache_control?.ttl === '1h')); assert.ok(body.system.some(x => x.text === 'PROJECT_PRIVATE_INSTRUCTIONS'));
  assert.match(body.metadata.user_id, /user_.+_account_[a-f0-9-]+_session_[a-f0-9-]+/); assert.deepEqual(original, before); assert.equal(headers.get('user-agent'), 'native-client'); assert.ok(JSON.stringify(body.messages).includes(String((original.messages as JsonObject[])[1].content)));
});
test('outgoing tool name is restored to executor namespace while argument data remains unchanged', async () => {
  const body = chat(); body.tools = [{ type: 'function', function: { name: 'proxy_read', description: 'read', parameters: { type: 'object' } } }];
  await withTransport(async lease => {
    const response = await lease.run(scope(), () => fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(body) }));
    const data = await response.json() as { choices: { message: { tool_calls: { function: { name: string; arguments: string } }[] } }[] };
    const fn = data.choices[0].message.tool_calls[0].function; assert.equal(fn.name, 'proxy_read'); assert.deepEqual(JSON.parse(fn.arguments), { name: 'proxy_read business-data' });
  }, (async (_url, init) => { const outgoing = JSON.parse(String(init?.body)) as { tools: { name: string }[] }; assert.equal(outgoing.tools[0].name, 'read'); return jsonResponse({ ...anthropicReply, content: [{ type: 'tool_use', id: 'call1', name: 'read', input: { name: 'proxy_read business-data' } }], stop_reason: 'tool_use' }); }) as typeof fetch);
});
test('Request inputs preserve signal, redirect and credentials without consuming original body', async () => {
  const controller = new AbortController(); const request = new Request('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(chat()), signal: controller.signal, credentials: 'include', redirect: 'manual' }); let seen: RequestInit | undefined;
  await withTransport(async lease => { await lease.run(scope(), () => fetch(request)); assert.equal(request.bodyUsed, false); }, (async (_url, init) => { seen = init; return jsonResponse(anthropicReply); }) as typeof fetch);
  assert.equal(seen?.signal, request.signal); assert.equal(seen?.credentials, 'include'); assert.equal(seen?.redirect, 'manual');
});
test('async generators bind factory, iteration and concurrent supplier scopes', async () => {
  const calls: { model: string; ua: string }[] = [];
  await withTransport(async lease => {
    const create = (id: string, client: ProviderRule['client']) => lease.bind(scope(id, client), () => ({ async *[Symbol.asyncIterator]() { await Promise.resolve(); const res = await fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(chat('model-' + id)) }); yield await res.json(); } }));
    await Promise.all([values(create('a', 'claude-code')), values(create('b', 'codex'))]);
  }, (async (url, init) => { const body = JSON.parse(String(init?.body)) as { model: string }; calls.push({ model: body.model, ua: new Headers(init?.headers).get('user-agent')! }); return jsonResponse(String(url).endsWith('/messages') ? anthropicReply : responsesReply); }) as typeof fetch);
  assert.equal(calls.length, 2); assert.match(calls.find(x => x.model === 'model-a')!.ua, /^claude-cli\//); assert.match(calls.find(x => x.model === 'model-b')!.ua, /^codex/);
});
test('nested None generator escapes outer enabled scope and restores outer scope afterward', async () => {
  const urls: string[] = [];
  await withTransport(async lease => {
    const outer = lease.bind(scope(), () => ({ async *[Symbol.asyncIterator]() {
      const inner = lease.bypass(() => ({ async *[Symbol.asyncIterator]() { await fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(chat('model-native')) }); yield 'native'; } }));
      yield* inner; await fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(chat()) }); yield 'enabled';
    } })); assert.deepEqual(await values(outer), ['native', 'enabled']);
  }, (async (url) => { urls.push(String(url)); return jsonResponse(String(url).endsWith('/messages') ? anthropicReply : chatReply); }) as typeof fetch);
  assert.deepEqual(urls, ['https://fixture.invalid/v1/chat/completions', 'https://fixture.invalid/v1/messages']);
});
test('iterator cancellation and throw remain under the assigned context', async () => {
  const models: string[] = [];
  await withTransport(async lease => {
    const make = () => lease.bind(scope(), () => ({ async *[Symbol.asyncIterator]() { try { yield 'first'; } finally { await fetch('https://fixture.invalid/v1/chat/completions', { method: 'POST', body: JSON.stringify(chat()) }); } } }));
    const returned = make()[Symbol.asyncIterator](); await returned.next(); await returned.return!();
    const thrown = make()[Symbol.asyncIterator](); await thrown.next(); await assert.rejects(thrown.throw!(new Error('stop')), /stop/);
  }, (async (_url, init) => { models.push(new Headers(init?.headers).get('user-agent')!); return jsonResponse(anthropicReply); }) as typeof fetch);
  assert.equal(models.length, 2); assert.ok(models.every(x => /^claude-cli\//.test(x)));
});
test('transport leases are reference-counted and leave a later external wrapper intact', async () => {
  const original = globalThis.fetch; const first = installTransport(), second = installTransport(), wrapper = globalThis.fetch;
  try { assert.equal(first.registrations(), 2); first.release(); assert.equal(globalThis.fetch, wrapper); first.release(); const later = (async () => jsonResponse({})) as typeof fetch; globalThis.fetch = later; second.release(); assert.equal(globalThis.fetch, later); }
  finally { first.release(); second.release(); globalThis.fetch = original; }
});
test('listener masks user, system, credentials, tool arguments and URL queries; ring stays bounded', () => {
  const listener = new RequestListener(); listener.configure({ enabled: true, maxEntries: 1 });
  const r: TransformResult = { url: 'https://fixture.invalid/v1/messages?token=QUERY_SECRET', method: 'POST', headers: new Headers({ authorization: 'Bearer AUTH_SECRET', 'x-api-key': 'API_SECRET', 'user-agent': 'claude-cli/2.1.63 (external, cli)' }), body: { model: 'model-a', system: [{ type: 'text', text: 'PRIVATE_SYSTEM_A' }, { type: 'text', text: 'PRIVATE_SYSTEM_B' }], messages: [{ role: 'user', content: 'PRIVATE_USER' }], metadata: { user_id: 'ACCOUNT_SECRET' }, tools: [{ name: 'read', input_schema: { type: 'object', properties: { q: { type: 'string', default: 'PRIVATE_ARG' } } } }] }, changed: true, originalProtocol: 'anthropic-messages', targetProtocol: 'anthropic-messages', toolNames: {}, profile: 'fixture' };
  const context = { identity: { ...scope().identity, url: r.url, protocol: r.originalProtocol }, rule: scope().rule, deviceId: 'a'.repeat(64), accountId: 'fixture' };
  listener.record(r, context); listener.record(r, context); const entries = listener.list(); assert.equal(entries.length, 1);
  const serialized = JSON.stringify(entries); for (const value of ['QUERY_SECRET', 'AUTH_SECRET', 'API_SECRET', 'PRIVATE_SYSTEM_A', 'PRIVATE_SYSTEM_B', 'PRIVATE_USER', 'ACCOUNT_SECRET', 'PRIVATE_ARG']) assert.ok(!serialized.includes(value), value);
  assert.ok(serialized.includes('claude-cli')); listener.clear(); assert.deepEqual(listener.list(), []); listener.configure({ enabled: false, maxEntries: 50 }); assert.equal(listener.record(r, context), undefined);
});
test('RPC HTTP endpoint returns stable envelopes, rejects cross-site and oversize input, and hides host errors', async t => {
  const { controller, settings } = setup(); const server = await serve(createApiHandler(controller));
  const post = (value: unknown, headers: Record<string, string> = {}) => fetch(server.base + API_PATH, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value) });
  try {
    await t.test('state, save, listener, logs and clear share UI envelopes', async () => {
      const state = await (await post({ action: 'state' })).json() as { ok: boolean; state: { providers: unknown[] } }; assert.equal(state.ok, true); assert.equal(state.state.providers.length, 3);
      const saved = await (await post({ action: 'save', providerId: 'a', rule: { client: 'codex' }, revision: 0 })).json() as { ok: boolean }; assert.equal(saved.ok, true);
      assert.equal((await post({ action: 'listener', enabled: true, revision: 1 })).status, 200); assert.equal((await post({ action: 'clear' })).status, 200);
      assert.deepEqual(await (await post({ action: 'logs' })).json(), { ok: true, entries: [] });
    });
    await t.test('same-origin passes; mismatched and cross-site origins fail', async () => { assert.equal((await post({ action: 'state' }, { origin: server.base })).status, 200); assert.equal((await post({}, { origin: 'https://other.invalid' })).status, 403); assert.equal((await post({}, { 'sec-fetch-site': 'cross-site' })).status, 403); });
    await t.test('media type is exact and methods use POST', async () => { assert.equal((await post({}, { 'content-type': 'application/json-not-json' })).status, 415); assert.equal((await fetch(server.base + API_PATH)).status, 405); });
    await t.test('invalid JSON and unknown actions return coded strings', async () => { const res = await post('{'); assert.equal(res.status, 400); assert.deepEqual(await res.json(), { ok: false, code: 'INVALID_JSON', error: 'JSON 格式无效。' }); assert.equal((await post({ action: 'missing' })).status, 404); });
    await t.test('stale save maps to 409 and keeps current configuration', async () => { const res = await post({ action: 'save', providerId: 'a', rule: { client: 'none' }, revision: 0 }); assert.equal(res.status, 409); assert.equal((await res.json() as { code: string }).code, 'REVISION_CONFLICT'); });
    await t.test('oversize body receives 413 rather than socket reset', async () => { const res = await post(JSON.stringify({ action: 'state', padding: 'x'.repeat(1024 * 1024) })); assert.equal(res.status, 413); assert.equal((await res.json() as { code: string }).code, 'REQUEST_TOO_LARGE'); });
    await t.test('host exception never exposes raw secret or stack', async () => { const describe = settings.describe; settings.describe = () => { throw new Error('HOST_SECRET'); }; const res = await post({ action: 'state' }); const text = await res.text(); assert.equal(res.status, 500); assert.ok(!text.includes('HOST_SECRET')); settings.describe = describe; });
  } finally { await server.close(); }
});
test('local capture endpoint verifies Claude, Codex, and byte-identical native provider requests', async () => {
  const seen: { path: string; body: string; headers: IncomingMessage['headers'] }[] = [];
  const server = await serve(async (req, res) => { const chunks: Buffer[] = []; for await (const x of req) chunks.push(Buffer.from(x)); seen.push({ path: req.url!, body: Buffer.concat(chunks).toString('utf8'), headers: req.headers }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(req.url?.endsWith('/messages') ? anthropicReply : req.url?.endsWith('/responses') ? responsesReply : chatReply)); });
  const lease = installTransport(); const listener = new RequestListener(); listener.configure({ enabled: true, maxEntries: 10 }); const path = server.base + '/gateway/prefix/v1/chat/completions';
  try {
    const a = scope('a', 'claude-code', listener), b = scope('b', 'codex', listener); a.rule.baseUrl = server.base + '/gateway/prefix/v1'; b.rule.baseUrl = a.rule.baseUrl;
    const claude = await lease.run(a, () => fetch(path, { method: 'POST', headers: { authorization: 'Bearer FIXTURE_A' }, body: JSON.stringify(chat()) })); assert.equal((await claude.json() as { choices: { message: { content: string } }[] }).choices[0].message.content, 'capture-ok');
    for (let i = 0; i < 2; i++) { const codex = await lease.run(b, () => fetch(path, { method: 'POST', headers: { authorization: 'Bearer FIXTURE_B' }, body: JSON.stringify(chat('model-b')) })); assert.equal((await codex.json() as { choices: { message: { content: string } }[] }).choices[0].message.content, 'responses-ok'); }
    const raw = '{  "model": "model-native", "messages" : [ {"role":"user","content":"none preserves formatting"} ] }';
    const headers = { authorization: 'Bearer FIXTURE_NATIVE', 'user-agent': 'native-unchanged', 'x-native-fixture': 'keep-value' };
    await lease.run(scope('native', 'none'), () => fetch(path, { method: 'POST', headers, body: raw }));
    assert.equal(seen.length, 4); assert.equal(seen[0].path, '/gateway/prefix/v1/messages'); assert.equal(seen[1].path, '/gateway/prefix/v1/responses'); assert.equal(seen[3].path, '/gateway/prefix/v1/chat/completions');
    const anthro = JSON.parse(seen[0].body) as { system: { text: string }[]; metadata: { user_id: string } }; assert.match(anthro.system[0].text, /^x-anthropic-billing-header:/); assert.ok(anthro.system[1].text.includes('Claude')); assert.match(anthro.metadata.user_id, /_account_[a-f0-9-]+_session_[a-f0-9-]+/); assert.equal(seen[0].headers['x-stainless-helper-method'], undefined);
    for (const item of seen.slice(1, 3)) { const body = JSON.parse(item.body) as { instructions: string; input: unknown[] }; assert.ok(body.instructions.length > 7000); assert.ok(body.instructions.startsWith('You are')); assert.ok(Array.isArray(body.input)); assert.match(String(item.headers.originator), /^codex/); }
    assert.equal(seen[3].body, raw); for (const [key, value] of Object.entries(headers)) assert.equal(seen[3].headers[key], value); assert.equal(listener.list().length, 3);
    assert.ok(!JSON.stringify(listener.list()).includes('FIXTURE_A')); assert.ok(!JSON.stringify(listener.list()).includes('PROJECT_PRIVATE_INSTRUCTIONS'));
  } finally { lease.release(); await server.close(); }
});

test('local HTTP capture validates the source-default CLI layout separately from the compatibility profile', async () => {
  let observed: { headers: IncomingMessage['headers']; body: JsonObject } | undefined;
  const server = await serve(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    observed = { headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as JsonObject };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(anthropicReply));
  });
  const lease = installTransport();
  try {
    const source = scope(); source.rule = { client: 'claude-code' };
    const response = await lease.run(source, () => fetch(server.base + '/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer SOURCE_FIXTURE' }, body: JSON.stringify(chat()) }));
    assert.equal((await response.json() as { choices: { message: { content: string } }[] }).choices[0].message.content, 'capture-ok');
    assert.ok(observed);
    assert.equal(observed.headers['x-stainless-package-version'], '0.74.0');
    assert.equal(observed.headers['x-stainless-runtime-version'], process.version);
    assert.equal(observed.headers['user-agent'], 'claude-cli/2.1.63 (external, cli)');
    assert.equal(observed.headers['accept'], 'application/json');
    assert.equal(observed.headers['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(observed.headers['x-claude-code-session-id'], undefined);
    assert.equal(observed.headers['x-client-request-id'], undefined);
    assert.equal(observed.headers['authorization'], 'Bearer SOURCE_FIXTURE');
    const body = observed.body as { system: { text: string; cache_control?: { type?: string; ttl?: string } }[]; metadata: { user_id: string }; messages: unknown[] };
    assert.match(body.system[0].text, /^x-anthropic-billing-header: cc_version=2\.1\.63\.[a-f0-9]{3}; cc_entrypoint=cli; cch=00000;$/);
    assert.equal(body.system[0].cache_control, undefined);
    assert.equal(body.system[1].text, "You are Claude Code, Anthropic's official CLI for Claude.");
    assert.equal(body.system[1].cache_control?.type, 'ephemeral');
    assert.ok(body.system.every(block => block.cache_control?.ttl === undefined));
    assert.match(body.metadata.user_id, /^user_[a-f0-9]{64}_account__session_[a-f0-9-]{36}$/);
    assert.ok(JSON.stringify(body.messages).includes('用户原始文字：proxy_read 与日期 2026-11-25 保持原样。'));
  } finally { lease.release(); await server.close(); }
});

test('saving a simulating rule resets every other supplier to passthrough', async () => {
  const cfg = defaultConfig();
  cfg.providers.a = { client: 'claude-code', profile: 'claude-code/2.1.63' };
  cfg.providers.b = { client: 'none' };
  const { store } = setup(cfg);
  await store.saveProvider('b', { client: 'codex', profile: 'codex-cli/0.107.0' }, 0);
  const snap = store.snapshot();
  assert.equal(snap.providers.b.client, 'codex');
  assert.deepEqual(snap.providers.a, { client: 'none' });
});
test('loading a config with several simulating suppliers keeps only the first', () => {
  const cfg = defaultConfig();
  cfg.providers.a = { client: 'codex', profile: 'codex-cli/0.107.0' };
  cfg.providers.b = { client: 'claude-code', profile: 'claude-code/2.1.63' };
  const store = new ConfigStore(new FakeSettings(cfg, SETTINGS_NS), undefined, SETTINGS_NS);
  const snap = store.snapshot();
  assert.equal(snap.providers.a.client, 'codex');
  assert.deepEqual(snap.providers.b, { client: 'none' });
});

test('concurrency cap validates the 0-64 range and survives supplier resets', async () => {
  assert.deepEqual(validateRule({ client: 'codex', concurrency: 4 }), { client: 'codex', concurrency: 4 });
  assert.deepEqual(validateRule({ client: 'none', concurrency: 0 }), { client: 'none' });
  assert.equal(validateRule({ client: 'codex', concurrency: 64 }).concurrency, 64);
  for (const bad of [65, -1, 2.5, 'many']) {
    assert.throws(() => validateRule({ client: 'codex', concurrency: bad }), (e: unknown) => e instanceof RpcError && e.code === 'INVALID_CONCURRENCY');
  }
  const cfg = defaultConfig();
  cfg.providers.a = { client: 'claude-code', profile: 'claude-code/2.1.63', concurrency: 2 };
  cfg.providers.b = { client: 'none', concurrency: 3 };
  const { store } = setup(cfg);
  await store.saveProvider('b', { client: 'codex', profile: 'codex-cli/0.107.0', concurrency: 5 }, 0);
  const snap = store.snapshot();
  assert.deepEqual(snap.providers.a, { client: 'none', concurrency: 2 });
  assert.equal(snap.providers.b.client, 'codex');
  assert.equal(snap.providers.b.concurrency, 5);
  const loaded = new ConfigStore(new FakeSettings((() => {
    const loadedCfg = defaultConfig();
    loadedCfg.providers.a = { client: 'codex', profile: 'codex-cli/0.107.0' };
    loadedCfg.providers.b = { client: 'claude-code', profile: 'claude-code/2.1.63', concurrency: 6 };
    return loadedCfg;
  })(), SETTINGS_NS), undefined, SETTINGS_NS).snapshot();
  assert.deepEqual(loaded.providers.b, { client: 'none', concurrency: 6 });
});

test('concurrency cap queues streams beyond the limit and admits them as earlier ones finish', async () => {
  const limiter = new ProviderLimiter();
  const gates: (() => void)[] = [];
  let opened = 0;
  const factory = () => (async function* () {
    opened++;
    await new Promise<void>(resolve => gates.push(resolve));
    yield opened;
  })();
  const take = async (): Promise<number> => {
    for await (const value of limiter.wrap('p', 2, factory)) return value;
    return 0;
  };
  const first = take();
  const second = take();
  const third = take();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, 2, 'only the first two streams may open');
  assert.deepEqual(limiter.usage('p'), { active: 2, queued: 1 });
  gates.shift()!();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, 3, 'the queued stream opens once a slot frees');
  assert.deepEqual(limiter.usage('p'), { active: 2, queued: 0 });
  while (gates.length) gates.shift()!();
  await Promise.all([first, second, third]);
  assert.deepEqual(limiter.usage('p'), { active: 0, queued: 0 });
  // Unlimited (0) returns the factory iterable untouched, with no gate state.
  const passthrough = limiter.wrap('q', 0, factory);
  assert.deepEqual(limiter.usage('q'), { active: 0, queued: 0 });
  assert.equal(typeof passthrough[Symbol.asyncIterator], 'function');
});