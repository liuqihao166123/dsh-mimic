import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_PATH, PLUGIN_NAME, PLUGIN_VERSION } from '../src/types.js';
import type { ListenerEntry, PanelState, ProviderInfo, ProviderRule } from '../src/types.js';
import {
  buildSaveRequest, configuredProviders, createPanelApi, DraftValidationError, draftProblem,
  draftToRule, emptyEditorSession, isDraftDirty, isRevisionConflict, markRevisionConflict,
  PanelRpcError, parseModelIds, parseOverrides, profilesForClient, projectPanelState,
  reconcileState, redactListenerEntry, redactText, redactUrl, redactValue, restoreSelectedDraft,
  ruleToDraft, selectProvider, setDraftClient, simulatingRules, updateDraft, visibleOverrides,
} from '../src/client/model.js';
import type { FetchLike, RuleDraft } from '../src/client/model.js';
import { MAIN_SLOT_ID, PANEL_ID, PANEL_TITLE, registerClientUi, SETTINGS_SLOT_ID, SIDEBAR_SLOT_ID, SLOT_SERVICE_ID } from '../src/client/slots.js';
import type { SlotDescriptor, SlotsService } from '../src/client/slots.js';

const profiles: PanelState['profiles'] = [
  { id: 'claude-code-2.1.0', client: 'claude-code', version: '2.1.0', label: 'Claude Code', evidence: 'retained client fixture' },
  { id: 'codex-0.99.0', client: 'codex', version: '0.99.0', label: 'Codex', evidence: 'retained client fixture' },
];
function provider(id: string, configured = true): ProviderInfo {
  return { id, label: id === 'a' ? 'Alpha' : id === 'b' ? 'Beta' : id, adapter: 'fixture-adapter',
    modelIds: ['model-1', 'model-2'], baseUrl: 'https://original-provider-config.invalid?token=ORIGINAL-CONFIG', configured };
}
function state(revision = 3): PanelState {
  return { providers: [provider('b'), provider('a'), provider('dormant', false)],
    config: { schemaVersion: 1, revision, providers: { a: { client: 'none' }, b: { client: 'codex', profile: profiles[1].id } },
      listener: { enabled: false, maxEntries: 100 }, identity: { deviceId: 'PRIVATE-DEVICE-ID', accountId: 'PRIVATE-ACCOUNT-ID' } },
    runtime: { transport: 'active', detail: 'fixture native seam', registrations: 1 }, profiles: structuredClone(profiles), entries: [] };
}
function entry(): ListenerEntry {
  return { id: 'entry-1', time: '2026-11-25T12:00:00.000Z', providerId: 'a', modelId: 'model-1',
    client: 'claude-code', profile: profiles[0].id, url: 'https://user:pass@api.fixture.invalid/v1/messages?api_key=PRIVATE-QUERY#PRIVATE-FRAGMENT',
    protocol: 'anthropic-messages', targetProtocol: 'anthropic-messages',
    headers: { authorization: 'Bearer PRIVATE-AUTH', 'x-api-key': 'PRIVATE-KEY', 'x-device-id': 'PRIVATE-DEVICE-ID',
      'user-agent': 'claude-code/fixture', 'anthropic-beta': 'public-beta' },
    body: { model: 'model-1', max_tokens: 2048, instructions: 'PRIVATE-INSTRUCTIONS',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'PRIVATE-PROMPT' }] }],
      metadata: { account_id: 'PRIVATE-ACCOUNT-ID', deviceId: 'PRIVATE-DEVICE-ID', user_id: 'PRIVATE-USER-ID' },
      fingerprint: { profile: 'public-profile', instructionCharacters: 1234 } }, status: 200 };
}
function claudeDraft(patch: Partial<RuleDraft> = {}): RuleDraft {
  return { ...ruleToDraft({ client: 'claude-code', profile: profiles[0].id }, profiles), ...patch };
}
function reply(payload: unknown, status = 200): Awaited<ReturnType<FetchLike>> {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

// DSH slot registration is isolated from React and uses the observed production service shape.
test('client UI registers the settings section, the main page, and the left-rail sidebar row on matching identities', () => {
  const injections: string[] = [];
  const callbacks = new Map<string, () => unknown>();
  const registrations: { descriptor: SlotDescriptor; render: (owner?: { size?: number }) => unknown }[] = [];
  const registration = { dispose: () => undefined };
  const slots: SlotsService = {
    inject(name, callback) { injections.push(name); callbacks.set(name, callback); },
    register(descriptor, render) { registrations.push({ descriptor, render }); return registration; },
  };
  const requested: string[] = [];
  const panel = () => ({ panel: 'fixture-react-panel' });
  const icon = () => ({ icon: 'fixture-icon' });
  registerClientUi({ get(name) { requested.push(name); return slots; } }, { panel, icon });
  assert.deepEqual(requested, [SLOT_SERVICE_ID]);
  assert.deepEqual(injections, [SETTINGS_SLOT_ID, MAIN_SLOT_ID, SIDEBAR_SLOT_ID]);
  assert.equal(registrations.length, 0, 'each registration is deferred to its injected slot');
  assert.equal(callbacks.get(SETTINGS_SLOT_ID)?.(), registration);
  assert.equal(callbacks.get(MAIN_SLOT_ID)?.(), registration);
  assert.equal(callbacks.get(SIDEBAR_SLOT_ID)?.(), registration);
  assert.equal(registrations.length, 3);
  const [settings, main, sidebar] = registrations;
  assert.equal(settings.descriptor.name, SETTINGS_SLOT_ID);
  assert.equal(settings.descriptor.id, PANEL_ID);
  assert.equal(settings.descriptor.order, 40);
  assert.equal(settings.descriptor.label?.(), PANEL_TITLE);
  assert.equal(settings.render, panel);
  assert.equal(main.descriptor.name, MAIN_SLOT_ID);
  assert.equal(main.descriptor.key, PANEL_ID);
  assert.equal(main.descriptor.label?.(), PANEL_TITLE);
  assert.equal(main.render, panel);
  assert.equal(sidebar.descriptor.name, SIDEBAR_SLOT_ID);
  assert.equal(sidebar.descriptor.id, PANEL_ID, 'the sidebar row id matches the main-panel key so a click opens the panel');
  assert.equal(sidebar.descriptor.order, 30);
  assert.equal(sidebar.descriptor.label?.(), PANEL_TITLE);
  assert.equal(sidebar.render, icon);
  assert.equal(PANEL_ID, PLUGIN_NAME);
  assert.equal(PANEL_TITLE, '客户端模拟');
});
test('main page can own its scroll viewport while settings retain the embedded panel', () => {
  const callbacks = new Map<string, () => unknown>();
  const registrations = new Map<string, (owner?: { size?: number }) => unknown>();
  const slots: SlotsService = {
    inject(name, callback) { callbacks.set(name, callback); },
    register(descriptor, render) { registrations.set(descriptor.name, render); },
  };
  const panel = () => 'embedded';
  const mainPanel = () => 'scrollable-page';
  registerClientUi({ get: () => slots }, { panel, mainPanel, icon: () => null });
  callbacks.get(SETTINGS_SLOT_ID)?.(); callbacks.get(MAIN_SLOT_ID)?.();
  assert.equal(registrations.get(SETTINGS_SLOT_ID), panel);
  assert.equal(registrations.get(MAIN_SLOT_ID), mainPanel);
});
test('missing or incomplete slot service produces no invented mount path', () => {
  const renderers = { panel: () => null, icon: () => null };
  assert.doesNotThrow(() => registerClientUi({ get: () => undefined }, renderers));
  assert.doesNotThrow(() => registerClientUi({ get: () => ({ inject() {} }) }, renderers));
});
test('provider picker lists configured providers only without mutating API order', () => {
  const input = state().providers;
  assert.deepEqual(configuredProviders(input).map(item => item.id), ['a', 'b']);
  assert.deepEqual(input.map(item => item.id), ['b', 'a', 'dormant']);
  const withOfficial = [...input, { ...input[0], id: 'deepseek-official', label: 'DeepSeek', adapter: 'llm-deepseek' }, { ...input[0], id: 'deepseek-account', label: 'DeepSeek 账号', adapter: 'llm-deepseek-account' }];
  assert.deepEqual(configuredProviders(withOfficial).map(item => item.id), ['a', 'b']);
});
test('profiles stay restricted to the selected client', () => {
  assert.deepEqual(profilesForClient(profiles, 'none'), []);
  assert.deepEqual(profilesForClient(profiles, 'claude-code').map(item => item.id), [profiles[0].id]);
  assert.deepEqual(profilesForClient(profiles, 'codex').map(item => item.id), [profiles[1].id]);
});
test('model IDs parse newlines and commas, remove duplicates, and preserve exact IDs', () => {
  assert.deepEqual(parseModelIds(' model-1,model-2\r\nmodel-1\n\n model-with space '), ['model-1', 'model-2', 'model-with space']);
});
test('public projection removes original connection configuration and persistent identity', () => {
  const source = state();
  source.config.providers.a = { client: 'claude-code', profile: profiles[0].id,
    baseUrl: 'https://secret-original-rule.invalid', overrides: { deviceId: 'PRIVATE-DEVICE-ID', accountId: 'PRIVATE-ACCOUNT-ID',
      version: '2.1.0', identity: 'PUBLIC-CLIENT-IDENTITY', extraHeaders: { authorization: 'PRIVATE-AUTH', 'x-public': 'UNKNOWN-HEADER-VALUE',
        'x-app': 'public', 'x-stainless-device-id': 'PRIVATE-DEVICE-ID', 'x-codex-account-id': 'PRIVATE-ACCOUNT-ID' } } };
  const before = JSON.stringify(source);
  const output = projectPanelState(source);
  const serialized = JSON.stringify(output);
  assert.equal(JSON.stringify(source), before);
  for (const hidden of ['PRIVATE-DEVICE-ID', 'PRIVATE-ACCOUNT-ID', 'PRIVATE-AUTH', 'original-provider-config', 'secret-original-rule', 'ORIGINAL-CONFIG']) {
    assert.ok(!serialized.includes(hidden), hidden + ' is absent from the public state');
  }
  assert.ok(!('identity' in output.config));
  assert.ok(!('baseUrl' in output.providers[0]));
  assert.deepEqual(output.config.providers.a.overrides, { version: '2.1.0', identity: 'PUBLIC-CLIENT-IDENTITY', extraHeaders: { 'x-app': 'public' } });
});
test('visible rule overrides redact header credentials and hide private IDs', () => {
  assert.deepEqual(visibleOverrides({ accountId: 'hidden', deviceId: 'hidden', sdkVersion: '0.75.0',
    instructions: 'full-template', metadataFormat: 'json', beta: ['public'], extraHeaders: { 'X-Api-Key': 'hidden', 'x-app': 'Bearer sk-exampleabcdef' } }),
  { sdkVersion: '0.75.0', instructions: 'full-template', metadataFormat: 'json', beta: ['public'], extraHeaders: { 'x-app': 'Bearer [REDACTED]' } });
});
test('client switching picks a matching profile while retaining explicit advanced draft text', () => {
  const original = claudeDraft({ instructionsText: 'complete user template', overridesText: '{"version":"custom"}' });
  const next = setDraftClient(original, 'codex', profiles);
  assert.equal(next.profile, profiles[1].id);
  assert.equal(next.instructionsText, original.instructionsText);
  assert.equal(next.overridesText, original.overridesText);
  assert.equal(setDraftClient(next, 'codex', profiles), next);
  assert.equal(setDraftClient(next, 'none', profiles).profile, '');
});
test('None saves only the no-op client choice, with no stale profile or overrides', () => {
  assert.deepEqual(draftToRule({ ...claudeDraft({ overridesText: '{ invalid', instructionsText: 'old template', restrictModels: true }), client: 'none' }, profiles), { client: 'none' });
});
test('cross-client or missing profiles block save with an actionable validation message', () => {
  assert.throws(() => draftToRule(claudeDraft({ profile: profiles[1].id }), profiles), DraftValidationError);
  assert.throws(() => draftToRule(claudeDraft({ profile: '' }), []), /profile/);
  assert.match(draftProblem(claudeDraft({ profile: 'missing' }), profiles), /profile/);
});
test('model restriction is optional and a restricted list must contain at least one ID', () => {
  assert.deepEqual(draftToRule(claudeDraft({ modelIdsText: 'unused' }), profiles), { client: 'claude-code', profile: profiles[0].id });
  assert.deepEqual(draftToRule(claudeDraft({ restrictModels: true, modelIdsText: 'model-2,model-1,model-2' }), profiles).modelIds, ['model-2', 'model-1']);
  assert.throws(() => draftToRule(claudeDraft({ restrictModels: true }), profiles), /至少选择一个模型/);
  assert.throws(() => draftToRule(claudeDraft({ restrictModels: true, modelIdsText: 'x'.repeat(513) }), profiles), /列表过长/);
});
test('advanced overrides allow public versions, beta flags, metadata format and extra headers', () => {
  assert.deepEqual(parseOverrides(JSON.stringify({ version: ' 2.1.0 ', runtimeVersion: ' 24.0.0 ', sdkVersion: ' 0.75.0 ',
    originator: ' codex_cli ', identity: ' multiline\npublic identity ', beta: [' beta-a ', 'beta-a', 'beta-b'],
    metadataFormat: 'legacy', extraHeaders: { 'x-app': 'fixture' } }), ''),
  { version: '2.1.0', runtimeVersion: '24.0.0', sdkVersion: '0.75.0', originator: 'codex_cli', identity: ' multiline\npublic identity ',
    beta: ['beta-a', 'beta-b'], metadataFormat: 'legacy', extraHeaders: { 'x-app': 'fixture' } });
  assert.equal(parseOverrides('{}', '  '), undefined);
});
test('full instructions are kept verbatim and are separate from the overrides JSON', () => {
  const full = '\nYou are the full client template.\n' + 'section '.repeat(15_000) + '\n';
  assert.equal(parseOverrides('{}', full)?.instructions, full);
  assert.equal(draftToRule(claudeDraft({ instructionsText: full }), profiles).overrides?.instructions, full);
  assert.throws(() => parseOverrides('{"instructions":"use-textarea"}', ''), /完整指令模板文本框/);
  assert.throws(() => parseOverrides('{}', 'x'.repeat(250_001)), /250000/);
});
test('malformed JSON, invalid override types and header injection are validated before RPC', () => {
  for (const text of ['{', 'null', '[]', '{"version":1}', '{"version":"line\\nnext"}', '{"beta":[1]}',
    '{"metadataFormat":"other"}', '{"extraHeaders":{"x-app":"value\\r\\nnext"}}']) {
    assert.throws(() => parseOverrides(text, ''), DraftValidationError, text);
  }
});
test('account/device identifiers and credential headers are outside editable overrides', () => {
  for (const text of ['{"deviceId":"hidden"}', '{"accountId":"hidden"}', '{"baseUrl":"hidden"}',
    '{"extraHeaders":{"Authorization":"hidden"}}', '{"extraHeaders":{"X-Api-Key":"hidden"}}',
    '{"extraHeaders":{"X-Account-ID":"hidden"}}', '{"extraHeaders":{"cookie":"hidden"}}']) {
    assert.throws(() => parseOverrides(text, ''), DraftValidationError);
  }
});
test('extra headers match the exact case-insensitive host identity allow-list', () => {
  const names = ['User-Agent', 'ORIGINATOR', 'anthropic-version', 'Anthropic-Beta', 'anthropic-client', 'x-app',
    'x-stainless-lang', 'x-stainless-package-version', 'x-stainless-runtime-version', 'x-stainless-retry-count',
    'x-client-request-id', 'x-claude-code-session-id', 'X-Codex-Turn-State', 'x-codex-session-id', 'x-codex-user-id', 'session_id', 'openai-client'];
  const headers = Object.fromEntries(names.map(name => [name, 'fixture-' + name]));
  assert.deepEqual(parseOverrides(JSON.stringify({ extraHeaders: headers }), '')?.extraHeaders, headers);
  assert.deepEqual(visibleOverrides({ extraHeaders: headers }).extraHeaders, headers);
});
test('extra headers reject arbitrary HTTP fields and sensitive names inside wildcard families', () => {
  for (const name of ['', 'host', 'accept', 'content-type', 'x-public', 'originator-extra', 'anthropic-sdk',
    'anthropic-unknown', 'x-stainless-sdk1', 'x-codex-foo_bar', 'User-Agent ', 'User-Agent\nInjected',
    'x-stainless-api-key', 'x-stainless-access-token', 'x-stainless-device-id', 'x-codex-account-id',
    'x-codex-credential', 'x-codex-secret']) {
    const headers = { [name]: 'PRIVATE-HEADER-VALUE' };
    assert.throws(() => parseOverrides(JSON.stringify({ extraHeaders: headers }), ''), DraftValidationError, name || '(empty)');
    assert.deepEqual(visibleOverrides({ extraHeaders: headers }), {});
  }
});
test('private client header matching follows the host word boundaries and aliases', () => {
  for (const name of ['x-codex-auth', 'x-codex-authentication', 'x-codex-authorization-mode', 'x-stainless-apikey',
    'x-stainless-api-key-id', 'x-codex-token-state', 'x-codex-credential-mode', 'x-stainless-secret',
    'x-codex-password', 'x-stainless-cookie', 'x-stainless-account', 'x-codex-accountid',
    'x-codex-account-id-mode', 'x-stainless-device', 'x-codex-deviceid', 'x-codex-device-id-mode']) {
    const extraHeaders = { [name]: 'PRIVATE-HEADER-VALUE' };
    assert.throws(() => parseOverrides(JSON.stringify({ extraHeaders }), ''), DraftValidationError, name);
    assert.deepEqual(visibleOverrides({ extraHeaders }), {});
  }
  const extraHeaders = { 'x-codex-tokenizer': 'public-tokenizer', 'x-stainless-authorship': 'public-fingerprint' };
  assert.deepEqual(parseOverrides(JSON.stringify({ extraHeaders }), '')?.extraHeaders, extraHeaders);
  assert.deepEqual(visibleOverrides({ extraHeaders }).extraHeaders, extraHeaders);
});
test('extra headers enforce the host 64-entry and 4096-character limits before saving', () => {
  const headers = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [
    'x-stainless-fixture-' + String.fromCharCode(97 + Math.floor(index / 26), 97 + index % 26), 'fixture',
  ]));
  assert.deepEqual(parseOverrides(JSON.stringify({ extraHeaders: headers }), '')?.extraHeaders, headers);
  assert.throws(() => parseOverrides(JSON.stringify({ extraHeaders: { ...headers, 'x-app': '65th' } }), ''), /64/);
  const maximum = 'x'.repeat(4096);
  assert.equal(parseOverrides(JSON.stringify({ extraHeaders: { 'user-agent': maximum } }), '')?.extraHeaders?.['user-agent'], maximum);
  assert.equal(parseOverrides(JSON.stringify({ extraHeaders: { 'x-app': '  fixture  ' } }), '')?.extraHeaders?.['x-app'], '  fixture  ');
  for (const value of [1, null, false, {}, [], 'x'.repeat(4097), 'line\rnext', 'line\nnext']) {
    const extraHeaders = { 'x-app': value };
    assert.throws(() => parseOverrides(JSON.stringify({ extraHeaders }), ''), DraftValidationError);
    assert.deepEqual(visibleOverrides({ extraHeaders: extraHeaders as unknown as Record<string, string> }), {});
  }
});
test('editable request/session identity headers remain redacted in listener diagnostics', () => {
  const headers = { 'x-client-request-id': 'PRIVATE-REQUEST-ID', 'x-claude-code-session-id': 'PRIVATE-SESSION-ID',
    session_id: 'PRIVATE-CODEX-SESSION-ID' };
  assert.deepEqual(parseOverrides(JSON.stringify({ extraHeaders: headers }), '')?.extraHeaders, headers);
  const result = redactListenerEntry({ ...entry(), headers });
  assert.deepEqual(result.headers, { 'x-client-request-id': '[REDACTED]', 'x-claude-code-session-id': '[REDACTED]', session_id: '[REDACTED]' });
  for (const value of Object.values(headers)) assert.ok(!JSON.stringify(result).includes(value));
});
test('model and instructions boundary values match the host save contract', () => {
  const models = Array.from({ length: 500 }, (_, index) => 'model-' + index);
  assert.deepEqual(draftToRule(claudeDraft({ restrictModels: true, modelIdsText: models.join('\n') }), profiles).modelIds, models);
  assert.throws(() => draftToRule(claudeDraft({ restrictModels: true, modelIdsText: [...models, 'model-500'].join('\n') }), profiles), /列表过长/);
  const longestModel = 'm'.repeat(512);
  assert.deepEqual(draftToRule(claudeDraft({ restrictModels: true, modelIdsText: longestModel }), profiles).modelIds, [longestModel]);
  assert.throws(() => draftToRule(claudeDraft({ restrictModels: true, modelIdsText: longestModel + 'm' }), profiles), /列表过长/);
  const longestInstructions = 'i'.repeat(250000);
  assert.equal(parseOverrides('{}', longestInstructions)?.instructions, longestInstructions);
  assert.throws(() => parseOverrides('{}', longestInstructions + 'i'), /250000/);
});
test('dirty state ignores JSON whitespace/key order and model list order, not template changes', () => {
  const baseline = claudeDraft({ restrictModels: true, modelIdsText: 'a\nb', overridesText: '{"version":"v","beta":["x"]}' });
  const form = { ...baseline, modelIdsText: ' b,a,a ', overridesText: ' { "beta": ["x"], "version": "v" } ' };
  assert.equal(isDraftDirty({ baseline, form }), false);
  assert.equal(isDraftDirty({ baseline, form: { ...form, instructionsText: '\n' } }), true);
  assert.equal(isDraftDirty({ baseline, form: { ...form, overridesText: '{ invalid' } }), true);
});
test('switching providers preserves independent unsaved drafts', () => {
  let editor = reconcileState(emptyEditorSession(), state());
  editor = updateDraft(editor, 'a', setDraftClient(editor.drafts.a.form, 'claude-code', profiles));
  editor = selectProvider(editor, 'b');
  editor = updateDraft(editor, 'b', { instructionsText: 'Beta unsaved template' });
  editor = selectProvider(editor, 'a');
  assert.equal(editor.drafts.a.form.client, 'claude-code');
  assert.equal(editor.drafts.b.form.instructionsText, 'Beta unsaved template');
  assert.equal(selectProvider(editor, 'not-configured'), editor);
});
test('opening the panel lands on the provider that is already simulating a client', () => {
  const opened = reconcileState(emptyEditorSession(), state());
  assert.equal(opened.selectedProviderId, 'b', 'b is the only provider with a saved rule');
  const simulating = simulatingRules(opened.snapshot!, configuredProviders(opened.snapshot!.providers));
  assert.deepEqual(simulating.map(item => item.provider.id), ['b']);
  assert.deepEqual(simulating.map(item => item.rule.client), ['codex']);
  const idle = state();
  idle.config.providers.b = { client: 'none' };
  assert.equal(reconcileState(emptyEditorSession(), idle).selectedProviderId, 'a', 'falls back to the first provider when nothing is simulating');
});
test('refresh rebases saved cards and revision without losing any dirty draft', () => {
  let editor = reconcileState(emptyEditorSession(), state());
  editor = updateDraft(editor, 'a', setDraftClient(editor.drafts.a.form, 'claude-code', profiles));
  const savedLater = state(4);
  savedLater.config.providers.a = { client: 'codex', profile: profiles[1].id };
  savedLater.config.providers.b = { client: 'none' };
  const refreshed = reconcileState(editor, savedLater);
  assert.equal(refreshed.snapshot!.config.revision, 4);
  assert.equal(refreshed.drafts.a.form.client, 'claude-code');
  assert.equal(refreshed.drafts.a.baseline.client, 'codex');
  assert.equal(refreshed.drafts.b.form.client, 'none');
  assert.equal(isDraftDirty(refreshed.drafts.a), true);
});
test('successful save resets only the saved provider and leaves other drafts and rules untouched', () => {
  let editor = reconcileState(emptyEditorSession(), state());
  editor = updateDraft(editor, 'a', setDraftClient(editor.drafts.a.form, 'claude-code', profiles));
  editor = updateDraft(editor, 'b', { instructionsText: 'keep beta draft' });
  const accepted = state(4);
  accepted.config.providers.a = draftToRule(editor.drafts.a.form, profiles);
  const beforeB = JSON.stringify(editor.snapshot!.config.providers.b);
  const saved = reconcileState(editor, accepted, 'a');
  assert.equal(isDraftDirty(saved.drafts.a), false);
  assert.equal(saved.drafts.b.form.instructionsText, 'keep beta draft');
  assert.equal(JSON.stringify(saved.snapshot!.config.providers.b), beforeB);
});
test('optimistic save sends one provider rule plus observed revision, never the whole config', () => {
  let editor = reconcileState(emptyEditorSession(), state(17));
  editor = selectProvider(editor, 'a');
  editor = updateDraft(editor, 'a', setDraftClient(editor.drafts.a.form, 'claude-code', profiles));
  const request = buildSaveRequest(editor);
  assert.deepEqual(request, { action: 'save', providerId: 'a', rule: { client: 'claude-code', profile: profiles[0].id }, revision: 17 });
  assert.deepEqual(Object.keys(request).sort(), ['action', 'providerId', 'revision', 'rule']);
  assert.ok(!JSON.stringify(request).includes('PRIVATE-'));
  assert.equal(editor.snapshot!.config.providers.b.client, 'codex');
});
test('revision conflict blocks another save until explicit refresh while retaining unsaved edits', () => {
  let editor = reconcileState(emptyEditorSession(), state(17));
  editor = updateDraft(editor, 'a', setDraftClient(editor.drafts.a.form, 'claude-code', profiles));
  const conflicted = markRevisionConflict(editor);
  assert.equal(conflicted.drafts, editor.drafts);
  assert.equal(conflicted.revisionStale, true);
  assert.throws(() => buildSaveRequest(conflicted), /刷新已保存状态/);
  const fresh = reconcileState(conflicted, state(18));
  assert.equal(fresh.revisionStale, false);
  assert.equal(fresh.drafts.a.form.client, 'claude-code');
  assert.equal(buildSaveRequest(fresh).revision, 18);
  assert.equal(isDraftDirty(fresh.drafts.a), true);
});
test('restoring a selected draft only resets that provider to the refreshed saved baseline', () => {
  let editor = reconcileState(emptyEditorSession(), state());
  editor = selectProvider(editor, 'a');
  editor = updateDraft(editor, 'a', { client: 'claude-code', profile: profiles[0].id });
  editor = updateDraft(editor, 'b', { instructionsText: 'retained beta draft' });
  const reset = restoreSelectedDraft(editor);
  assert.equal(reset.drafts.a.form.client, 'none');
  assert.equal(reset.drafts.b.form.instructionsText, 'retained beta draft');
  assert.equal(reset.snapshot, editor.snapshot);
});
test('a removed provider keeps its dirty draft but cannot be saved into the current configuration', () => {
  let editor = reconcileState(emptyEditorSession(), state());
  editor = selectProvider(editor, 'a');
  editor = updateDraft(editor, 'a', { client: 'claude-code', profile: profiles[0].id });
  const removed = state(4);
  removed.providers = removed.providers.filter(item => item.id !== 'a');
  const refreshed = reconcileState(editor, removed);
  assert.equal(refreshed.selectedProviderId, 'a');
  assert.equal(refreshed.drafts.a.form.client, 'claude-code');
  assert.throws(() => buildSaveRequest(refreshed), /草稿已保留/);
  assert.equal(selectProvider(refreshed, 'b').selectedProviderId, 'b');
});
test('RPC uses only the declared same-origin POST path and credentials mode', async () => {
  const requests: { path: string; options: RequestInit }[] = [];
  const api = createPanelApi(async (path, options) => { requests.push({ path, options }); return reply({ ok: true, state: state() }); });
  const controller = new AbortController();
  const response = await api.call({ action: 'state' }, controller.signal);
  assert.equal(requests[0].path, API_PATH);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.mode, 'same-origin');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(String(requests[0].options.body)), { action: 'state' });
  assert.equal(requests[0].options.signal, controller.signal);
  assert.ok(response.state && !('identity' in response.state.config));
});
test('RPC save and listener actions carry optimistic revisions without unrelated config', async () => {
  const bodies: unknown[] = [];
  const api = createPanelApi(async (_path, options) => { bodies.push(JSON.parse(String(options.body))); return reply({ ok: true, state: state(4) }); });
  const rule: ProviderRule = { client: 'codex', profile: profiles[1].id };
  await api.call({ action: 'save', providerId: 'a', rule, revision: 3 });
  await api.call({ action: 'listener', enabled: true, revision: 4 });
  assert.deepEqual(bodies, [{ action: 'save', providerId: 'a', rule, revision: 3 }, { action: 'listener', enabled: true, revision: 4 }]);
});
test('RPC logs accepts entries and clear accepts state, with no fabricated log rows', async () => {
  const cleared = state();
  const api = createPanelApi(async (_path, options) => {
    const action = JSON.parse(String(options.body)).action;
    return reply(action === 'logs' ? { ok: true, entries: [entry()] } : { ok: true, state: cleared });
  });
  const logged = await api.call({ action: 'logs' });
  assert.equal(logged.entries!.length, 1);
  assert.equal(logged.entries![0].headers.authorization, '[REDACTED]');
  assert.deepEqual((await api.call({ action: 'clear' })).state!.entries, []);
});
test('RPC revision errors are classified and error text is redacted', async () => {
  const api = createPanelApi(async () => reply({ ok: false, code: 'REVISION_CONFLICT', error: 'Changed; token=PRIVATE-ERROR Bearer PRIVATE-BEARER' }, 409));
  await assert.rejects(() => api.call({ action: 'state' }), error => {
    assert.equal(isRevisionConflict(error), true);
    assert.ok(error instanceof PanelRpcError);
    assert.equal(error.code, 'REVISION_CONFLICT');
    assert.ok(!error.message.includes('PRIVATE-ERROR'));
    assert.ok(!error.message.includes('PRIVATE-BEARER'));
    return true;
  });
  assert.equal(isRevisionConflict(new PanelRpcError('changed', 'STALE_REVISION')), true);
  assert.equal(isRevisionConflict(new Error('unrelated')), false);
});
test('RPC rejects malformed JSON, status responses and malformed nested state or logs', async () => {
  const invalidPayloads: unknown[] = [null, { ok: true }, { ok: true, state: { ...state(), providers: [{}] } },
    { ok: true, state: { ...state(), profiles: [{}] } }, { ok: true, state: { ...state(), entries: [{}] } }];
  for (const payload of invalidPayloads) {
    await assert.rejects(() => createPanelApi(async () => reply(payload)).call({ action: 'state' }), PanelRpcError);
  }
  await assert.rejects(() => createPanelApi(async () => ({ ok: true, status: 200, json: async () => { throw new Error('not JSON'); } })).call({ action: 'state' }), /非 JSON/);
  await assert.rejects(() => createPanelApi(async () => reply({ ok: true, state: state() }, 500)).call({ action: 'state' }), /HTTP 500/);
  await assert.rejects(() => createPanelApi(async () => reply({ ok: true, entries: [{}] })).call({ action: 'logs' }), PanelRpcError);
});
test('listener projection removes URL credentials/query/fragment, IDs, auth and full prompts', () => {
  const source = entry();
  const before = JSON.stringify(source);
  const result = redactListenerEntry(source);
  assert.equal(result.url, 'https://api.fixture.invalid/v1/messages');
  assert.equal(JSON.stringify(source), before);
  const serialized = JSON.stringify(result);
  for (const privateValue of ['PRIVATE-AUTH', 'PRIVATE-KEY', 'PRIVATE-DEVICE-ID', 'PRIVATE-ACCOUNT-ID', 'PRIVATE-USER-ID',
    'PRIVATE-INSTRUCTIONS', 'PRIVATE-PROMPT', 'PRIVATE-QUERY', 'PRIVATE-FRAGMENT', 'user:pass']) assert.ok(!serialized.includes(privateValue), privateValue);
  assert.equal(result.headers['user-agent'], 'claude-code/fixture');
  assert.equal(result.body.model, 'model-1');
  assert.deepEqual(result.body.fingerprint, { profile: 'public-profile', instructionCharacters: 1234 });
});
test('redacted diagnostics preserve numeric token budgets without exposing credential tokens', () => {
  assert.deepEqual(redactValue({ max_tokens: 2048, input_tokens: 17, output_tokens: 19,
    access_token: 'private-access-token', max_output_tokens: 'private-non-numeric' }),
  { max_tokens: 2048, input_tokens: 17, output_tokens: 19, access_token: '[REDACTED]', max_output_tokens: '[REDACTED]' });
});
test('redaction also removes nested tool descriptions and bounds deeply nested or huge arrays', () => {
  const output = redactValue({ tools: [{ type: 'function', function: { name: 'private-name', description: 'PRIVATE-TOOL-CONTENT' } }],
    input: [{ privateField: 'PRIVATE-INPUT-CONTENT' }], items: Array.from({ length: 60 }, (_, index) => index) });
  assert.ok(!JSON.stringify(output).includes('PRIVATE-TOOL-CONTENT'));
  assert.ok(!JSON.stringify(output).includes('PRIVATE-INPUT-CONTENT'));
  assert.match(JSON.stringify(output), /10 more items/);
  assert.equal(redactValue('deep value', '', 13), '[nested content omitted]');
  assert.equal(redactUrl('file:///private'), '[endpoint hidden]');
  assert.equal(redactUrl('not a URL'), '[endpoint hidden]');
  assert.equal(redactText('sk-proj-exampleabcdef token=private device_id=private account_id=private').includes('private'), false);
});

test('panel version constant stays in sync with package.json', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const project = basename(dirname(here)) === 'build' ? resolve(here, '../..') : resolve(here, '..');
  const pkg = JSON.parse(readFileSync(resolve(project, 'package.json'), 'utf8')) as { version: string };
  assert.match(PLUGIN_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(PLUGIN_VERSION, pkg.version);
});
test('concurrency cap round-trips through the draft and counts as a change', () => {
  const baseline = claudeDraft();
  assert.equal(baseline.concurrencyText, '');
  const form = { ...baseline, concurrencyText: '3' };
  assert.equal(isDraftDirty({ baseline, form }), true);
  assert.deepEqual(draftToRule(form, profiles), { client: 'claude-code', profile: profiles[0].id, concurrency: 3 });
  assert.deepEqual(draftToRule({ ...form, client: 'none' }, profiles), { client: 'none', concurrency: 3 });
  assert.equal(ruleToDraft({ client: 'codex', profile: profiles[1].id, concurrency: 5 }, profiles).concurrencyText, '5');
  assert.throws(() => draftToRule({ ...form, concurrencyText: '65' }, profiles), DraftValidationError);
  assert.throws(() => draftToRule({ ...form, concurrencyText: '2.5' }, profiles), DraftValidationError);
  assert.deepEqual(draftToRule({ ...form, concurrencyText: '0' }, profiles), { client: 'claude-code', profile: profiles[0].id });
});

test('concurrency reject mode round-trips through the draft', () => {
  const base = claudeDraft();
  assert.equal(base.concurrencyMode, 'queue');
  const form = { ...base, concurrencyText: '2', concurrencyMode: 'reject' as const };
  assert.deepEqual(draftToRule(form, profiles), { client: 'claude-code', profile: profiles[0].id, concurrency: 2, concurrencyMode: 'reject' });
  assert.equal(isDraftDirty({ baseline: base, form: { ...base, concurrencyMode: 'reject' } }), true);
  assert.equal(ruleToDraft({ client: 'codex', profile: profiles[1].id, concurrency: 3, concurrencyMode: 'reject' }, profiles).concurrencyMode, 'reject');
  assert.equal(ruleToDraft({ client: 'codex', profile: profiles[1].id, concurrency: 3 }, profiles).concurrencyMode, 'queue');
});
