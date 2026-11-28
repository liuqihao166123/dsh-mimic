/* Generated from TypeScript. React is provided by the DSH browser host. */
window.__ModuleLoader__.load({ id: "dsh-mimic", factory: function(external) {
const factories={"/client/index.js": function(require,module,exports) {
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = exports.name = void 0;
exports.ProviderClientPanel = ProviderClientPanel;
exports.apply = apply;
const React = __importStar(require("react"));
const types_js_1 = require("../types.js");
const model_js_1 = require("./model.js");
const slots_js_1 = require("./slots.js");
const styles_js_1 = require("./styles.js");
const h = React.createElement;
const CLIENTS = [
    { id: 'none', label: 'None', description: '不模拟 · 请求保持原样' },
    { id: 'claude-code', label: 'Claude Code', description: 'Anthropic Messages 客户端指纹' },
    { id: 'codex', label: 'Codex', description: 'OpenAI Responses 客户端指纹' },
];
const clientLabel = (client) => CLIENTS.find(item => item.id === client)?.label ?? client;
/** Left-rail glyph (a tune/sliders mark) rendered at the size the host gives the sidebar row. */
const SidebarIcon = ({ size = 16 }) => {
    return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    }, h('path', { d: 'M4 7h9M19 7h1M4 17h1M11 17h9' }), h('circle', { cx: 15, cy: 7, r: 2.1 }), h('circle', { cx: 9, cy: 17, r: 2.1 }));
};
function Badge(props) {
    return h('span', { className: 'pcs-badge ' + (props.draft ? 'pcs-badge-draft' : 'pcs-badge-saved') }, props.children);
}
function entryTime(time) {
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? time : date.toLocaleString('zh-CN', { hour12: false });
}
function ProviderClientPanel({ api: providedApi } = {}) {
    const api = React.useMemo(() => providedApi ?? (0, model_js_1.createPanelApi)(), [providedApi]);
    const [session, setSession] = React.useState(model_js_1.emptyEditorSession);
    const [busy, setBusy] = React.useState(null);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [lastRead, setLastRead] = React.useState('');
    const alive = React.useRef(false);
    const sequence = React.useRef(0);
    const pending = React.useRef(false);
    const abort = React.useRef(null);
    const current = React.useRef(session);
    current.current = session;
    const fieldId = 'pcs-' + React.useId().replace(/:/g, '');
    const run = React.useCallback(async (operation, request, savedProviderId) => {
        if (pending.current || !alive.current)
            return;
        pending.current = true;
        const ticket = ++sequence.current;
        const controller = new AbortController();
        abort.current = controller;
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
        setBusy(operation);
        setError('');
        setNotice('');
        try {
            const reply = await api.call(request, controller.signal);
            if (!alive.current || ticket !== sequence.current)
                return;
            if (operation === 'refresh' || operation === 'save' || operation === 'listener') {
                if (!reply.state)
                    throw new Error('服务未返回最新状态。');
                setSession(previous => (0, model_js_1.reconcileState)(previous, reply.state, savedProviderId));
                setNotice(operation === 'save' ? '已保存，立即生效。'
                    : operation === 'listener' ? (reply.state.config.listener.enabled ? '出站请求监听已开启。' : '出站请求监听已关闭。')
                        : '已读取最新状态。');
            }
            else {
                const entries = reply.entries ?? reply.state?.entries ?? [];
                setSession(previous => {
                    if (reply.state)
                        return { ...(0, model_js_1.reconcileState)(previous, reply.state), revisionStale: previous.revisionStale };
                    return previous.snapshot ? { ...previous, snapshot: { ...previous.snapshot, entries } } : previous;
                });
                if (operation === 'clear')
                    setNotice('监听记录已清空。');
            }
            setLastRead(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        }
        catch (failure) {
            if (!alive.current || ticket !== sequence.current)
                return;
            if ((0, model_js_1.isRevisionConflict)(failure)) {
                setSession(model_js_1.markRevisionConflict);
                setError('配置已在别处更新，请先刷新，再重新保存。');
            }
            else {
                setError(timedOut ? '读取超时，请重试。'
                    : (0, model_js_1.redactText)(failure instanceof Error ? failure.message : '请求未完成，请重试。'));
            }
        }
        finally {
            clearTimeout(timeout);
            if (alive.current && ticket === sequence.current) {
                pending.current = false;
                abort.current = null;
                setBusy(null);
            }
        }
    }, [api]);
    React.useEffect(() => {
        alive.current = true;
        void run('refresh', { action: 'state' });
        return () => { alive.current = false; sequence.current++; pending.current = false; abort.current?.abort(); };
    }, [run]);
    const snapshot = session.snapshot;
    const providers = snapshot ? (0, model_js_1.configuredProviders)(snapshot.providers) : [];
    const selected = providers.find(provider => provider.id === session.selectedProviderId);
    const draft = session.drafts[session.selectedProviderId];
    const form = draft?.form;
    const dirty = draft ? (0, model_js_1.isDraftDirty)(draft) : false;
    const savedRule = snapshot?.config.providers[session.selectedProviderId];
    const listenerEnabled = snapshot?.config.listener.enabled ?? false;
    const transportActive = snapshot?.runtime.transport === 'active';
    const simulating = snapshot ? (0, model_js_1.simulatingRules)(snapshot, providers) : [];
    const blocked = busy !== null;
    const patch = (change) => {
        if (pending.current)
            return;
        setError('');
        setNotice('');
        setSession(previous => (0, model_js_1.updateDraft)(previous, previous.selectedProviderId, change));
    };
    const chooseProvider = (id) => {
        if (pending.current)
            return;
        setError('');
        setNotice('');
        setSession(previous => (0, model_js_1.selectProvider)(previous, id));
    };
    const save = () => {
        try {
            const request = (0, model_js_1.buildSaveRequest)(current.current);
            void run('save', request, request.providerId);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : '请检查规则。');
        }
    };
    const button = (text, onClick, options = {}) => h('button', { type: 'button', className: 'pcs-button' + (options.primary ? ' pcs-button-primary' : '') + (options.className ? ' ' + options.className : ''),
        onClick, disabled: blocked || options.disabled }, text);
    const providerField = form ? h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-provider' }, h('span', null, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '1'), '选择供应商')), h('select', {
        id: fieldId + '-provider', className: 'pcs-control', value: session.selectedProviderId,
        onChange: (event) => chooseProvider(event.currentTarget.value),
    }, !selected && session.selectedProviderId ? h('option', { value: session.selectedProviderId, disabled: true }, '供应商已移除') : null, ...providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.label))), h('p', { className: 'pcs-help' }, selected ? selected.adapter + ' · ' + selected.modelIds.length + ' 个已配置模型' : '此供应商已从 DSH 配置移除。')) : null;
    const clientField = form ? h('div', { className: 'pcs-field' }, h('div', { className: 'pcs-field-label', id: fieldId + '-client-label' }, h('span', null, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '2'), '选择模拟客户端')), h('div', { className: 'pcs-clients', role: 'radiogroup', 'aria-labelledby': fieldId + '-client-label' }, ...CLIENTS.map(client => h('label', { key: client.id, className: 'pcs-client' }, h('input', {
        type: 'radio', name: fieldId + '-client', value: client.id, checked: form.client === client.id,
        onChange: () => patch((0, model_js_1.setDraftClient)(form, client.id, snapshot?.profiles ?? [])),
    }), h('span', null, h('span', { className: 'pcs-client-name' }, client.label), h('span', { className: 'pcs-client-description' }, client.description))))), h('p', { className: 'pcs-help' }, '同一时间只模拟一个供应商：保存后，其他供应商会自动恢复为不模拟。')) : null;
    const concurrencyStat = snapshot?.runtime.concurrency?.find(item => item.providerId === session.selectedProviderId);
    const concurrencyField = form ? h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-concurrency' }, h('span', null, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '3'), '并发上限'), h('span', { className: 'pcs-small pcs-muted' }, '0 = 不限制')), h('input', {
        id: fieldId + '-concurrency', className: 'pcs-control pcs-number', type: 'number', inputMode: 'numeric',
        min: 0, max: 64, step: 1, value: form.concurrencyText, placeholder: '0',
        onChange: (event) => patch({ concurrencyText: event.currentTarget.value }),
    }), h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-concurrency-mode' }, '超出上限时'), h('select', {
        id: fieldId + '-concurrency-mode', className: 'pcs-control', value: form.concurrencyMode,
        onChange: (event) => patch({ concurrencyMode: event.currentTarget.value === 'reject' ? 'reject' : 'queue' }),
    }, h('option', { value: 'queue' }, '排队等待（等前面的请求结束）'), h('option', { value: 'reject' }, '直接拒绝（超限即报错，不再创建）')), h('p', { className: 'pcs-help' }, concurrencyStat
        ? '当前并发 ' + concurrencyStat.active + ' / ' + concurrencyStat.limit + (concurrencyStat.queued ? '，排队 ' + concurrencyStat.queued : '')
        : '限制该供应商同时在途的生成请求数（每个并行子代理各算一个）；超出后按上面的方式处理。')) : null;
    const editor = form && providerField && clientField ? h('article', { className: 'pcs-card', 'aria-labelledby': fieldId + '-editor' }, h('div', { className: 'pcs-card-head' }, h('h3', { id: fieldId + '-editor' }, '模拟设置'), h(Badge, { draft: dirty, children: dirty ? '未保存' : '已生效' })), h('div', { className: 'pcs-card-body' }, h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, providerField, clientField, concurrencyField)), h('div', { className: 'pcs-actions' }, h('span', { className: 'pcs-small pcs-muted' }, dirty ? '尚未生效' : savedRule && savedRule.client !== 'none' ? '正在生效' : '未启用模拟'), h('div', { className: 'pcs-action-buttons' }, button(busy === 'save' ? '保存中…' : '保存', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;
    const listener = snapshot ? h('details', { className: 'pcs-card pcs-listener', 'aria-labelledby': fieldId + '-listener' }, h('summary', { id: fieldId + '-listener' }, '出站请求监听', h('span', { className: 'pcs-small pcs-muted' }, '调试 · 脱敏')), h('div', { className: 'pcs-card-body' }, h('div', { className: 'pcs-listener-toolbar' }, h('button', { type: 'button', className: 'pcs-switch', role: 'switch', 'aria-label': '出站请求监听',
        'aria-checked': listenerEnabled, disabled: blocked || session.revisionStale || (!listenerEnabled && !transportActive),
        onClick: () => { void run('listener', { action: 'listener', enabled: !listenerEnabled, revision: snapshot.config.revision }); } }, h('span', { className: 'pcs-switch-track', 'aria-hidden': true }, h('span', { className: 'pcs-switch-knob' })), busy === 'listener' ? '更新中…' : listenerEnabled ? '监听中' : '已关闭'), h('span', { className: 'pcs-small pcs-muted' }, snapshot.entries.length + ' 条记录 · 上限 ' + snapshot.config.listener.maxEntries), h('div', { className: 'pcs-action-buttons' }, button(busy === 'logs' ? '读取中…' : '读取记录', () => { void run('logs', { action: 'logs' }); }), button(busy === 'clear' ? '清空中…' : '清空', () => { void run('clear', { action: 'clear' }); }, { disabled: !snapshot.entries.length, className: 'pcs-button-danger' }))), !transportActive ? h('p', { className: 'pcs-help' }, '出站接入尚未就绪：' + snapshot.runtime.detail) : null, snapshot.entries.length ? h('div', { className: 'pcs-log-list' }, ...snapshot.entries.slice().reverse().map(entry => h('details', { key: entry.id, className: 'pcs-log' }, h('summary', null, (snapshot.providers.find(provider => provider.id === entry.providerId)?.label ?? '供应商') + ' · ' + entry.modelId + ' · ' + entryTime(entry.time)), h('div', { className: 'pcs-log-content' }, h('div', { className: 'pcs-log-meta' }, h('span', null, clientLabel(entry.client) + ' · ' + entry.profile), h('span', null, entry.protocol + ' → ' + entry.targetProtocol), entry.status !== undefined ? h('span', null, 'HTTP ' + entry.status) : null), h('p', { className: 'pcs-help pcs-code' }, entry.url), entry.error ? h('p', { className: 'pcs-validation' }, entry.error) : null, h('div', { className: 'pcs-log-label' }, '请求头 · 已脱敏'), h('pre', null, JSON.stringify(entry.headers, null, 2)), h('div', { className: 'pcs-log-label' }, '请求体 · 结构与指纹摘要'), h('pre', null, JSON.stringify(entry.body, null, 2))))))
        : h('p', { className: 'pcs-help' }, listenerEnabled ? '正常使用后点「读取记录」查看实际出站摘要。' : '开启监听后才会记录出站请求。'))) : null;
    return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked }, h('style', null, styles_js_1.PANEL_CSS), h('header', { className: 'pcs-hero' }, h('div', null, h('div', { className: 'pcs-eyebrow' }, h('span', { className: 'pcs-dot', 'aria-hidden': true }), '单供应商模拟 · 保存即生效'), h('h2', { className: 'pcs-title', id: fieldId + '-title' }, slots_js_1.PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + types_js_1.PLUGIN_VERSION)), h('p', { className: 'pcs-subtitle' }, '选一个供应商和一个客户端，保存即生效。')), h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked,
        onClick: () => { void run('refresh', { action: 'state' }); } }, busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : null, busy === 'refresh' ? '刷新中…' : '刷新')), snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') }, h('span', { className: 'pcs-current-label' }, '当前模拟'), simulating.length
        ? h('div', { className: 'pcs-current-list' }, ...simulating.map(({ provider, rule }) => h('button', {
            type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked,
            'aria-pressed': provider.id === session.selectedProviderId,
            onClick: () => chooseProvider(provider.id),
        }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile') + (rule.concurrency ? ' · 并发 ' + rule.concurrency : '')))))
        : h('span', { className: 'pcs-current-idle-text' }, '未启用（不模拟任何客户端）')) : null, session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' }, h('div', null, h('strong', null, '配置已更新'), h('p', null, '请点刷新后再保存。'))) : null, error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null, notice ? h('div', { className: 'pcs-banner pcs-banner-success', role: 'status' }, notice) : null, !snapshot ? h('div', { className: 'pcs-empty' }, h('strong', null, busy === 'refresh' ? '正在读取' : '尚未读取状态'), busy === 'refresh' ? '正在读取当前 DSH 供应商配置。' : '点右上角刷新重试。') : null, snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('strong', null, '尚无已配置供应商'), '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null, editor, listener, h('p', { className: 'pcs-footer' }, 'v' + types_js_1.PLUGIN_VERSION + ' · 已连接 ' + providers.length + ' 个供应商 · 出站接入 ' + (transportActive ? '已就绪' : '未就绪')
        + (lastRead ? ' · 最近读取 ' + lastRead : '')));
}
exports.name = types_js_1.PLUGIN_NAME;
/**
 * Cordis service dependencies of the browser half. `slots` must be declared here: cordis throws
 * `cannot get property "slots" without inject` on an undeclared service read, which leaves the
 * plugin fiber stuck in `loading` and silently drops every slot registration (this is exactly the
 * shape shipped by dshmarket — `const inject = ["slots","locale","theme"]` at client.js:25690).
 */
exports.inject = [slots_js_1.SLOT_SERVICE_ID];
function apply(ctx) {
    (0, slots_js_1.registerClientUi)(ctx, {
        panel: () => h(ProviderClientPanel),
        icon: (owner) => h(SidebarIcon, { size: owner?.size ?? 16 }),
    });
}
exports.default = { name: exports.name, inject: exports.inject, apply };

},
"/client/model.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFICIAL_ADAPTER = exports.PanelRpcError = exports.DraftValidationError = exports.EDITABLE_OVERRIDE_KEYS = void 0;
exports.isRevisionConflict = isRevisionConflict;
exports.visibleOverrides = visibleOverrides;
exports.configuredProviders = configuredProviders;
exports.profilesForClient = profilesForClient;
exports.parseModelIds = parseModelIds;
exports.ruleToDraft = ruleToDraft;
exports.setDraftClient = setDraftClient;
exports.isDraftDirty = isDraftDirty;
exports.parseOverrides = parseOverrides;
exports.parseConcurrency = parseConcurrency;
exports.draftToRule = draftToRule;
exports.draftProblem = draftProblem;
exports.emptyEditorSession = emptyEditorSession;
exports.projectPanelState = projectPanelState;
exports.reconcileState = reconcileState;
exports.simulatingRules = simulatingRules;
exports.selectProvider = selectProvider;
exports.updateDraft = updateDraft;
exports.restoreSelectedDraft = restoreSelectedDraft;
exports.markRevisionConflict = markRevisionConflict;
exports.buildSaveRequest = buildSaveRequest;
exports.redactText = redactText;
exports.redactUrl = redactUrl;
exports.redactValue = redactValue;
exports.redactListenerEntry = redactListenerEntry;
exports.createPanelApi = createPanelApi;
const types_js_1 = require("../types.js");
exports.EDITABLE_OVERRIDE_KEYS = [
    'version', 'runtimeVersion', 'sdkVersion', 'beta', 'identity', 'originator',
    'metadataFormat', 'extraHeaders',
];
const TEXT_OVERRIDES = ['version', 'runtimeVersion', 'sdkVersion', 'identity', 'originator'];
const HEADER_TEXT_OVERRIDES = ['version', 'runtimeVersion', 'sdkVersion', 'originator'];
const PRIVATE_KEY = /authorization|cookie|apikey|token|password|secret|credential|accountid|deviceid|sessionid|requestid|userid/i;
// Match the host identity-header contract; request/session IDs are editable but still redacted in listener entries.
const CLIENT_IDENTITY_HEADER = /^(user-agent|originator|anthropic-(version|beta|client)|x-app|x-stainless-[a-z-]+|x-(claude-code-session-id|client-request-id|codex-[a-z-]+)|session_id|openai-client)$/i;
const PRIVATE_IDENTITY_HEADER = /(?:^|[-_])(auth(?:orization|entication)?|api[-_]?key|token|credential|secret|password|cookie|account(?:[-_]?id)?|device(?:[-_]?id)?)(?:$|[-_])/i;
const PRIVATE_CONTENT = /^(system|instructions|messages|input|output|prompt|content|text|arguments|tools|tool_?results?|tool_?calls?)$/i;
const MASK = '[REDACTED]';
class DraftValidationError extends Error {
    constructor(message) { super(message); this.name = 'DraftValidationError'; }
}
exports.DraftValidationError = DraftValidationError;
class PanelRpcError extends Error {
    code;
    status;
    constructor(message, code = 'RPC_ERROR', status = 0) {
        super(redactText(message));
        this.name = 'PanelRpcError';
        this.code = code;
        this.status = status;
    }
}
exports.PanelRpcError = PanelRpcError;
function isRevisionConflict(error) {
    return error instanceof PanelRpcError && (error.status === 409 || /conflict|revision.*(stale|mismatch)|stale.*revision/i.test(error.code));
}
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function privateKey(key) { return PRIVATE_KEY.test(key.replace(/[-_\s]/g, '')); }
function editableIdentityHeader(key) {
    return CLIENT_IDENTITY_HEADER.test(key) && !PRIVATE_IDENTITY_HEADER.test(key);
}
/** Display projection only: credentials and persistent account/device identity never enter the editor. */
function visibleOverrides(overrides) {
    if (!overrides)
        return {};
    const result = {};
    for (const key of TEXT_OVERRIDES)
        if (typeof overrides[key] === 'string')
            result[key] = overrides[key];
    if (Array.isArray(overrides.beta))
        result.beta = overrides.beta.filter(value => typeof value === 'string');
    if (overrides.metadataFormat === 'legacy' || overrides.metadataFormat === 'json')
        result.metadataFormat = overrides.metadataFormat;
    if (typeof overrides.instructions === 'string')
        result.instructions = overrides.instructions;
    if (overrides.extraHeaders && isObject(overrides.extraHeaders)) {
        result.extraHeaders = Object.fromEntries(Object.entries(overrides.extraHeaders)
            .filter(([key, value]) => editableIdentityHeader(key) && typeof value === 'string' && value.length <= 4096 && !/[\r\n]/.test(value))
            .map(([key, value]) => [key, redactText(String(value))]));
        if (!Object.keys(result.extraHeaders).length)
            delete result.extraHeaders;
    }
    return result;
}
/** DSH 官方供应商（DeepSeek 官方 / 官方账号）不能也不需要伪装，面板里不列。 */
exports.OFFICIAL_ADAPTER = /^llm-deepseek/;
function configuredProviders(providers) {
    return providers.filter(provider => provider.configured === true && !exports.OFFICIAL_ADAPTER.test(provider.adapter))
        .slice().sort((a, b) => a.label.localeCompare(b.label, 'zh-CN') || a.id.localeCompare(b.id));
}
function profilesForClient(profiles, client) {
    return profiles.filter(profile => profile.client === client);
}
function parseModelIds(text) {
    return [...new Set(text.split(/[,\r\n]+/).map(value => value.trim()).filter(Boolean))];
}
function ruleToDraft(rule, profiles) {
    const client = rule?.client ?? 'none';
    const overrides = visibleOverrides(rule?.overrides);
    const instructionsText = overrides.instructions ?? '';
    delete overrides.instructions;
    return {
        client,
        profile: client === 'none' ? '' : rule?.profile ?? profilesForClient(profiles, client)[0]?.id ?? '',
        restrictModels: Boolean(rule?.modelIds?.length),
        modelIdsText: rule?.modelIds?.join('\n') ?? '',
        overridesText: JSON.stringify(overrides, null, 2),
        instructionsText,
        concurrencyText: rule?.concurrency ? String(rule.concurrency) : '',
        concurrencyMode: rule?.concurrencyMode === 'reject' ? 'reject' : 'queue',
    };
}
function setDraftClient(draft, client, profiles) {
    if (draft.client === client)
        return draft;
    return { ...draft, client, profile: client === 'none' ? '' : profilesForClient(profiles, client)[0]?.id ?? '' };
}
function stableValue(value) {
    if (Array.isArray(value))
        return value.map(stableValue);
    if (isObject(value))
        return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    return value;
}
function draftKey(draft) {
    const concurrency = draft.concurrencyText.trim() || '0';
    if (draft.client === 'none')
        return JSON.stringify(['none', concurrency, draft.concurrencyMode]);
    let overrides;
    try {
        overrides = stableValue(JSON.parse(draft.overridesText || '{}'));
    }
    catch {
        overrides = ['invalid-json', draft.overridesText];
    }
    return JSON.stringify([draft.client, draft.profile.trim(), draft.restrictModels,
        draft.restrictModels ? parseModelIds(draft.modelIdsText).sort() : [], overrides, draft.instructionsText, concurrency, draft.concurrencyMode]);
}
function isDraftDirty(draft) { return draftKey(draft.form) !== draftKey(draft.baseline); }
function parseOverrides(text, instructions) {
    let input;
    try {
        input = JSON.parse(text.trim() || '{}');
    }
    catch {
        throw new DraftValidationError('覆盖 JSON 格式有误，请检查引号与逗号。');
    }
    if (!isObject(input))
        throw new DraftValidationError('高级覆盖应为一个 JSON 对象。');
    const allowed = new Set(exports.EDITABLE_OVERRIDE_KEYS);
    for (const key of Object.keys(input)) {
        if (!allowed.has(key))
            throw new DraftValidationError(key === 'instructions'
                ? 'instructions 请填写在完整指令模板文本框中。'
                : '高级覆盖仅支持列出的公开 profile 字段。');
    }
    const result = {};
    for (const key of TEXT_OVERRIDES) {
        const value = input[key];
        if (value === undefined)
            continue;
        if (typeof value !== 'string' || !value.trim())
            throw new DraftValidationError(key + ' 应为非空字符串。');
        if (HEADER_TEXT_OVERRIDES.includes(key) && (/[\r\n]/.test(value) || value.length > 512)) {
            throw new DraftValidationError(key + ' 应为单行版本或客户端标识。');
        }
        result[key] = key === 'identity' ? value : value.trim();
    }
    if (input.beta !== undefined) {
        if (!Array.isArray(input.beta) || input.beta.length > 64 || input.beta.some(value => typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value))) {
            throw new DraftValidationError('beta 应为单行字符串数组。');
        }
        result.beta = [...new Set(input.beta.map(value => value.trim()))];
    }
    if (input.metadataFormat !== undefined) {
        if (input.metadataFormat !== 'legacy' && input.metadataFormat !== 'json')
            throw new DraftValidationError('metadataFormat 应为 legacy 或 json。');
        result.metadataFormat = input.metadataFormat;
    }
    if (input.extraHeaders !== undefined) {
        if (!isObject(input.extraHeaders) || Object.keys(input.extraHeaders).length > 64)
            throw new DraftValidationError('extraHeaders 应为最多 64 项的字符串键值对象。');
        const entries = Object.entries(input.extraHeaders);
        for (const [key, value] of entries) {
            if (!editableIdentityHeader(key) || typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value)) {
                throw new DraftValidationError('额外请求头仅支持列出的客户端身份字段；值应为最多 4096 字符的单行字符串。');
            }
        }
        result.extraHeaders = Object.fromEntries(entries);
        if (!entries.length)
            delete result.extraHeaders;
    }
    if (instructions.trim()) {
        if (instructions.length > 250_000)
            throw new DraftValidationError('完整指令模板请控制在 250000 字符以内。');
        result.instructions = instructions;
    }
    return Object.keys(result).length ? result : undefined;
}
function parseConcurrency(text) {
    const value = text.trim();
    if (!value)
        return 0;
    if (!/^\d{1,2}$/.test(value))
        throw new DraftValidationError('并发上限应为 0-64 的整数（0 表示不限制）。');
    const limit = Number(value);
    if (limit > 64)
        throw new DraftValidationError('并发上限应为 0-64 的整数（0 表示不限制）。');
    return limit;
}
function draftToRule(draft, profiles) {
    const concurrency = parseConcurrency(draft.concurrencyText);
    const concurrencyMode = draft.concurrencyMode === 'reject' ? 'reject' : 'queue';
    if (draft.client === 'none')
        return concurrency > 0 ? { client: 'none', concurrency, ...(concurrencyMode === 'reject' ? { concurrencyMode } : {}) } : { client: 'none' };
    if (!profilesForClient(profiles, draft.client).some(profile => profile.id === draft.profile)) {
        throw new DraftValidationError('请选择与目标客户端对应的可用 profile。');
    }
    const rule = { client: draft.client, profile: draft.profile };
    if (concurrency > 0) {
        rule.concurrency = concurrency;
        if (concurrencyMode === 'reject')
            rule.concurrencyMode = concurrencyMode;
    }
    if (draft.restrictModels) {
        const models = parseModelIds(draft.modelIdsText);
        if (!models.length)
            throw new DraftValidationError('至少选择一个模型，或关闭模型限制。');
        if (models.length > 500 || models.some(model => model.length > 512))
            throw new DraftValidationError('模型限制列表过长。');
        rule.modelIds = models;
    }
    const overrides = parseOverrides(draft.overridesText, draft.instructionsText);
    if (overrides)
        rule.overrides = overrides;
    return rule;
}
function draftProblem(draft, profiles) {
    if (!draft)
        return '';
    try {
        draftToRule(draft, profiles);
        return '';
    }
    catch (error) {
        return error instanceof DraftValidationError ? error.message : '请检查当前规则。';
    }
}
function emptyEditorSession() {
    return { snapshot: null, selectedProviderId: '', drafts: {}, revisionStale: false };
}
function projectPanelState(state) {
    const rules = Object.fromEntries(Object.entries(state.config.providers).map(([id, rule]) => {
        const clean = { client: rule.client };
        if (rule.profile !== undefined)
            clean.profile = rule.profile;
        if (rule.modelIds !== undefined)
            clean.modelIds = [...rule.modelIds];
        if (rule.concurrency !== undefined && rule.concurrency > 0)
            clean.concurrency = rule.concurrency;
        if (clean.concurrency && rule.concurrencyMode === 'reject')
            clean.concurrencyMode = 'reject';
        const overrides = visibleOverrides(rule.overrides);
        if (Object.keys(overrides).length)
            clean.overrides = overrides;
        return [id, clean];
    }));
    return {
        providers: state.providers.map(provider => ({ id: provider.id, label: provider.label, adapter: provider.adapter,
            modelIds: [...provider.modelIds], configured: provider.configured, ...(provider.protocol ? { protocol: provider.protocol } : {}) })),
        config: { schemaVersion: 1, revision: state.config.revision, providers: rules,
            listener: { enabled: state.config.listener.enabled, maxEntries: state.config.listener.maxEntries } },
        runtime: { transport: state.runtime.transport, registrations: state.runtime.registrations, detail: redactText(state.runtime.detail),
            ...(state.runtime.concurrency ? { concurrency: state.runtime.concurrency.map(item => ({ providerId: item.providerId, limit: item.limit, active: item.active, queued: item.queued })) } : {}) },
        profiles: state.profiles.map(profile => ({ id: profile.id, client: profile.client, version: profile.version,
            label: profile.label, evidence: redactText(profile.evidence) })),
        entries: state.entries.map(redactListenerEntry),
    };
}
/** Refresh is a rebase, never a draft reset. A successful save resets only its own provider. */
function reconcileState(previous, incoming, savedProviderId) {
    const snapshot = projectPanelState(incoming);
    const providers = configuredProviders(snapshot.providers);
    const drafts = { ...previous.drafts };
    for (const provider of providers) {
        const baseline = ruleToDraft(snapshot.config.providers[provider.id], snapshot.profiles);
        const old = previous.drafts[provider.id];
        drafts[provider.id] = { baseline, form: provider.id !== savedProviderId && old && isDraftDirty(old) ? old.form : baseline };
    }
    const selectedStillConfigured = providers.some(provider => provider.id === previous.selectedProviderId);
    const selectedDraft = previous.drafts[previous.selectedProviderId];
    const keepRemovedDraft = selectedDraft && isDraftDirty(selectedDraft);
    // Fresh open (no prior selection) lands on the provider that is currently simulating a client,
    // so the panel always shows "what is being simulated right now" instead of the first provider.
    const simulatingId = providers.find(provider => {
        const rule = snapshot.config.providers[provider.id];
        return rule !== undefined && rule.client !== 'none';
    })?.id;
    const fallbackId = previous.selectedProviderId === ''
        ? simulatingId ?? providers[0]?.id ?? ''
        : providers[0]?.id ?? '';
    return { snapshot, drafts, revisionStale: false,
        selectedProviderId: selectedStillConfigured || keepRemovedDraft ? previous.selectedProviderId : fallbackId };
}
/** Providers that currently have a non-None rule, i.e. the clients being simulated right now. */
function simulatingRules(snapshot, providers) {
    const result = [];
    for (const provider of providers) {
        const rule = snapshot.config.providers[provider.id];
        if (rule && rule.client !== 'none')
            result.push({ provider, rule });
    }
    return result;
}
function selectProvider(session, providerId) {
    if (!session.snapshot || !configuredProviders(session.snapshot.providers).some(provider => provider.id === providerId))
        return session;
    return { ...session, selectedProviderId: providerId };
}
function updateDraft(session, providerId, patch) {
    const draft = session.drafts[providerId];
    if (!draft)
        return session;
    return { ...session, drafts: { ...session.drafts, [providerId]: { ...draft, form: { ...draft.form, ...patch } } } };
}
function restoreSelectedDraft(session) {
    const draft = session.drafts[session.selectedProviderId];
    return draft ? { ...session, drafts: { ...session.drafts, [session.selectedProviderId]: { ...draft, form: draft.baseline } } } : session;
}
function markRevisionConflict(session) { return { ...session, revisionStale: true }; }
function buildSaveRequest(session) {
    if (!session.snapshot)
        throw new DraftValidationError('请先读取供应商状态。');
    if (session.revisionStale)
        throw new DraftValidationError('请先刷新已保存状态；当前草稿会保留。');
    const providerId = session.selectedProviderId;
    if (!configuredProviders(session.snapshot.providers).some(provider => provider.id === providerId)) {
        throw new DraftValidationError('当前供应商已从 DSH 配置移除，草稿已保留。');
    }
    const draft = session.drafts[providerId];
    if (!draft)
        throw new DraftValidationError('请选择供应商。');
    return { action: 'save', providerId, rule: draftToRule(draft.form, session.snapshot.profiles), revision: session.snapshot.config.revision };
}
function redactText(text) {
    return text
        .replace(/\bBearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer ' + MASK)
        .replace(/\bsk-(?:proj-)?[a-z0-9_-]{6,}/gi, MASK)
        .replace(/((?:token|api[_-]?key|password|secret|account[_-]?id|device[_-]?id)=)[^&\s]+/gi, '$1' + MASK)
        .replace(/user_[a-f0-9]+_account_[a-z0-9-]+_session_[a-z0-9-]+/gi, MASK)
        .slice(0, 4000);
}
function redactUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin + parsed.pathname : '[endpoint hidden]';
    }
    catch {
        return '[endpoint hidden]';
    }
}
function redactValue(value, key = '', depth = 0, privateContent = false) {
    if (privateKey(key)) {
        const publicCount = /^(maxtokens|maxoutputtokens|maxcompletiontokens|inputtokens|outputtokens|totaltokens|reasoningtokens|budgettokens|cachecreationinputtokens|cachereadinputtokens)$/i;
        return typeof value === 'number' && Number.isFinite(value) && publicCount.test(key.replace(/[-_\s]/g, '')) ? value : MASK;
    }
    if (depth > 12)
        return '[nested content omitted]';
    const sensitive = privateContent || PRIVATE_CONTENT.test(key);
    if (typeof value === 'string')
        return sensitive ? '[REDACTED: ' + value.length + ' characters]' : redactText(value);
    if (value === null || typeof value === 'boolean' || typeof value === 'number')
        return value;
    if (Array.isArray(value)) {
        const items = value.slice(0, 50).map(item => redactValue(item, '', depth + 1, sensitive));
        if (value.length > 50)
            items.push('[' + (value.length - 50) + ' more items]');
        return items;
    }
    if (isObject(value))
        return Object.fromEntries(Object.entries(value).slice(0, 100).map(([name, item]) => [name, redactValue(item, name, depth + 1, sensitive)]));
    return null;
}
function redactListenerEntry(entry) {
    return { id: entry.id, time: entry.time, providerId: entry.providerId, modelId: entry.modelId,
        client: entry.client, profile: entry.profile, url: redactUrl(entry.url), protocol: entry.protocol,
        targetProtocol: entry.targetProtocol, headers: redactValue(entry.headers),
        body: redactValue(entry.body), ...(entry.status !== undefined ? { status: entry.status } : {}),
        ...(entry.error ? { error: redactText(entry.error) } : {}) };
}
const PROTOCOLS = ['anthropic-messages', 'openai-responses', 'openai-chat-completions'];
function stringList(value) { return Array.isArray(value) && value.every(item => typeof item === 'string'); }
function validListenerEntry(value) {
    if (!isObject(value))
        return false;
    return ['id', 'time', 'providerId', 'modelId', 'profile', 'url'].every(key => typeof value[key] === 'string')
        && (value.client === 'claude-code' || value.client === 'codex')
        && PROTOCOLS.includes(String(value.protocol)) && PROTOCOLS.includes(String(value.targetProtocol))
        && isObject(value.headers) && Object.values(value.headers).every(header => typeof header === 'string')
        && isObject(value.body) && (value.status === undefined || typeof value.status === 'number')
        && (value.error === undefined || typeof value.error === 'string');
}
function validConcurrencyStats(value) {
    if (value === undefined)
        return true;
    return Array.isArray(value) && value.every(item => isObject(item)
        && typeof item.providerId === 'string'
        && Number.isSafeInteger(item.limit) && Number(item.limit) >= 0 && Number(item.limit) <= 64
        && Number.isSafeInteger(item.active) && Number.isSafeInteger(item.queued));
}
function validPanelState(value) {
    if (!isObject(value) || !isObject(value.config) || !isObject(value.runtime))
        return false;
    const config = value.config;
    if (config.schemaVersion !== 1 || !Number.isSafeInteger(config.revision) || Number(config.revision) < 0
        || !isObject(config.providers) || !isObject(config.listener) || typeof config.listener.enabled !== 'boolean'
        || !Number.isSafeInteger(config.listener.maxEntries) || Number(config.listener.maxEntries) < 0
        || !['active', 'waiting', 'unsupported'].includes(String(value.runtime.transport))
        || typeof value.runtime.detail !== 'string' || !Number.isSafeInteger(value.runtime.registrations)
        || !validConcurrencyStats(value.runtime.concurrency))
        return false;
    return Object.values(config.providers).every(rule => isObject(rule) && ['none', 'claude-code', 'codex'].includes(String(rule.client))
        && (rule.profile === undefined || typeof rule.profile === 'string')
        && (rule.modelIds === undefined || stringList(rule.modelIds))
        && (rule.concurrency === undefined || (Number.isSafeInteger(rule.concurrency) && Number(rule.concurrency) >= 0 && Number(rule.concurrency) <= 64))
        && (rule.concurrencyMode === undefined || ['queue', 'reject'].includes(String(rule.concurrencyMode)))
        && (rule.overrides === undefined || isObject(rule.overrides)))
        && Array.isArray(value.providers) && value.providers.every(provider => isObject(provider)
        && ['id', 'label', 'adapter'].every(key => typeof provider[key] === 'string')
        && stringList(provider.modelIds) && typeof provider.configured === 'boolean'
        && (provider.protocol === undefined || PROTOCOLS.includes(String(provider.protocol))))
        && Array.isArray(value.profiles) && value.profiles.every(profile => isObject(profile)
        && ['id', 'label', 'version', 'evidence'].every(key => typeof profile[key] === 'string')
        && (profile.client === 'claude-code' || profile.client === 'codex'))
        && Array.isArray(value.entries) && value.entries.every(validListenerEntry);
}
function createPanelApi(fetcher) {
    return { async call(request, signal) {
            const response = await (fetcher ?? ((path, options) => fetch(path, options)))(types_js_1.API_PATH, {
                method: 'POST', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store',
                headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), ...(signal ? { signal } : {}),
            });
            let payload;
            try {
                payload = await response.json();
            }
            catch {
                throw new PanelRpcError('服务返回了非 JSON 响应，请刷新后重试。', 'INVALID_RESPONSE', response.status);
            }
            if (!isObject(payload))
                throw new PanelRpcError('服务响应格式有误。', 'INVALID_RESPONSE', response.status);
            if (payload.ok !== true)
                throw new PanelRpcError(typeof payload.error === 'string' ? payload.error : '请求未完成，请重试。', typeof payload.code === 'string' ? payload.code : 'RPC_ERROR', response.status);
            if (!response.ok)
                throw new PanelRpcError('请求返回 HTTP ' + response.status + '。', 'HTTP_ERROR', response.status);
            const reply = {};
            if (payload.state !== undefined) {
                if (!validPanelState(payload.state))
                    throw new PanelRpcError('服务状态格式有误。', 'INVALID_RESPONSE', response.status);
                reply.state = projectPanelState(payload.state);
            }
            if (payload.entries !== undefined) {
                if (!Array.isArray(payload.entries) || !payload.entries.every(validListenerEntry)) {
                    throw new PanelRpcError('服务监听记录格式有误。', 'INVALID_RESPONSE', response.status);
                }
                reply.entries = payload.entries.map(redactListenerEntry);
            }
            if (request.action === 'state' || request.action === 'save' || request.action === 'listener') {
                if (!reply.state)
                    throw new PanelRpcError('服务未返回最新配置状态。', 'INVALID_RESPONSE', response.status);
            }
            else if (request.action === 'logs' && !reply.state && !reply.entries) {
                throw new PanelRpcError('服务未返回监听记录。', 'INVALID_RESPONSE', response.status);
            }
            else if (request.action === 'clear' && !reply.state && !reply.entries)
                reply.entries = [];
            return reply;
        } };
}

},
"/client/slots.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANEL_ID = exports.MAIN_SLOT_ID = exports.SIDEBAR_SLOT_ID = exports.SETTINGS_SLOT_ID = exports.SLOT_SERVICE_ID = exports.PANEL_TITLE = void 0;
exports.registerClientUi = registerClientUi;
const types_js_1 = require("../types.js");
exports.PANEL_TITLE = '供应商客户端模拟';
exports.SLOT_SERVICE_ID = 'slots';
exports.SETTINGS_SLOT_ID = 'settings.section';
exports.SIDEBAR_SLOT_ID = 'sidebar.panellist';
exports.MAIN_SLOT_ID = 'main';
/** Stable panel identity; the sidebar row `id` and the main-panel `key` must match so a click opens the panel. */
exports.PANEL_ID = types_js_1.PLUGIN_NAME;
/**
 * Resolve the slot registry from either accessor spelling used by shipped bundles:
 * the `ctx.slots` property (dshmarket/client.js:25539 `const slots = host.slots`) and the
 * `ctx.get('slots')` service lookup. A bundle can materialize before the shell attaches the
 * registry, in which case both spellings miss and the caller must retry.
 */
function resolveSlots(ctx) {
    const attached = ctx.slots;
    if (attached && typeof attached.inject === 'function' && typeof attached.register === 'function')
        return attached;
    const viaService = ctx.get(exports.SLOT_SERVICE_ID);
    if (viaService && typeof viaService.inject === 'function' && typeof viaService.register === 'function')
        return viaService;
    return undefined;
}
function registerAll(slots, render) {
    slots.inject(exports.SETTINGS_SLOT_ID, () => slots.register({
        name: exports.SETTINGS_SLOT_ID, id: exports.PANEL_ID, order: 40, label: () => exports.PANEL_TITLE,
    }, render.panel));
    slots.inject(exports.MAIN_SLOT_ID, () => slots.register({
        name: exports.MAIN_SLOT_ID, key: exports.PANEL_ID, label: () => exports.PANEL_TITLE,
    }, render.panel));
    slots.inject(exports.SIDEBAR_SLOT_ID, () => slots.register({
        name: exports.SIDEBAR_SLOT_ID, id: exports.PANEL_ID, order: 30, label: () => exports.PANEL_TITLE,
    }, render.icon));
}
/**
 * The left-rail icon row, the main page it opens, and the settings section that all share one
 * panel identity.
 *
 * Ordering is cordis's job, not ours: the plugin declares `inject = ['slots']`, so `ctx.slots` is
 * ready before `apply` runs and an absent registry simply means this shell has no slot service
 * (then we register nothing and stay inert instead of inventing a mount path).
 */
function registerClientUi(ctx, render) {
    const slots = resolveSlots(ctx);
    if (!slots)
        return;
    registerAll(slots, render);
}

},
"/client/styles.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANEL_CSS = void 0;
exports.PANEL_CSS = String.raw `.pcs-root {
  --pcs-fg-fallback: #172336; --pcs-muted-fallback: #64748b;
  --pcs-bg-fallback: #ffffff; --pcs-layer-fallback: #f6f8fc; --pcs-border-fallback: #e1e6ee;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback));
  --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback));
  --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback));
  --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: var(--dsw-alias-brand-primary, #5265de);
  --pcs-success: var(--dsw-alias-state-success-primary, #178654);
  --pcs-warn: var(--dsw-alias-state-warn-primary, #a16207);
  --pcs-error: var(--dsw-alias-state-error-primary, #c43e4a);
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1040px;
  color: var(--pcs-fg); font: inherit; font-size: 13px; line-height: 1.6;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e5eaf3; --pcs-muted-fallback: #a1adc0;
    --pcs-bg-fallback: #171d29; --pcs-layer-fallback: #1d2534; --pcs-border-fallback: #343e50; }
}
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select, .pcs-root textarea { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .5; }
.pcs-root button:focus-visible, .pcs-root select:focus-visible, .pcs-root textarea:focus-visible,
.pcs-root input:focus-visible, .pcs-root summary:focus-visible {
  outline: 2px solid var(--pcs-brand); outline-offset: 3px;
}
.pcs-root h2, .pcs-root h3, .pcs-root h4, .pcs-root p { margin: 0; }
.pcs-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.pcs-eyebrow { display: flex; align-items: center; gap: 7px; color: var(--pcs-brand); font-size: 11px; font-weight: 650; letter-spacing: .04em; margin-bottom: 6px; }
.pcs-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.pcs-root .pcs-title { font-size: 23px; line-height: 1.35; font-weight: 700; letter-spacing: -.035em; }
.pcs-subtitle { max-width: 600px; margin-top: 8px !important; color: var(--pcs-muted); line-height: 1.75; }
.pcs-button { border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); color: var(--pcs-fg); padding: 7px 12px; line-height: 1.4; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; min-height: 34px; transition: border-color 120ms ease, background 120ms ease; }
.pcs-button:hover:not(:disabled) { border-color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 5%, var(--pcs-bg)); }
.pcs-button-primary { border-color: var(--pcs-brand); background: var(--pcs-brand); color: #fff; font-weight: 650; }
.pcs-button-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--pcs-brand) 90%, #000); }
.pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); }
.pcs-button-danger { color: var(--pcs-error); }
.pcs-refresh { flex-shrink: 0; margin-top: 24px; }
.pcs-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.pcs-stat { min-width: 0; border: 1px solid var(--pcs-border); background: var(--pcs-layer); border-radius: 10px; padding: 11px 13px; }
.pcs-stat-label { color: var(--pcs-muted); font-size: 11px; margin-bottom: 3px; }
.pcs-stat-value { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.pcs-muted { color: var(--pcs-muted); }
.pcs-small { font-size: 11px; }
.pcs-banner { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 11px 13px; border: 1px solid var(--pcs-border); border-radius: 9px; margin-bottom: 14px; overflow-wrap: anywhere; }
.pcs-banner-warning { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 36%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 6%, var(--pcs-bg)); }
.pcs-banner-error { color: var(--pcs-error); border-color: color-mix(in srgb, var(--pcs-error) 36%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-error) 6%, var(--pcs-bg)); }
.pcs-banner-success { color: var(--pcs-success); border-color: color-mix(in srgb, var(--pcs-success) 32%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, var(--pcs-bg)); }
.pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 10px 13px; margin-bottom: 14px; border: 1px solid color-mix(in srgb, var(--pcs-success) 34%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, var(--pcs-bg)); border-radius: 9px; }
.pcs-current-idle { border-color: var(--pcs-border); background: var(--pcs-layer); }
.pcs-current-label { font-size: 11px; font-weight: 650; color: var(--pcs-success); flex-shrink: 0; }
.pcs-current-idle .pcs-current-label { color: var(--pcs-muted); }
.pcs-current-list { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.pcs-current-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; border: 1px solid color-mix(in srgb, var(--pcs-success) 40%, var(--pcs-border)); background: var(--pcs-bg); color: var(--pcs-fg); border-radius: 999px; padding: 3px 11px; font-size: 11px; overflow-wrap: anywhere; }
.pcs-current-chip strong { font-weight: 650; }
.pcs-current-chip span { color: var(--pcs-muted); }
.pcs-current-chip:hover:not(:disabled) { border-color: var(--pcs-success); }
.pcs-current-chip[aria-pressed="true"] { border-color: var(--pcs-success); background: color-mix(in srgb, var(--pcs-success) 9%, var(--pcs-bg)); }
.pcs-current-idle-text { font-size: 11px; color: var(--pcs-muted); }
.pcs-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(220px, 1fr); gap: 16px; align-items: start; }
.pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 12px; background: var(--pcs-bg); overflow: hidden; }
.pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px; border-bottom: 1px solid var(--pcs-border); }
.pcs-card-head h3 { font-size: 14px; font-weight: 650; }
.pcs-card-body { padding: 16px; }
.pcs-badge { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 2px 7px; font-size: 10px; line-height: 1.6; border: 1px solid var(--pcs-border); color: var(--pcs-muted); border-radius: 5px; }
.pcs-badge-saved { color: var(--pcs-success); border-color: color-mix(in srgb, var(--pcs-success) 30%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, transparent); }
.pcs-badge-draft { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 30%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 5%, transparent); }
.pcs-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.pcs-field { display: block; margin-bottom: 18px; }
.pcs-field-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 650; margin-bottom: 7px; }
.pcs-field-step { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: var(--pcs-layer); border: 1px solid var(--pcs-border); color: var(--pcs-muted); font-size: 10px; margin-right: 7px; }
.pcs-control { width: 100%; min-width: 0; color: var(--pcs-fg); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; padding: 9px 10px; outline: 0; }
.pcs-control:focus { border-color: var(--pcs-brand); }
.pcs-control:disabled { opacity: .65; }
.pcs-number { max-width: 150px; }
.pcs-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size: 11px !important; }
.pcs-textarea { display: block; resize: vertical; line-height: 1.65; min-height: 85px; tab-size: 2; }
.pcs-instructions { min-height: 130px; }
.pcs-help { margin-top: 6px !important; font-size: 11px; color: var(--pcs-muted); line-height: 1.75; overflow-wrap: anywhere; }
.pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pcs-client { position: relative; display: flex; align-items: flex-start; gap: 8px; padding: 11px 9px; min-width: 0; border: 1px solid var(--pcs-border); border-radius: 9px; background: var(--pcs-bg); cursor: pointer; }
.pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); }
.pcs-client input { margin: 3px 0 0; accent-color: var(--pcs-brand); width: 13px; height: 13px; flex-shrink: 0; }
.pcs-client-name { display: block; font-size: 12px; font-weight: 650; line-height: 1.6; }
.pcs-client-description { display: block; font-size: 10px; color: var(--pcs-muted); line-height: 1.7; margin-top: 3px; }
.pcs-check { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.pcs-check input { accent-color: var(--pcs-brand); width: 14px; height: 14px; }
.pcs-models { margin-top: 10px; }
.pcs-model-options { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.pcs-model-chip { color: var(--pcs-muted); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 5px; padding: 3px 7px; overflow-wrap: anywhere; font-size: 10px; max-width: 100%; }
.pcs-model-chip[aria-pressed="true"] { color: var(--pcs-brand); border-color: color-mix(in srgb, var(--pcs-brand) 50%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); }
.pcs-advanced { border-top: 1px solid var(--pcs-border); padding-top: 12px; margin-top: 14px; }
.pcs-advanced > summary { cursor: pointer; color: var(--pcs-muted); font-size: 12px; font-weight: 600; }
.pcs-advanced[open] > summary { color: var(--pcs-fg); margin-bottom: 12px; }
.pcs-advanced-note { padding: 9px 10px; margin-bottom: 14px !important; background: var(--pcs-layer); border-radius: 7px; font-size: 11px; color: var(--pcs-muted); }
.pcs-effective { margin-top: 12px; border: 1px dashed var(--pcs-border); padding: 10px 11px; border-radius: 8px; }
.pcs-effective-label { font-size: 10px; color: var(--pcs-muted); margin-bottom: 5px; }
.pcs-effective strong { font-size: 12px; font-weight: 600; }
.pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: var(--pcs-layer); border-top: 1px solid var(--pcs-border); }
.pcs-action-buttons { display: flex; align-items: center; gap: 7px; }
.pcs-validation { color: var(--pcs-error); font-size: 11px; margin: 10px 0 0 !important; }
.pcs-rules { display: grid; gap: 8px; }
.pcs-rule { display: block; text-align: left; width: 100%; min-width: 0; background: var(--pcs-bg); color: var(--pcs-fg); border: 1px solid var(--pcs-border); border-radius: 9px; padding: 11px 12px; transition: border-color 120ms ease; }
.pcs-rule:hover:not(:disabled), .pcs-rule[aria-pressed="true"] { border-color: var(--pcs-brand); }
.pcs-rule[aria-pressed="true"] { background: color-mix(in srgb, var(--pcs-brand) 4%, var(--pcs-bg)); }
.pcs-rule-name { display: flex; align-items: center; justify-content: space-between; gap: 7px; font-size: 12px; font-weight: 650; margin-bottom: 6px; }
.pcs-rule-title { min-width: 0; overflow-wrap: anywhere; }
.pcs-rule-client { font-size: 11px; font-weight: 600; }
.pcs-rule-meta { margin-top: 4px; color: var(--pcs-muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.pcs-listener { margin-top: 16px; }
.pcs-listener-head { align-items: flex-start; flex-wrap: wrap; }
.pcs-listener-head h3 { display: flex; align-items: center; gap: 8px; }
.pcs-switch { border: 1px solid var(--pcs-border); background: var(--pcs-layer); color: var(--pcs-muted); border-radius: 7px; display: inline-flex; align-items: center; gap: 9px; padding: 6px 10px; font-size: 11px; }
.pcs-switch-track { width: 27px; height: 15px; border-radius: 12px; background: var(--pcs-border); padding: 2px; display: inline-flex; }
.pcs-switch-knob { width: 11px; height: 11px; background: var(--pcs-bg); border-radius: 50%; }
.pcs-switch[aria-checked="true"] { color: var(--pcs-success); }
.pcs-switch[aria-checked="true"] .pcs-switch-track { background: var(--pcs-success); justify-content: flex-end; }
.pcs-listener-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 13px; }
.pcs-log-list { display: grid; gap: 8px; }
.pcs-log { min-width: 0; background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; overflow: hidden; }
.pcs-log > summary { padding: 10px 12px; cursor: pointer; font-size: 11px; overflow-wrap: anywhere; }
.pcs-log-content { border-top: 1px solid var(--pcs-border); padding: 12px; }
.pcs-log-meta { display: flex; gap: 6px 14px; flex-wrap: wrap; color: var(--pcs-muted); font-size: 10px; margin-bottom: 9px; }
.pcs-log-label { font-size: 10px; font-weight: 650; margin-top: 10px; margin-bottom: 5px; }
.pcs-log pre { margin: 0; max-height: 260px; max-width: 100%; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pcs-fg); border: 1px solid var(--pcs-border); background: var(--pcs-bg); padding: 10px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; line-height: 1.7; }
.pcs-empty { text-align: center; padding: 26px 16px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 9px; }
.pcs-empty strong { display: block; margin-bottom: 5px; color: var(--pcs-fg); font-size: 12px; font-weight: 600; }
.pcs-footer { margin-top: 13px; color: var(--pcs-muted); font-size: 10px; text-align: right; }
.pcs-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pcs-version { font-size: 11px; font-weight: 600; letter-spacing: 0; color: var(--pcs-muted); border: 1px solid var(--pcs-border); border-radius: 999px; padding: 2px 8px; }
.pcs-listener > summary { cursor: pointer; font-size: 12px; font-weight: 650; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
.pcs-listener[open] > summary { border-bottom: 1px solid var(--pcs-border); }
.pcs-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; display: inline-block; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pcs-spin { animation: none; } .pcs-root button { transition: none; } }
@container (max-width: 800px) {
  .pcs-grid { grid-template-columns: minmax(0, 1fr); }
  .pcs-rules { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 520px) {
  .pcs-hero { gap: 10px; flex-wrap: wrap; }
  .pcs-title { font-size: 21px !important; }
  .pcs-refresh { margin-top: 0; }
  .pcs-stats { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .pcs-stat { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 11px; }
  .pcs-stat-label { margin-bottom: 0; }
  .pcs-stat-value { font-size: 12px; }
  .pcs-card-body { padding: 13px; }
  .pcs-card-head { padding: 11px 13px; }
  .pcs-clients, .pcs-rules { grid-template-columns: minmax(0, 1fr); }
  .pcs-client { padding: 8px 10px; }
  .pcs-client-description { margin-top: 0; }
  .pcs-actions { padding: 11px 13px; flex-wrap: wrap; }
  .pcs-action-buttons { width: 100%; justify-content: flex-end; }
  .pcs-banner { flex-wrap: wrap; }
}
`;

},
"/types.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_PATH = exports.SETTINGS_NS = exports.PLUGIN_VERSION = exports.PLUGIN_NAME = void 0;
exports.PLUGIN_NAME = 'dsh-mimic';
/** Build replaces this marker with package.json version; the test suite asserts they match. */
exports.PLUGIN_VERSION = '0.3.1';
exports.SETTINGS_NS = 'dsh-mimic';
exports.API_PATH = '/dsh-mimic/api';
/** RPC: state {}; save {providerId,rule,revision}; listener {enabled,revision}; logs {}; clear {}. */

}}; const cache={};
function load(id) { if(cache[id])return cache[id].exports; if(!factories[id])return external(id); const module={exports:{}}; cache[id]=module; const local=(name)=>{ if(!name.startsWith("."))return external(name); const parts=id.split("/");parts.pop(); for(const p of name.split("/")){if(p==="..")parts.pop();else if(p!==".")parts.push(p);} return load(parts.join("/")); }; factories[id](local,module,module.exports); return module.exports;}
const entry=load("/client/index.js");return entry.default || entry;
}});
