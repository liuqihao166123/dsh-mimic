import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createContext, Script } from 'node:vm';

/**
 * Execute the shipping artifact, not a reimplementation or source-text search.
 * The fixed artifact read below is a test fixture load; this test never writes
 * files or starts a browser/server. A recording createElement is deliberately
 * not React DOM and does not invoke the component or its hooks.
 */
const EXPECTED_PLUGIN_ID = 'dsh-mimic';
const EXPECTED_SETTINGS_SLOT = 'settings.section';
const EXPECTED_MAIN_SLOT = 'main';
const EXPECTED_SIDEBAR_SLOT = 'sidebar.panellist';
const EXPECTED_TITLE = '客户端模拟';
const EXPECTED_SETTINGS_ORDER = 40;
const EXPECTED_SIDEBAR_ORDER = 30;
const VM_TIMEOUT_MS = 2000;
const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = basename(dirname(testDirectory)) === 'build'
  ? resolve(testDirectory, '../..') : resolve(testDirectory, '..');
const bundlePath = resolve(projectDirectory, 'dist/client.js');
const executableBytes = readFileSync(bundlePath);
const artifact = {
  path: 'dist/client.js',
  bytes: executableBytes.byteLength,
  sha256: createHash('sha256').update(executableBytes).digest('hex'),
};
const compiledSource = executableBytes.toString('utf8');

interface RecordingElement {
  kind: 'recording-react-element';
  type: unknown;
  props: unknown;
  children: unknown[];
}
interface Injection { name: string; callback: () => unknown }
interface Registration { descriptor: Record<string, unknown>; render: () => unknown }

function record(value: unknown, label: string): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label);
  return value as Record<string, unknown>;
}

function executeCompiledModule() {
  const descriptors: unknown[] = [];
  const externalRequests: string[] = [];
  const elements: RecordingElement[] = [];
  const react = Object.freeze({
    createElement(type: unknown, props?: unknown, ...children: unknown[]): RecordingElement {
      const element: RecordingElement = { kind: 'recording-react-element', type, props: props ?? null, children };
      elements.push(element);
      return element;
    },
  });
  const context = createContext({
    window: { __ModuleLoader__: { load(descriptor: unknown) { descriptors.push(descriptor); } } },
  }, { name: 'compiled-client-module-slot-contract', codeGeneration: { strings: false, wasm: false } });
  new Script(compiledSource, { filename: bundlePath }).runInContext(context, { timeout: VM_TIMEOUT_MS });
  assert.equal(descriptors.length, 1, 'the actual bundle calls ModuleLoader.load exactly once');
  const descriptor = record(descriptors[0], 'ModuleLoader receives an object descriptor');
  assert.equal(descriptor.id, EXPECTED_PLUGIN_ID);
  assert.equal(typeof descriptor.factory, 'function');
  context.__bundleDescriptor = descriptor;
  context.__hostExternal = (name: unknown) => {
    assert.equal(typeof name, 'string', 'external module requests are named');
    const moduleName = name as string;
    externalRequests.push(moduleName);
    assert.equal(moduleName, 'react', 'the compiled client resolves only the declared React external');
    return react;
  };
  const exported: unknown = new Script('__bundleDescriptor.factory(__hostExternal)', { filename: 'module-factory-invocation.js' })
    .runInContext(context, { timeout: VM_TIMEOUT_MS });
  const plugin = record(exported, 'the factory returns the default plugin object');
  assert.equal(plugin.name, EXPECTED_PLUGIN_ID);
  assert.equal(typeof plugin.apply, 'function');
  assert.deepEqual(Object.keys(plugin).sort(), ['apply', 'inject', 'name'], 'ModuleLoader receives the unwrapped default export');
  assert.deepEqual(Array.from(plugin.inject as string[]), ['slots'], 'the browser half declares the cordis `slots` service, so `ctx.slots` is legal inside apply');
  context.__plugin = plugin;
  return {
    descriptor, plugin, externalRequests, elements,
    apply(ctx: { get(name: string): unknown }): unknown {
      context.__clientContext = ctx;
      return new Script('__plugin.apply(__clientContext)', { filename: 'compiled-default-apply.js' })
        .runInContext(context, { timeout: VM_TIMEOUT_MS });
    },
    invoke(callback: unknown): unknown {
      assert.equal(typeof callback, 'function', 'the compiled slot callback is callable');
      context.__slotCallback = callback;
      return new Script('__slotCallback()', { filename: 'compiled-slot-callback.js' })
        .runInContext(context, { timeout: VM_TIMEOUT_MS });
    },
    globalTypes(): Record<string, unknown> {
      const types: unknown = new Script('({ document: typeof document, fetch: typeof fetch, process: typeof process })')
        .runInContext(context, { timeout: VM_TIMEOUT_MS });
      return record(types, 'VM global coverage probe');
    },
  };
}

function recordingSlotHost() {
  const serviceRequests: string[] = [];
  const injections: Injection[] = [];
  const registrations: Registration[] = [];
  let cleanupCalls = 0;
  const cleanup = () => { cleanupCalls += 1; };
  const slots = {
    inject(name: string, callback: () => unknown) {
      assert.equal(typeof callback, 'function');
      injections.push({ name, callback });
    },
    register(descriptor: unknown, render: unknown) {
      assert.equal(typeof render, 'function');
      registrations.push({ descriptor: record(descriptor, 'compiled slot descriptor'), render: render as () => unknown });
      return cleanup;
    },
  };
  return {
    serviceRequests, injections, registrations, cleanup,
    get cleanupCalls() { return cleanupCalls; },
    ctx: { get(name: string): unknown { serviceRequests.push(name); assert.equal(name, 'slots'); return slots; } },
  };
}

function assertDescriptor(registration: Registration, expected: { name: string; field: 'id' | 'key'; order?: number }) {
  const descriptor = registration.descriptor;
  assert.equal(descriptor.name, expected.name);
  assert.equal(descriptor[expected.field], EXPECTED_PLUGIN_ID);
  if (expected.order !== undefined) assert.equal(descriptor.order, expected.order);
  assert.equal(typeof descriptor.label, 'function');
  const title: unknown = (descriptor.label as () => unknown)();
  assert.equal(title, EXPECTED_TITLE);
  assert.equal(typeof registration.render, 'function');
  return title as string;
}

test('compiled shipping bundle executes ModuleLoader factory and resolves host React default plugin', () => {
  const loaded = executeCompiledModule();
  assert.equal(loaded.descriptor.id, EXPECTED_PLUGIN_ID);
  assert.equal(loaded.plugin.name, EXPECTED_PLUGIN_ID);
  assert.deepEqual(loaded.externalRequests, ['react']);
  assert.equal(loaded.elements.length, 0, 'module evaluation does not invent a UI mount');
});

test('compiled default apply injects the settings section, main page and left-rail sidebar row', () => {
  const loaded = executeCompiledModule();
  const host = recordingSlotHost();
  assert.equal(loaded.apply(host.ctx), undefined);
  assert.deepEqual(host.serviceRequests, ['slots']);
  assert.deepEqual(host.injections.map(item => item.name), [EXPECTED_SETTINGS_SLOT, EXPECTED_MAIN_SLOT, EXPECTED_SIDEBAR_SLOT]);
  assert.equal(host.registrations.length, 0, 'registration is deferred to each slot owner');
  const settingsCleanup = loaded.invoke(host.injections[0].callback);
  const mainCleanup = loaded.invoke(host.injections[1].callback);
  const sidebarCleanup = loaded.invoke(host.injections[2].callback);
  assert.equal(host.registrations.length, 3);
  assert.equal(settingsCleanup, host.cleanup);
  assert.equal(mainCleanup, host.cleanup);
  assert.equal(sidebarCleanup, host.cleanup);
  assert.equal(loaded.elements.length, 0, 'registration alone does not render the panel');
});

test('compiled registrations expose settings/main/sidebar descriptors and render the panel and left-rail icon', t => {
  const loaded = executeCompiledModule();
  const host = recordingSlotHost();
  loaded.apply(host.ctx);
  const settingsCleanup = loaded.invoke(host.injections[0].callback);
  const mainCleanup = loaded.invoke(host.injections[1].callback);
  const sidebarCleanup = loaded.invoke(host.injections[2].callback);
  const [settings, main, sidebar] = host.registrations;
  assertDescriptor(settings, { name: EXPECTED_SETTINGS_SLOT, field: 'id', order: EXPECTED_SETTINGS_ORDER });
  assertDescriptor(main, { name: EXPECTED_MAIN_SLOT, field: 'key' });
  assertDescriptor(sidebar, { name: EXPECTED_SIDEBAR_SLOT, field: 'id', order: EXPECTED_SIDEBAR_ORDER });
  const settingsEl = loaded.invoke(settings.render) as RecordingElement;
  const mainEl = loaded.invoke(main.render) as RecordingElement;
  const iconEl = loaded.invoke(sidebar.render) as RecordingElement;
  assert.equal(settingsEl.kind, 'recording-react-element');
  assert.equal((settingsEl.type as { name: string }).name, 'ProviderClientPanel');
  assert.equal(settingsEl.props, null);
  assert.deepEqual(settingsEl.children, []);
  assert.equal((mainEl.type as { name: string }).name, 'ProviderClientPanel');
  assert.equal((iconEl.type as { name: string }).name, 'SidebarIcon');
  assert.equal((iconEl.props as { size: number }).size, 16);
  assert.equal(loaded.elements.length, 3);
  assert.equal(settingsCleanup, host.cleanup);
  assert.equal(mainCleanup, host.cleanup);
  assert.equal(sidebarCleanup, host.cleanup);
  loaded.invoke(settingsCleanup);
  assert.equal(host.cleanupCalls, 1);
  t.diagnostic('UI_BUNDLE_COMPATIBILITY ' + JSON.stringify({
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    scope: 'compiled-module-and-ui-slot-contract',
    artifact,
    runtime: { node: process.version, engine: 'node:vm', timeoutMs: VM_TIMEOUT_MS, react: 'recording createElement external only' },
    observed: {
      moduleLoaderCalls: 1,
      moduleId: loaded.descriptor.id,
      externalRequests: loaded.externalRequests,
      defaultPluginName: loaded.plugin.name,
      defaultApplyCallable: typeof loaded.plugin.apply === 'function',
      serviceRequests: host.serviceRequests,
      injections: host.injections.map(item => item.name),
      registrations: host.registrations.map(item => ({ name: item.descriptor.name, id: item.descriptor.id, key: item.descriptor.key, order: item.descriptor.order })),
      renderedElementTypes: [settingsEl, mainEl, iconEl].map(item => (item.type as { name: string }).name),
      reactCreateElementCalls: loaded.elements.length,
      cleanupForwarded: settingsCleanup === host.cleanup && mainCleanup === host.cleanup && sidebarCleanup === host.cleanup,
      cleanupCalls: host.cleanupCalls,
    },
    coverage: { compiledBundleExecution: true, moduleFactory: true, uiSlotContract: true, leftRailEntry: true, reactDom: false, browser: false, rpcEndToEnd: false },
    limitations: ['No React DOM renderer or component hook execution', 'No browser layout, theme, responsiveness or interactive UI coverage', 'No state/save/listener RPC end-to-end coverage'],
  }));
});

test('compiled apply without slots creates no fallback DOM mount or network fixture', () => {
  const loaded = executeCompiledModule();
  const requests: string[] = [];
  assert.equal(loaded.apply({ get(name) { requests.push(name); return undefined; } }), undefined);
  assert.deepEqual(requests, ['slots']);
  assert.equal(loaded.elements.length, 0);
  const globals = loaded.globalTypes();
  assert.equal(globals.document, 'undefined');
  assert.equal(globals.fetch, 'undefined');
  assert.equal(globals.process, 'undefined');
});
