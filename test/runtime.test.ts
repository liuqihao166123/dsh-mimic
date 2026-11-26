/** Compatibility probe: actual extracted Cordis/LLM compiled modules + built plugin.
 * Services and network responses below are synthetic in-memory fixtures.
 * No installed application/configuration is patched and no remote model is called.
 * Override DSH_RUNTIME_MODULE_ROOT with an existing extracted dsh root.
 * Legacy @deepseek-ai / node_modules roots are also accepted; no disk probe or loader hook is used.
 * Run AFTER the lead's build: node --test --test-isolation=none build/test/runtime.test.js
 */
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import { setImmediate as tick } from 'node:timers/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PluginConfig, ProviderRule } from '../src/types.js';

type Obj = Record<string, unknown>;
type Disposer = () => unknown;
interface NativeFiber extends PromiseLike<unknown> {
  readonly ctx: NativeContext;
  entry?: { options: { id: string } };
  dispose(): Promise<void>;
}
interface NativeContext {
  fiber: NativeFiber;
  get(name: string): unknown;
  provide(name: string, value: unknown): Disposer;
  plugin(plugin: unknown, config?: unknown): NativeFiber;
  emit(name: string, ...args: unknown[]): unknown;
  on(name: string, listener: (...args: unknown[]) => unknown): Disposer;
}
interface CallOptions {
  provider: string; model: string; messages: Obj[]; sessionId: string;
  system?: string;
}
interface Chunk { type: string; reason?: string; [key: string]: unknown }
interface NativeLlm {
  registerAdapter(providers: string[], adapter: object): Disposer & { replace(providers: string[]): void };
  registerConfigurableProviders(entries: readonly Obj[]): Disposer;
  listProviders(): { id: string; name: string }[];
  listModels(provider: string): Promise<Obj[]>;
  stream(options: CallOptions): AsyncIterable<Chunk>;
}
interface CordisModule {
  Context: { new(): NativeContext; is(value: unknown): boolean };
  Inject: { resolve(value: unknown): Obj };
}
interface LlmModule {
  LlmRuntime: new(ctx: NativeContext) => NativeLlm;
  LlmAdapter: new() => object;
}
interface MainModule { default: { name: string; inject: string[] }; inject: string[] }
const ROOT = path.resolve(process.cwd());
const RUNTIME_SOURCE_ROOT = path.resolve(process.env.DSH_RUNTIME_MODULE_ROOT ?? path.join(ROOT,
  'evidence/rea-tmp/rea-extracted-300bf0b7-8b56-44d8-89ff-14b9b73ea29d/dsh/node_modules/@deepseek-ai'));
const runtimeRootKind = path.basename(RUNTIME_SOURCE_ROOT).toLowerCase();
const MODULE_ROOT = runtimeRootKind === '@deepseek-ai' ? RUNTIME_SOURCE_ROOT
  : runtimeRootKind === 'node_modules' ? path.join(RUNTIME_SOURCE_ROOT, '@deepseek-ai')
  : path.join(RUNTIME_SOURCE_ROOT, 'node_modules', '@deepseek-ai');
const actualUrl = (name: string): string => pathToFileURL(path.join(MODULE_ROOT, name, 'lib/index.js')).href;
const CORDIS_URL = actualUrl('cordis'), LLM_URL = actualUrl('dsh-llm');
const MAIN_URL = pathToFileURL(path.join(ROOT, 'dist/index.js')).href;
const API = '/dsh-mimic/api';
const FALLBACK_NS = 'dsh-mimic';
const MODEL = 'fixture-model';
const SESSION_A = '0e41012a-ec50-4a18-96cc-76ee9a53b47b';
const SESSION_B = 'a5c9b1c7-60c6-47ae-a0c4-061f32396a70';
const object = (value: unknown): Obj => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
function frozen<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) frozen(child); Object.freeze(value); }
  return value;
}
function config(providers: Record<string, ProviderRule>): PluginConfig {
  return { schemaVersion: 1, revision: 0, providers: structuredClone(providers), listener: { enabled: true, maxEntries: 50 },
    identity: { deviceId: 'a'.repeat(64), accountId: '1cb569fb-1c27-46a0-898f-0a681ec3af67' } };
}
function options(provider: string, sessionId = SESSION_A, model = MODEL): CallOptions {
  return frozen({ provider, model, sessionId, messages: [{ role: 'user', content: [{ type: 'text', text: 'fixture user ' + provider }] }] });
}
async function collect(stream: AsyncIterable<Chunk>): Promise<Chunk[]> {
  const rows: Chunk[] = []; for await (const row of stream) rows.push(row);
  assert.ok(!rows.some(row => row.type === 'finish' && ['error', 'aborted'].includes(String(row.reason))), JSON.stringify(rows));
  return rows;
}
class FakeSettings {
  writable = true;
  namespace: string;
  section: PluginConfig;
  descriptorRevision = 7;
  replacements: { ns: string; expectedRevision: number | undefined }[] = [];
  presentations: { options: { auto?: boolean }; owner: NativeFiber }[] = [];
  presentationDisposals = 0;
  changed: (ns: string, revision: number) => void = () => {};
  constructor(namespace: string, section: PluginConfig) { this.namespace = namespace; this.section = structuredClone(section); }
  describe(): { ns: string; value: unknown; revision: number }[] {
    return [
      { ns: this.namespace, value: { config: structuredClone(this.section) }, revision: this.descriptorRevision },
      // A plausible fixed-name decoy proves the main plugin follows fiber.entry.options.id.
      { ns: FALLBACK_NS, value: { config: config({}) }, revision: 99 },
      { ns: 'fixture-adapter-settings', value: { providers: {} }, revision: 1 },
    ];
  }
  configure(value: { auto?: boolean }, owner: NativeFiber): Disposer {
    this.presentations.push({ options: value, owner }); return () => { this.presentationDisposals++; };
  }
  async replace(ns: string, value: unknown, expectedRevision?: number): Promise<void> {
    assert.equal(ns, this.namespace); assert.equal(expectedRevision, this.descriptorRevision);
    this.replacements.push({ ns, expectedRevision });
    this.section = structuredClone(object(value).config as PluginConfig); this.descriptorRevision++;
    this.changed(ns, this.descriptorRevision);
  }
}
type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
class FakeWebServer {
  routes = new Map<string, Handler>();
  unregistrations = 0;
  register(route: { kind: string; path: string; handler: Handler }): Disposer {
    assert.equal(route.kind, 'exact'); assert.ok(!this.routes.has(route.path));
    this.routes.set(route.path, route.handler);
    return () => { this.routes.delete(route.path); this.unregistrations++; };
  }
  async rpc(input: unknown): Promise<Obj> {
    const handler = this.routes.get(API); assert.ok(handler, 'plugin API was not registered on native Cordis');
    const req = Readable.from([Buffer.from(JSON.stringify(input))]) as unknown as IncomingMessage;
    req.method = 'POST'; req.url = API;
    req.headers = { host: '127.0.0.1:11000', origin: 'http://127.0.0.1:11000', 'content-type': 'application/json' };
    let text = '';
    const response = { statusCode: 200, setHeader() {}, end(value: unknown) { text = String(value); } };
    await handler(req, response as unknown as ServerResponse);
    const result = object(JSON.parse(text));
    assert.equal(response.statusCode, 200, text); assert.equal(result.ok, true, text);
    return result;
  }
}
interface Capture { provider: string; url: string; init: RequestInit | undefined }
interface NativeRequest { provider: string; options: CallOptions; init: RequestInit; raw: string; bodyReads: number }
interface Fixture {
  ctx: NativeContext; fiber: NativeFiber; llm: NativeLlm; settings: FakeSettings; web: FakeWebServer;
  captures: Capture[]; nativeRequests: NativeRequest[]; guardBodies: Set<string>; adapter: object;
  closed: string[]; initialFetch: typeof fetch; memoryFetch: typeof fetch;
  nested?: (options: CallOptions) => Promise<void>;
  concurrentGate(): void;
  close(): Promise<void>;
}
function reply(url: string): Response {
  const pathname = new URL(url).pathname;
  let body: Obj;
  if (pathname.endsWith('/responses')) body = { id: 'resp_fixture', object: 'response', status: 'completed', model: MODEL,
    output: [{ id: 'msg_fixture', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'fixture response' }] }],
    usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } };
  else if (pathname.endsWith('/messages')) body = { id: 'msg_fixture', type: 'message', role: 'assistant', model: MODEL,
    content: [{ type: 'text', text: 'fixture response' }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 3, output_tokens: 2 } };
  else body = { id: 'chatcmpl_fixture', object: 'chat.completion', created: 0, model: MODEL,
    choices: [{ index: 0, message: { role: 'assistant', content: 'fixture response' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}
async function fixture(cordis: CordisModule, native: LlmModule, main: MainModule,
  rules: Record<string, ProviderRule>, namespace: string): Promise<Fixture> {
  const initialFetch = globalThis.fetch;
  const captures: Capture[] = [], nativeRequests: NativeRequest[] = [], closed: string[] = [], guardBodies = new Set<string>();
  let gate: Promise<void> | undefined, releaseGate: (() => void) | undefined, arrivals = 0;
  const memoryFetch: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    assert.equal(new URL(url).origin, 'https://fixture.invalid', 'unexpected non-fixture network attempt');
    const provider = new Headers(init?.headers).get('x-fixture-provider') ?? 'unknown';
    captures.push({ provider, url, init });
    if (gate) { if (++arrivals === 2) releaseGate?.(); await gate; }
    // The original transport deliberately does not inspect a None request body.
    return reply(url);
  };
  globalThis.fetch = memoryFetch;
  const ctx = new cordis.Context();
  const settings = new FakeSettings(namespace, config(rules));
  const web = new FakeWebServer();
  // Start the ACTUAL built plugin while its required services are absent.
  // This supplies exactly the metadata a loader entry supplies, before apply runs.
  const fiber = ctx.plugin(main.default, { config: settings.section });
  // Native registry returns Object.create(fiber); loader metadata belongs to
  // the actual owning Fiber, not its awaitable prototype wrapper.
  fiber.ctx.fiber.entry = { options: { id: namespace } };
  assert.equal(web.routes.size, 0); assert.equal(globalThis.fetch, memoryFetch);
  settings.changed = (ns, revision) => { ctx.emit('settings/document-updated', ns, revision); };
  ctx.provide('settings', settings); ctx.provide('webServer', web);
  const runtime = new native.LlmRuntime(ctx);
  const llm = ctx.get('llm') as NativeLlm;
  let result: Fixture;
  class FixtureAdapter extends native.LlmAdapter {
    async listModels(provider: string): Promise<Obj[]> { return [{ provider, id: MODEL, name: MODEL }]; }
    async *stream(call: CallOptions): AsyncGenerator<Chunk> {
      try {
        await result.nested?.(call);
        const raw = JSON.stringify({ model: call.model, max_tokens: 128, system: [{ type: 'text', text: 'fixture original system' }], messages: call.messages });
        const init: RequestInit = { method: 'POST', headers: new Headers({ 'user-agent': 'Harness-fixture/0.2.2',
          authorization: 'Bearer FIXTURE_ONLY', 'content-type': 'application/json', 'x-fixture-provider': call.provider }) };
        const record: NativeRequest = { provider: call.provider, options: call, init, raw, bodyReads: 0 };
        Object.defineProperty(init, 'body', { enumerable: true, configurable: true, get() {
          record.bodyReads++;
          if (guardBodies.has(call.provider)) throw new Error('NONE_BODY_WAS_READ:' + call.provider);
          return raw;
        } });
        nativeRequests.push(record);
        const response = await globalThis.fetch('https://fixture.invalid/v1/messages', init);
        await response.text();
        yield { type: 'block-start', index: 0, blockType: 'text' };
        yield { type: 'text-delta', index: 0, text: 'fixture response' };
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'fixture response' } };
        yield { type: 'finish', reason: 'stop' };
      } finally { closed.push(call.provider); }
    }
  }
  const adapter = new FixtureAdapter();
  assert.ok(adapter instanceof native.LlmAdapter); assert.ok(runtime instanceof native.LlmRuntime);
  const providers = [...new Set([...Object.keys(rules), 'native-unconfigured'])];
  llm.registerAdapter(providers, adapter);
  llm.registerConfigurableProviders(providers.map(provider => ({ provider, displayName: provider,
    settingsNs: 'fixture-adapter-settings', settingsPath: ['providers', provider], defaultBaseURL: 'https://fixture.invalid/v1' })));
  result = { ctx, fiber, llm, settings, web, captures, nativeRequests, guardBodies, adapter, closed, initialFetch, memoryFetch,
    concurrentGate() { arrivals = 0; gate = new Promise<void>(resolve => { releaseGate = resolve; }); },
    async close() { releaseGate?.(); try { await fiber.dispose(); } finally { try { await ctx.fiber.dispose(); } finally { globalThis.fetch = initialFetch; } } },
  };
  try {
    await fiber; await tick();
    assert.equal(cordis.Context.is(ctx), true); assert.equal(web.routes.size, 1);
    assert.notEqual(globalThis.fetch, memoryFetch);
    assert.equal(settings.presentations.length, 1);
    assert.equal(settings.presentations[0].options.auto, false);
    assert.equal(settings.presentations[0].owner.entry?.options.id, namespace);
    return result;
  } catch (error) {
    await result.close();
    throw error;
  }
}
function capture(f: Fixture, provider: string): Capture { const value = f.captures.find(row => row.provider === provider); assert.ok(value); return value; }
function request(f: Fixture, provider: string): NativeRequest { const value = f.nativeRequests.find(row => row.provider === provider); assert.ok(value); return value; }
function payload(value: Capture): Obj { assert.ok(value.init); assert.equal(typeof value.init.body, 'string'); return object(JSON.parse(String(value.init.body))); }
function headers(value: Capture): Headers { return new Headers(value.init?.headers); }
interface CaseResult { name: string; status: 'passed' | 'failed'; error?: string }
const caseResults: CaseResult[] = [];
async function scenario(t: TestContext, name: string, run: () => Promise<void>): Promise<void> {
  await t.test(name, async () => { try { await run(); caseResults.push({ name, status: 'passed' }); }
    catch (error) { caseResults.push({ name, status: 'failed', error: error instanceof Error ? error.stack ?? error.message : String(error) }); throw error; } });
}

test('runtime compatibility uses actual extracted Cordis and LlmRuntime', { timeout: 30000 }, async t => {
  try {
    const [cordis, native, main] = await Promise.all([
      import(CORDIS_URL) as Promise<CordisModule>, import(LLM_URL) as Promise<LlmModule>, import(MAIN_URL) as Promise<MainModule>,
    ]);
    assert.deepEqual(main.inject, ['settings', 'llm', 'webServer']);
    assert.deepEqual(Object.keys(cordis.Inject.resolve(main.inject)), ['settings', 'llm', 'webServer']);
    await scenario(t, 'dynamic loader entry-id drives API writes through actual native service injection', async () => {
      const f = await fixture(cordis, native, main, { 'native-claude': { client: 'none' } }, 'generated-provider-plugin-entry-42');
      try {
        const initial = await f.web.rpc({ action: 'state' });
        assert.ok(array(object(initial.state).providers).some(row => object(row).id === 'native-claude'));
        await f.web.rpc({ action: 'save', providerId: 'native-claude', rule: { client: 'claude-code' }, revision: 0 });
        assert.deepEqual(f.settings.replacements, [{ ns: 'generated-provider-plugin-entry-42', expectedRevision: 7 }]);
        assert.equal(f.settings.section.providers['native-claude'].client, 'claude-code');
        await collect(f.llm.stream(options('native-claude')));
        assert.match(headers(capture(f, 'native-claude')).get('user-agent') ?? '', new RegExp('^claude-cli/'));
      } finally { await f.close(); }
    });
    await scenario(t, 'None and unconfigured native provider requests preserve init identity without body reads', async () => {
      const f = await fixture(cordis, native, main, { 'native-none': { client: 'none' } }, 'entry-none');
      try {
        for (const provider of ['native-none', 'native-unconfigured']) {
          f.guardBodies.add(provider); await collect(f.llm.stream(options(provider)));
          assert.equal(request(f, provider).bodyReads, 0);
          assert.equal(capture(f, provider).init, request(f, provider).init);
          assert.equal(headers(capture(f, provider)).get('user-agent'), 'Harness-fixture/0.2.2');
          assert.equal(new URL(capture(f, provider).url).pathname, '/v1/messages');
        }
      } finally { await f.close(); }
    });
    await scenario(t, 'enabled provider transforms final headers/body while frozen hook inputs stay unchanged', async () => {
      const f = await fixture(cordis, native, main, { 'native-claude': { client: 'claude-code' } }, 'entry-enabled');
      try {
        const call = options('native-claude'), before = JSON.stringify(call);
        await collect(f.llm.stream(call));
        const sent = capture(f, 'native-claude'), body = payload(sent);
        assert.notEqual(sent.init, request(f, 'native-claude').init);
        assert.ok(request(f, 'native-claude').bodyReads > 0);
        assert.match(headers(sent).get('user-agent') ?? '', new RegExp('^claude-cli/'));
        assert.equal(headers(sent).get('authorization'), 'Bearer FIXTURE_ONLY');
        // The SOURCE CLI branch adds no session/request extension headers; the session lives in metadata.user_id.
        assert.equal(headers(sent).get('x-claude-code-session-id'), null);
        assert.equal(headers(sent).get('x-client-request-id'), null);
        assert.match(String(object(body.metadata).user_id), new RegExp('_session_' + SESSION_A + '$'));
        assert.ok(array(body.system).some(row => String(object(row).text).includes('You are Claude Code')));
        assert.ok(JSON.stringify(body.messages).includes('fixture user native-claude'));
        assert.equal(JSON.stringify(call), before); assert.ok(Object.isFrozen(call));
      } finally { await f.close(); }
    });
    await scenario(t, 'model-excluded generation also avoids request body reads', async () => {
      const f = await fixture(cordis, native, main, { 'native-filtered': { client: 'claude-code', modelIds: ['different-model'] } }, 'entry-filter');
      try { f.guardBodies.add('native-filtered'); await collect(f.llm.stream(options('native-filtered')));
        assert.equal(request(f, 'native-filtered').bodyReads, 0); assert.equal(capture(f, 'native-filtered').init, request(f, 'native-filtered').init);
      } finally { await f.close(); }
    });
    await scenario(t, 'nested None native call sheds enabled parent async scope and restores parent afterward', async () => {
      const f = await fixture(cordis, native, main, { 'native-parent': { client: 'claude-code' }, 'native-child': { client: 'none' } }, 'entry-nested');
      try {
        f.guardBodies.add('native-child');
        f.nested = async call => { if (call.provider === 'native-parent') await collect(f.llm.stream(options('native-child', SESSION_B))); };
        await collect(f.llm.stream(options('native-parent')));
        assert.equal(request(f, 'native-child').bodyReads, 0);
        assert.equal(capture(f, 'native-child').init, request(f, 'native-child').init);
        assert.equal(headers(capture(f, 'native-child')).get('user-agent'), 'Harness-fixture/0.2.2');
        assert.match(headers(capture(f, 'native-parent')).get('user-agent') ?? '', new RegExp('^claude-cli/'));
      } finally { await f.close(); }
    });
    await scenario(t, 'concurrent actual LLM streams keep one simulated provider and passthrough neighbors isolated', async () => {
      const f = await fixture(cordis, native, main, { 'native-a': { client: 'claude-code' }, 'native-b': { client: 'none' } }, 'entry-concurrent');
      try {
        f.concurrentGate();
        f.guardBodies.add('native-b');
        await Promise.all([collect(f.llm.stream(options('native-a', SESSION_A))), collect(f.llm.stream(options('native-b', SESSION_B)))]);
        const a = capture(f, 'native-a'), b = capture(f, 'native-b');
        assert.equal(new URL(a.url).pathname, '/v1/messages');
        assert.match(headers(a).get('user-agent') ?? '', new RegExp('^claude-cli/'));
        assert.equal(headers(a).get('x-claude-code-session-id'), null);
        assert.match(String(object(payload(a).metadata).user_id), new RegExp('_session_' + SESSION_A + '$'));
        assert.ok(JSON.stringify(payload(a).messages).includes('fixture user native-a'));
        assert.equal(request(f, 'native-b').bodyReads, 0);
        assert.equal(b.init, request(f, 'native-b').init);
        assert.equal(headers(b).get('user-agent'), 'Harness-fixture/0.2.2');
      } finally { await f.close(); }
    });
    await scenario(t, 'codex provider converts to the Responses endpoint with codex fingerprints', async () => {
      const f = await fixture(cordis, native, main, { 'native-b': { client: 'codex' } }, 'entry-codex');
      try {
        await collect(f.llm.stream(options('native-b', SESSION_B)));
        const b = capture(f, 'native-b');
        assert.equal(new URL(b.url).pathname, '/v1/responses');
        assert.match(headers(b).get('user-agent') ?? '', /codex/i);
        assert.equal(headers(b).get('session_id'), SESSION_B);
        assert.ok(JSON.stringify(payload(b).input).includes('fixture user native-b'));
        assert.ok(String(payload(b).instructions).includes('You are Codex'));
      } finally { await f.close(); }
    });
    await scenario(t, 'real iterator return and consumer throw close the actual adapter generation', async () => {
      const f = await fixture(cordis, native, main, { 'native-close': { client: 'claude-code' } }, 'entry-iterator');
      try {
        const first = f.llm.stream(options('native-close'))[Symbol.asyncIterator](); await first.next(); assert.ok(first.return); await first.return();
        const second = f.llm.stream(options('native-close', SESSION_B))[Symbol.asyncIterator](); await second.next(); assert.ok(second.throw);
        const consumer = new Error('fixture consumer throw'); await assert.rejects(second.throw(consumer), error => error === consumer);
        assert.equal(f.closed.filter(provider => provider === 'native-close').length, 2);
      } finally { await f.close(); }
    });
    await scenario(t, 'native fiber disposal unregisters event/API/presentation and restores original fetch', async () => {
      const f = await fixture(cordis, native, main, { 'native-dispose': { client: 'claude-code' } }, 'entry-dispose');
      try {
        await collect(f.llm.stream(options('native-dispose')));
        await f.fiber.dispose();
        assert.equal(globalThis.fetch, f.memoryFetch); assert.equal(f.web.routes.size, 0);
        assert.equal(f.web.unregistrations, 1); assert.equal(f.settings.presentationDisposals, 1);
        f.guardBodies.add('native-dispose');
        await collect(f.llm.stream(options('native-dispose', SESSION_B)));
        const last = f.nativeRequests.at(-1); assert.ok(last); assert.equal(last.bodyReads, 0);
        assert.equal(f.captures.at(-1)?.init, last.init);
        assert.equal(headers(f.captures.at(-1) as Capture).get('user-agent'), 'Harness-fixture/0.2.2');
      } finally { await f.close(); }
    });
  } catch (error) {
    if (caseResults.length === 0) caseResults.push({ name: 'actual module/plugin load', status: 'failed',
      error: error instanceof Error ? error.stack ?? error.message : String(error) });
    throw error;
  } finally {
    console.log('DSH_RUNTIME_COMPAT_RESULT=' + JSON.stringify({ schemaVersion: 1, status: caseResults.some(row => row.status === 'failed') ? 'failed' : 'passed',
      node: process.version, versionsVerifiedByOps: { cordis: '4.1.0', llm: '0.2.2-rc.5', schemastery: '3.19.0', cosmokit: '1.9.0' },
      modules: { cordis: CORDIS_URL, llm: LLM_URL, plugin: MAIN_URL, runtimeSourceRoot: RUNTIME_SOURCE_ROOT, runtimeModuleRoot: MODULE_ROOT }, cases: caseResults,
      boundaries: { actualCordis: true, actualLlmRuntime: true, builtMainPlugin: true, loaderEntryMetadataFixture: true,
        settingsAndWebServerAreFixtures: true, testOnlyHostPeerResolver: false, fetchIsMemoryFixture: true, remoteModelCalls: 0, installedFilesPatched: false },
      limitations: ['Exercises actual core runtime modules, not the running desktop Host or browser GUI.', 'First standalone main import failed on workspace Schemastery missing @deepseek-ai/cosmokit; every acceptance run uses the normal package-resolution path.', 'Fetch responses are JSON fixtures; full SSE protocol bridging is validated by the response suite.'] }));
  }
});
