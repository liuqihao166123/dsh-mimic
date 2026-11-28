/* Generated from TypeScript. React is provided by the DSH browser host. */
window.__ModuleLoader__.load({ id: "dsh-mimic", factory: function(external) {
const factories={"/client/brand.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONO_LOGO_DATA_URI = exports.LOGO_DATA_URI = void 0;
/**
 * Original DSH Mimic artwork. Keep the two SVG strings in sync with assets/logo*.svg.
 * The monochrome URI is intended for a CSS mask whose background is currentColor.
 * An <img> document does not inherit its parent's CSS color.
 */
const COLOR_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none">
  <title>DSH Mimic</title>
  <rect width="32" height="32" rx="8" fill="#E8F6F3"/>
  <g stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 26V6L16 18L21 12" stroke="#0D9488"/>
    <path d="M21 12L26 6V26" stroke="#17324D"/>
  </g>
</svg>
`;
const MONO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <title>DSH Mimic</title>
  <g stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 26V6L16 18L21 12" stroke="currentColor"/>
    <path d="M21 12L26 6V26" stroke="currentColor"/>
  </g>
</svg>
`;
const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
/** A self-contained 64px color tile for panel headers and plugin metadata. */
exports.LOGO_DATA_URI = svgDataUri(COLOR_LOGO_SVG);
/** An unbacked currentColor mark; use as a CSS mask to inherit the surrounding theme. */
exports.MONO_LOGO_DATA_URI = svgDataUri(MONO_LOGO_SVG);

},
"/client/index.js": function(require,module,exports) {
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
const brand_js_1 = require("./brand.js");
const styles_js_1 = require("./styles.js");
const h = React.createElement;
const CLIENTS = [
    { id: 'none', label: '原样请求', short: 'None', description: '不模拟，保持原始请求结构' },
    { id: 'claude-code', label: 'Claude Code', short: 'Claude', description: 'Anthropic Messages 客户端指纹' },
    { id: 'codex', label: 'Codex', short: 'Codex', description: 'OpenAI Responses 客户端指纹' },
];
const clientLabel = (client) => CLIENTS.find(item => item.id === client)?.label ?? client;
const clientShort = (client) => CLIENTS.find(item => item.id === client)?.short ?? client;
const SidebarIcon = ({ size = 16 }) => h('span', {
    className: 'pcs-sidebar-logo', 'aria-hidden': true,
    style: {
        display: 'inline-block', flexShrink: 0, backgroundColor: 'currentColor', verticalAlign: 'middle',
        width: size, height: size,
        WebkitMaskPosition: 'center', maskPosition: 'center', WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskImage: `url("${brand_js_1.MONO_LOGO_DATA_URI}")`, maskImage: `url("${brand_js_1.MONO_LOGO_DATA_URI}")`,
    },
});
function Badge(props) {
    return h('span', { className: 'pcs-badge ' + (props.draft ? 'pcs-badge-draft' : 'pcs-badge-saved') }, h('span', { className: 'pcs-badge-dot', 'aria-hidden': true }), props.children);
}
function entryTime(time) {
    const date = new Date(time);
    return Number.isNaN(date.getTime()) ? time : date.toLocaleString('zh-CN', { hour12: false });
}
function formatTokens(value) {
    if (value >= 1_000_000)
        return (value / 1_000_000).toFixed(1) + 'm';
    if (value >= 1000)
        return (value / 1000).toFixed(1) + 'k';
    return String(value);
}
function statusLabel(transport) {
    return transport === 'active' ? '接入已就绪' : transport === 'waiting' ? '等待接入' : '暂不可用';
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
    const providerField = form ? h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-provider' }, h('span', { className: 'pcs-label-main' }, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '01'), '供应商'), selected ? h('span', { className: 'pcs-label-aside' }, selected.modelIds.length + ' 个模型') : null), h('select', {
        id: fieldId + '-provider', className: 'pcs-control', value: session.selectedProviderId,
        onChange: (event) => chooseProvider(event.currentTarget.value),
    }, !selected && session.selectedProviderId ? h('option', { value: session.selectedProviderId, disabled: true }, '供应商已移除') : null, ...providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.label))), h('p', { className: 'pcs-help' }, selected ? selected.adapter + ' · ' + (selected.protocol ?? '自动识别') + ' · 已配置 ' + selected.modelIds.length + ' 个模型' : '此供应商已从 DSH 配置移除。')) : null;
    const clientField = form ? h('div', { className: 'pcs-field' }, h('div', { className: 'pcs-field-label', id: fieldId + '-client-label' }, h('span', { className: 'pcs-label-main' }, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '02'), '客户端身份'), h('span', { className: 'pcs-label-aside' }, '头 + 体同步')), h('div', { className: 'pcs-clients', role: 'radiogroup', 'aria-labelledby': fieldId + '-client-label' }, ...CLIENTS.map(client => h('label', { key: client.id, className: 'pcs-client' }, h('input', {
        type: 'radio', name: fieldId + '-client', value: client.id, checked: form.client === client.id,
        onChange: () => patch((0, model_js_1.setDraftClient)(form, client.id, snapshot?.profiles ?? [])),
    }), h('span', { className: 'pcs-client-copy' }, h('span', { className: 'pcs-client-topline' }, h('span', { className: 'pcs-client-mark' }, client.short.slice(0, 1)), h('span', { className: 'pcs-client-name' }, client.label)), h('span', { className: 'pcs-client-description' }, client.description))))), h('p', { className: 'pcs-help' }, '保存后，其他供应商会自动恢复为原样请求。')) : null;
    const concurrencyStat = snapshot?.runtime.concurrency?.find(item => item.providerId === session.selectedProviderId);
    const cacheStat = snapshot?.runtime.cache?.find(item => item.providerId === session.selectedProviderId);
    const cacheLine = snapshot && session.selectedProviderId
        ? (cacheStat && cacheStat.requests > 0
            ? h('p', { className: 'pcs-cache' }, '缓存命中 ', h('strong', null, (cacheStat.hitRate * 100).toFixed(1) + '%'), ' · 最近 ' + cacheStat.requests + ' 次 · 输入 ' + formatTokens(cacheStat.promptTokens) + ' / 命中 ' + formatTokens(cacheStat.cachedTokens))
            : h('p', { className: 'pcs-cache' }, '缓存命中 ', h('strong', null, '—'), ' · 等待下一次经过该供应商的请求'))
        : null;
    const concurrencyField = form ? h('div', { className: 'pcs-field pcs-field-compact' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-concurrency' }, h('span', { className: 'pcs-label-main' }, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '03'), '并发上限'), h('span', { className: 'pcs-label-aside' }, '0 = 不限制')), h('div', { className: 'pcs-inline-controls' }, h('input', {
        id: fieldId + '-concurrency', className: 'pcs-control pcs-number', type: 'number', inputMode: 'numeric',
        min: 0, max: 64, step: 1, value: form.concurrencyText, placeholder: '0',
        onChange: (event) => patch({ concurrencyText: event.currentTarget.value }),
    }), h('select', {
        id: fieldId + '-concurrency-mode', className: 'pcs-control', value: form.concurrencyMode, 'aria-label': '超出并发上限时',
        onChange: (event) => patch({ concurrencyMode: event.currentTarget.value === 'reject' ? 'reject' : 'queue' }),
    }, h('option', { value: 'queue' }, '超限排队'), h('option', { value: 'reject' }, '超限报错'))), h('p', { className: 'pcs-help' }, concurrencyStat
        ? '当前并发 ' + concurrencyStat.active + ' / ' + concurrencyStat.limit + (concurrencyStat.queued ? ' · 排队 ' + concurrencyStat.queued : '')
        : '限制该供应商同时在途的生成请求数。')) : null;
    const editor = form && providerField && clientField ? h('article', { className: 'pcs-card pcs-editor', 'aria-labelledby': fieldId + '-editor' }, h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CONFIGURATION'), h('h3', { id: fieldId + '-editor' }, '模拟设置')), h(Badge, { draft: dirty, children: dirty ? '未保存' : savedRule && savedRule.client !== 'none' ? '已生效' : '未启用' })), h('div', { className: 'pcs-card-body' }, h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, providerField, clientField, concurrencyField)), h('div', { className: 'pcs-actions' }, h('div', { className: 'pcs-action-note' }, h('span', { className: 'pcs-action-indicator ' + (dirty ? 'is-dirty' : '') }), dirty ? '修改尚未应用' : savedRule && savedRule.client !== 'none' ? '正在拦截并转换出站请求' : '选择客户端后保存以启用'), h('div', { className: 'pcs-action-buttons' }, dirty ? button('还原', () => { setError(''); setNotice(''); setSession(model_js_1.restoreSelectedDraft); }, { className: 'pcs-button-quiet' }) : null, button(busy === 'save' ? '保存中…' : '保存更改', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;
    const overview = snapshot ? h('aside', { className: 'pcs-overview' }, h('div', { className: 'pcs-overview-head' }, h('div', { className: 'pcs-card-kicker' }, 'LIVE OVERVIEW'), h('h3', null, '运行概览')), h('div', { className: 'pcs-overview-status ' + (transportActive ? 'is-ready' : 'is-waiting') }, h('span', { className: 'pcs-status-icon', 'aria-hidden': true }, transportActive ? '✓' : '·'), h('div', null, h('strong', null, statusLabel(snapshot.runtime.transport)), h('span', null, snapshot.runtime.detail))), h('div', { className: 'pcs-metric-grid' }, h('div', { className: 'pcs-metric' }, h('span', null, '已连接供应商'), h('strong', null, String(providers.length))), h('div', { className: 'pcs-metric' }, h('span', null, '当前模拟'), h('strong', null, simulating.length ? clientShort(simulating[0].rule.client) : '—')), h('div', { className: 'pcs-metric' }, h('span', null, '监听记录'), h('strong', null, String(snapshot.entries.length))), h('div', { className: 'pcs-metric' }, h('span', null, '注册挂载'), h('strong', null, String(snapshot.runtime.registrations)))), h('div', { className: 'pcs-rule-list' }, h('div', { className: 'pcs-section-caption' }, 'ACTIVE ROUTES'), simulating.length ? simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-route', disabled: blocked, onClick: () => chooseProvider(provider.id) }, h('span', { className: 'pcs-route-mark' }, clientShort(rule.client).slice(0, 1)), h('span', { className: 'pcs-route-copy' }, h('strong', null, provider.label), h('small', null, clientLabel(rule.client))), h('span', { className: 'pcs-route-arrow' }, '→')))
        : h('p', { className: 'pcs-overview-empty' }, '还没有启用模拟路由。')), h('div', { className: 'pcs-overview-foot' }, h('img', { src: brand_js_1.LOGO_DATA_URI, alt: '', 'aria-hidden': true }), h('span', null, '身份字段在同一请求中原子变换'))) : null;
    const listener = snapshot ? h('details', { className: 'pcs-card pcs-listener', 'aria-labelledby': fieldId + '-listener' }, h('summary', { id: fieldId + '-listener' }, h('span', { className: 'pcs-summary-icon' }, '◌'), h('span', null, '出站请求监听'), h('span', { className: 'pcs-small pcs-muted' }, '调试 · 脱敏'), h('span', { className: 'pcs-summary-count' }, snapshot.entries.length + ' 条')), h('div', { className: 'pcs-card-body' }, h('div', { className: 'pcs-listener-toolbar' }, h('button', { type: 'button', className: 'pcs-switch', role: 'switch', 'aria-label': '出站请求监听',
        'aria-checked': listenerEnabled, disabled: blocked || session.revisionStale || (!listenerEnabled && !transportActive),
        onClick: () => { void run('listener', { action: 'listener', enabled: !listenerEnabled, revision: snapshot.config.revision }); } }, h('span', { className: 'pcs-switch-track', 'aria-hidden': true }, h('span', { className: 'pcs-switch-knob' })), busy === 'listener' ? '更新中…' : listenerEnabled ? '监听中' : '已关闭'), h('span', { className: 'pcs-small pcs-muted' }, '上限 ' + snapshot.config.listener.maxEntries), h('div', { className: 'pcs-action-buttons' }, button(busy === 'logs' ? '读取中…' : '读取记录', () => { void run('logs', { action: 'logs' }); }), button(busy === 'clear' ? '清空中…' : '清空', () => { void run('clear', { action: 'clear' }); }, { disabled: !snapshot.entries.length, className: 'pcs-button-danger' }))), !transportActive ? h('p', { className: 'pcs-help' }, '出站接入尚未就绪：' + snapshot.runtime.detail) : null, snapshot.entries.length ? h('div', { className: 'pcs-log-list' }, ...snapshot.entries.slice().reverse().map(entry => h('details', { key: entry.id, className: 'pcs-log' }, h('summary', null, h('span', { className: 'pcs-log-dot' }), (snapshot.providers.find(provider => provider.id === entry.providerId)?.label ?? '供应商') + ' · ' + entry.modelId + ' · ' + entryTime(entry.time)), h('div', { className: 'pcs-log-content' }, h('div', { className: 'pcs-log-meta' }, h('span', null, clientLabel(entry.client) + ' · ' + entry.profile), h('span', null, entry.protocol + ' → ' + entry.targetProtocol), entry.status !== undefined ? h('span', null, 'HTTP ' + entry.status) : null), h('p', { className: 'pcs-help pcs-code' }, entry.url), entry.error ? h('p', { className: 'pcs-validation' }, entry.error) : null, h('div', { className: 'pcs-log-label' }, '请求头 · 已脱敏'), h('pre', null, JSON.stringify(entry.headers, null, 2)), h('div', { className: 'pcs-log-label' }, '请求体 · 结构与指纹摘要'), h('pre', null, JSON.stringify(entry.body, null, 2))))))
        : h('p', { className: 'pcs-help' }, listenerEnabled ? '正常使用后点「读取记录」查看实际出站摘要。' : '开启监听后才会记录出站请求。'))) : null;
    return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked }, h('style', null, styles_js_1.PANEL_CSS), h('header', { className: 'pcs-hero' }, h('div', { className: 'pcs-brand-lockup' }, h('img', { className: 'pcs-brand-logo', src: brand_js_1.LOGO_DATA_URI, alt: '' }), h('div', null, h('div', { className: 'pcs-eyebrow' }, 'DSH PLUGIN · WIRE IDENTITY'), h('h2', { className: 'pcs-title', id: fieldId + '-title' }, slots_js_1.PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + types_js_1.PLUGIN_VERSION)), h('p', { className: 'pcs-subtitle' }, '为指定供应商选择客户端身份，头与体在同一次出站请求中同步生效。'))), h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked, onClick: () => { void run('refresh', { action: 'state' }); } }, busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : h('span', { className: 'pcs-refresh-icon', 'aria-hidden': true }, '↻'), busy === 'refresh' ? '刷新中…' : '刷新')), snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') }, h('div', { className: 'pcs-current-heading' }, h('span', { className: 'pcs-live-dot', 'aria-hidden': true }), h('span', null, '当前模拟')), simulating.length
        ? h('div', { className: 'pcs-current-list' }, ...simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked, 'aria-pressed': provider.id === session.selectedProviderId, onClick: () => chooseProvider(provider.id) }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile') + (rule.concurrency ? ' · 并发 ' + rule.concurrency : '')))))
        : h('span', { className: 'pcs-current-idle-text' }, '未启用 · 选择下方客户端开始模拟')) : null, cacheLine, session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' }, h('div', null, h('strong', null, '配置已更新'), h('p', null, '请点刷新后再保存。'))) : null, error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null, notice ? h('div', { className: 'pcs-banner pcs-banner-success', role: 'status' }, notice) : null, !snapshot ? h('div', { className: 'pcs-empty' }, h('div', { className: 'pcs-empty-logo' }, h('img', { src: brand_js_1.LOGO_DATA_URI, alt: '' })), h('strong', null, busy === 'refresh' ? '正在连接 DSH' : '尚未读取状态'), busy === 'refresh' ? '正在读取当前供应商配置。' : '点右上角刷新重试。') : null, snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('div', { className: 'pcs-empty-logo' }, h('img', { src: brand_js_1.LOGO_DATA_URI, alt: '' })), h('strong', null, '尚无已配置供应商'), '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null, snapshot && form ? h('div', { className: 'pcs-layout' }, editor, overview) : null, listener, h('p', { className: 'pcs-footer' }, h('span', null, 'dsh-mimic · v' + types_js_1.PLUGIN_VERSION), h('span', null, providers.length + ' 个供应商 · 出站接入 ' + (transportActive ? '已就绪' : '未就绪') + (lastRead ? ' · 最近读取 ' + lastRead : ''))));
}
exports.name = types_js_1.PLUGIN_NAME;
/** Cordis browser service dependency. */
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
            ...(state.runtime.concurrency ? { concurrency: state.runtime.concurrency.map(item => ({ providerId: item.providerId, limit: item.limit, active: item.active, queued: item.queued })) } : {}),
            ...(state.runtime.cache ? { cache: state.runtime.cache.map(item => ({ providerId: item.providerId, requests: item.requests, promptTokens: item.promptTokens, cachedTokens: item.cachedTokens, hitRate: item.hitRate })) } : {}) },
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
function validCacheStats(value) {
    if (value === undefined)
        return true;
    return Array.isArray(value) && value.every(item => isObject(item)
        && typeof item.providerId === 'string'
        && Number.isSafeInteger(item.requests) && Number(item.requests) >= 0
        && Number.isSafeInteger(item.promptTokens) && Number(item.promptTokens) >= 0
        && Number.isSafeInteger(item.cachedTokens) && Number(item.cachedTokens) >= 0
        && typeof item.hitRate === 'number' && Number.isFinite(item.hitRate) && item.hitRate >= 0 && item.hitRate <= 1);
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
        || !validConcurrencyStats(value.runtime.concurrency) || !validCacheStats(value.runtime.cache))
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
exports.PANEL_CSS = String.raw `
.pcs-root {
  --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d;
  --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback));
  --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback));
  --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback));
  --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: #0f8177; --pcs-button-fill: #0d8176; --pcs-warn: #a66a13; --pcs-error: #c04450;
  --pcs-soft: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg));
  --pcs-shadow: 0 4px 20px #173d4910;
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto;
  padding: 30px 28px 22px; color: var(--pcs-fg); font: 13px/1.6 Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 4px 20px #00000020; }
}
[data-theme="dark"] .pcs-root, .dark .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 4px 20px #00000020; }
[data-theme="light"] .pcs-root, .light .pcs-root { --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed; --pcs-brand: #0f8177; --pcs-warn: #a66a13; --pcs-error: #c04450; --pcs-shadow: 0 4px 20px #173d4910; }
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select, .pcs-root textarea { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .45; }
.pcs-root :is(button, select, input, summary):focus-visible { outline: 2px solid var(--pcs-brand); outline-offset: 3px; }
.pcs-root :is(.pcs-listener, .pcs-log) > summary:focus-visible { outline-offset: -3px; }
.pcs-root :is(h2, h3, p) { margin: 0; }
.pcs-root .pcs-hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 27px; }
.pcs-root .pcs-brand-lockup { display: flex; align-items: center; gap: 16px; min-width: 0; }
.pcs-root .pcs-brand-logo { display: block; width: 60px; height: 60px; flex: 0 0 60px; filter: drop-shadow(0 5px 9px #0f81771a); }
.pcs-root .pcs-eyebrow { margin-bottom: 5px; color: var(--pcs-brand); font-size: 11px; font-weight: 700; letter-spacing: .17em; line-height: 1.5; }
.pcs-root .pcs-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 24px; line-height: 1.4; font-weight: 700; letter-spacing: -.035em; color: var(--pcs-fg); }
.pcs-root .pcs-version { padding: 2px 7px; border: 1px solid var(--pcs-border); border-radius: 6px; color: var(--pcs-muted); font-size: 11px; letter-spacing: 0; font-weight: 550; line-height: 1.6; background: var(--pcs-bg); }
.pcs-root .pcs-subtitle { margin-top: 6px; color: var(--pcs-muted); font-size: 12px; line-height: 1.7; }
.pcs-root .pcs-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 7px 14px; border: 1px solid var(--pcs-border); border-radius: 8px; color: var(--pcs-fg); background: var(--pcs-bg); line-height: 1.5; font-size: 13px; font-weight: 550; white-space: nowrap; box-shadow: 0 1px 2px #173d4905; transition: border-color .15s, background .15s, box-shadow .15s; }
.pcs-root .pcs-button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--pcs-brand) 65%, var(--pcs-border)); background: var(--pcs-soft); }
.pcs-root .pcs-button-primary { background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); color: #fff; min-width: 104px; box-shadow: 0 3px 7px #0d81761a; }
.pcs-root .pcs-button-primary:hover:not(:disabled) { background: #096e65; border-color: #096e65; box-shadow: 0 4px 10px #0d81762b; }
.pcs-root .pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); box-shadow: none; }
.pcs-root .pcs-button-danger { color: var(--pcs-error); }
.pcs-root .pcs-refresh { flex: 0 0 auto; min-height: 34px; font-size: 12px; padding: 6px 12px; }
.pcs-root .pcs-refresh-icon { display: inline-block; font-size: 19px; line-height: 1; font-family: 'Segoe UI Symbol', sans-serif; }
.pcs-root .pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 22px; padding: 14px 18px; border: 1px solid color-mix(in srgb, var(--pcs-brand) 22%, var(--pcs-border)); border-radius: 11px; background: var(--pcs-soft); }
.pcs-root .pcs-current-heading { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 650; color: var(--pcs-brand); white-space: nowrap; }
.pcs-root .pcs-live-dot { width: 6px; height: 6px; background: var(--pcs-brand); border-radius: 50%; box-shadow: 0 0 0 4px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-current-list { display: flex; flex-wrap: wrap; min-width: 0; gap: 7px; }
.pcs-root .pcs-current-chip { display: inline-flex; align-items: center; flex-wrap: wrap; text-align: left; gap: 4px 11px; max-width: 100%; padding: 0; color: var(--pcs-fg); background: transparent; border: 0; border-radius: 4px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-current-chip strong { font-size: 13px; font-weight: 650; }
.pcs-root .pcs-current-chip span { color: var(--pcs-muted); }
.pcs-root .pcs-current-chip:hover:not(:disabled) strong { color: var(--pcs-brand); }
.pcs-root .pcs-current-idle { background: var(--pcs-layer); border-color: var(--pcs-border); }
.pcs-root .pcs-current-idle :is(.pcs-current-heading, .pcs-current-idle-text) { color: var(--pcs-muted); font-size: 12px; }
.pcs-root .pcs-current-idle .pcs-live-dot { background: var(--pcs-muted); box-shadow: none; }
.pcs-root .pcs-cache { margin: 9px 3px 19px; font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-cache strong { color: var(--pcs-brand); font-weight: 650; margin-left: 3px; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-banner { padding: 10px 13px; border: 1px solid var(--pcs-border); border-radius: 8px; margin-bottom: 16px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-banner-success { color: var(--pcs-brand); border-color: color-mix(in srgb, var(--pcs-brand) 25%, var(--pcs-border)); background: var(--pcs-soft); }
.pcs-root .pcs-banner-warning { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 28%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 5%, var(--pcs-bg)); }
.pcs-root .pcs-banner-error { color: var(--pcs-error); border-color: color-mix(in srgb, var(--pcs-error) 28%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-error) 5%, var(--pcs-bg)); }
.pcs-root .pcs-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; align-items: start; }
.pcs-root .pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 13px; background: var(--pcs-bg); overflow: hidden; box-shadow: var(--pcs-shadow); }
.pcs-root .pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px 18px; border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-card-kicker { color: var(--pcs-muted); font-size: 10px; line-height: 1.4; font-weight: 650; letter-spacing: .16em; margin-bottom: 5px; }
.pcs-root :is(.pcs-card-head, .pcs-overview-head) h3 { color: var(--pcs-fg); font-size: 15px; line-height: 1.5; font-weight: 650; letter-spacing: -.01em; }
.pcs-root .pcs-card-body { padding: 22px 24px; }
.pcs-root .pcs-badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--pcs-border); border-radius: 999px; padding: 3px 8px; font-size: 11px; line-height: 1.5; white-space: nowrap; }
.pcs-root .pcs-badge-saved { color: var(--pcs-brand); background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 21%, var(--pcs-border)); }
.pcs-root .pcs-badge-draft { color: var(--pcs-warn); background: color-mix(in srgb, var(--pcs-warn) 5%, var(--pcs-bg)); border-color: color-mix(in srgb, var(--pcs-warn) 25%, var(--pcs-border)); }
.pcs-root .pcs-badge-dot { height: 4px; width: 4px; background: currentColor; border-radius: 50%; }
.pcs-root .pcs-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.pcs-root .pcs-field { margin-bottom: 25px; min-width: 0; }
.pcs-root .pcs-field:last-child { margin-bottom: 0; }
.pcs-root .pcs-field-label { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; color: var(--pcs-fg); margin-bottom: 9px; font-size: 13px; font-weight: 600; }
.pcs-root .pcs-label-main { display: inline-flex; align-items: center; gap: 9px; }
.pcs-root .pcs-field-step { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: var(--pcs-layer); color: var(--pcs-brand); border: 1px solid var(--pcs-border); font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-label-aside { color: var(--pcs-muted); font-size: 11px; font-weight: 400; }
.pcs-root .pcs-control { display: block; width: 100%; min-width: 0; min-height: 42px; padding: 9px 12px; background: var(--pcs-layer); color: var(--pcs-fg); border: 1px solid var(--pcs-border); border-radius: 8px; font-size: 13px; line-height: 1.6; outline: 0; transition: border-color .15s, box-shadow .15s; }
.pcs-root .pcs-control:focus { border-color: var(--pcs-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pcs-brand) 8%, transparent); }
.pcs-root select.pcs-control { padding-right: 30px; text-overflow: ellipsis; }
.pcs-root .pcs-control:disabled { opacity: .65; }
.pcs-root .pcs-help { margin-top: 7px; font-size: 11px; color: var(--pcs-muted); line-height: 1.75; overflow-wrap: anywhere; }
.pcs-root .pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.pcs-root .pcs-client { position: relative; display: block; min-width: 0; padding: 15px 12px 13px; color: var(--pcs-fg); background: var(--pcs-bg); border: 1px solid var(--pcs-border); border-radius: 9px; cursor: pointer; transition: background .15s, border-color .15s, box-shadow .15s; }
.pcs-root .pcs-client:hover { border-color: color-mix(in srgb, var(--pcs-brand) 55%, var(--pcs-border)); }
.pcs-root .pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: var(--pcs-soft); box-shadow: 0 0 0 1px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-client input { position: absolute; top: 13px; right: 11px; width: 12px; height: 12px; margin: 0; accent-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:focus-visible) { outline: 2px solid var(--pcs-brand); outline-offset: 3px; }
.pcs-root .pcs-client:has(input:disabled) { cursor: default; opacity: .6; }
.pcs-root .pcs-client-copy { display: block; min-width: 0; }
.pcs-root .pcs-client-topline { display: flex; flex-direction: column; gap: 10px; }
.pcs-root .pcs-client-mark { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 7px; font-size: 13px; font-weight: 700; }
.pcs-root .pcs-client:has(input:checked) .pcs-client-mark { background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); color: #fff; }
.pcs-root .pcs-client-name { font-size: 12px; font-weight: 650; }
.pcs-root .pcs-client-description { display: block; margin-top: 4px; color: var(--pcs-muted); font-size: 11px; line-height: 1.7; }
.pcs-root .pcs-inline-controls { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 10px; }
.pcs-root .pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--pcs-border); background: var(--pcs-layer); padding: 15px 24px; }
.pcs-root .pcs-action-note { display: flex; align-items: center; gap: 6px; color: var(--pcs-muted); font-size: 11px; line-height: 1.5; }
.pcs-root .pcs-action-indicator { display: inline-block; flex: 0 0 5px; width: 5px; height: 5px; background: var(--pcs-brand); border-radius: 50%; }
.pcs-root .pcs-action-indicator.is-dirty { background: var(--pcs-warn); }
.pcs-root .pcs-action-buttons { display: flex; align-items: center; gap: 7px; }
.pcs-root .pcs-overview { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 13px; background: var(--pcs-layer); overflow: hidden; }
.pcs-root .pcs-overview-head { padding: 22px 20px 17px; }
.pcs-root .pcs-overview-status { display: flex; align-items: flex-start; gap: 9px; padding: 0 20px 18px; }
.pcs-root .pcs-status-icon { display: inline-flex; flex: 0 0 23px; width: 23px; height: 23px; align-items: center; justify-content: center; margin-top: 2px; border-radius: 50%; color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 10%, var(--pcs-layer)); font-size: 13px; font-weight: 600; }
.pcs-root .pcs-overview-status strong { display: block; font-size: 12px; font-weight: 600; line-height: 1.8; color: var(--pcs-brand); }
.pcs-root .pcs-overview-status div > span { display: block; font-size: 11px; color: var(--pcs-muted); line-height: 1.7; overflow-wrap: anywhere; }
.pcs-root .is-waiting .pcs-status-icon { background: color-mix(in srgb, var(--pcs-warn) 10%, var(--pcs-layer)); color: var(--pcs-warn); }
.pcs-root .is-waiting strong { color: var(--pcs-warn); }
.pcs-root .pcs-metric-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0 20px; border-top: 1px solid var(--pcs-border); border-bottom: 1px solid var(--pcs-border); padding: 16px 0; gap: 17px 10px; }
.pcs-root .pcs-metric { min-width: 0; }
.pcs-root .pcs-metric > span { display: block; font-size: 11px; color: var(--pcs-muted); margin-bottom: 3px; }
.pcs-root .pcs-metric > strong { display: block; font-size: 20px; line-height: 1.4; letter-spacing: -.04em; font-weight: 600; color: var(--pcs-fg); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pcs-root .pcs-metric:nth-child(2) > strong { font-size: 17px; line-height: 1.65; letter-spacing: -.02em; }
.pcs-root .pcs-rule-list { padding: 18px 20px 20px; }
.pcs-root .pcs-section-caption { font-size: 10px; color: var(--pcs-muted); font-weight: 650; letter-spacing: .13em; margin-bottom: 10px; }
.pcs-root .pcs-route { display: flex; align-items: center; gap: 9px; padding: 10px; width: 100%; text-align: left; border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); color: var(--pcs-fg); }
.pcs-root .pcs-route + .pcs-route { margin-top: 8px; }
.pcs-root .pcs-route:hover:not(:disabled) { border-color: var(--pcs-brand); }
.pcs-root .pcs-route-mark { display: flex; align-items: center; justify-content: center; flex: 0 0 26px; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; font-weight: 700; color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-route-copy { display: block; min-width: 0; flex: 1; }
.pcs-root .pcs-route-copy strong { display: block; font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
.pcs-root .pcs-route-copy small { display: block; color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-route-arrow { color: var(--pcs-muted); font-size: 13px; }
.pcs-root .pcs-overview-empty { font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-overview-foot { display: flex; align-items: center; gap: 7px; padding: 13px 20px; border-top: 1px solid var(--pcs-border); font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-overview-foot img { display: block; width: 16px; height: 16px; }
.pcs-root .pcs-listener { margin-top: 20px; box-shadow: none; }
.pcs-root .pcs-listener > summary { display: flex; align-items: center; gap: 9px; list-style: none; padding: 17px 20px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--pcs-fg); }
.pcs-root .pcs-listener > summary::-webkit-details-marker { display: none; }
.pcs-root .pcs-listener > summary::after { content: '⌄'; color: var(--pcs-muted); font-size: 16px; margin-left: 4px; transition: transform .15s; }
.pcs-root .pcs-listener[open] > summary { border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-listener[open] > summary::after { transform: rotate(180deg); }
.pcs-root .pcs-summary-icon { display: flex; align-items: center; justify-content: center; width: 25px; height: 25px; border-radius: 7px; color: var(--pcs-brand); background: var(--pcs-soft); font-size: 20px; font-weight: 400; }
.pcs-root .pcs-summary-count { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--pcs-muted); background: var(--pcs-layer); border-radius: 5px; padding: 2px 7px; }
.pcs-root .pcs-switch { border: 1px solid var(--pcs-border); background: var(--pcs-layer); color: var(--pcs-muted); border-radius: 7px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 12px; }
.pcs-root .pcs-switch-track { width: 29px; height: 17px; border-radius: 12px; background: var(--pcs-border); padding: 2px; display: inline-flex; }
.pcs-root .pcs-switch-knob { width: 13px; height: 13px; background: var(--pcs-bg); border-radius: 50%; box-shadow: 0 1px 2px #0002; }
.pcs-root .pcs-switch[aria-checked="true"] { color: var(--pcs-brand); }
.pcs-root .pcs-switch[aria-checked="true"] .pcs-switch-track { background: var(--pcs-button-fill); justify-content: flex-end; }
.pcs-root .pcs-listener-toolbar { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.pcs-root .pcs-log-list { display: grid; gap: 9px; }
.pcs-root .pcs-log { min-width: 0; background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; overflow: hidden; }
.pcs-root .pcs-log > summary { padding: 11px 13px; cursor: pointer; font-size: 11px; overflow-wrap: anywhere; }
.pcs-root .pcs-log-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 7px; background: var(--pcs-brand); }
.pcs-root .pcs-log-content { border-top: 1px solid var(--pcs-border); padding: 14px; }
.pcs-root .pcs-log-meta { display: flex; flex-wrap: wrap; gap: 7px 15px; color: var(--pcs-muted); font-size: 11px; margin-bottom: 9px; }
.pcs-root .pcs-log-label { font-size: 11px; font-weight: 600; margin: 12px 0 6px; }
.pcs-root .pcs-log pre { margin: 0; max-height: 260px; max-width: 100%; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pcs-fg); border: 1px solid var(--pcs-border); background: var(--pcs-bg); padding: 11px; border-radius: 7px; font: 10px/1.75 ui-monospace, SFMono-Regular, Consolas, monospace; }
.pcs-root .pcs-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
.pcs-root .pcs-validation { color: var(--pcs-error); font-size: 12px; margin-top: 9px; }
.pcs-root .pcs-empty { text-align: center; padding: 38px 20px; margin-top: 10px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 13px; font-size: 12px; }
.pcs-root .pcs-empty strong { display: block; margin: 12px 0 5px; color: var(--pcs-fg); font-size: 14px; font-weight: 600; }
.pcs-root .pcs-empty-logo img { width: 36px; height: 36px; opacity: .8; }
.pcs-root .pcs-footer { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 17px; padding: 0 2px; color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-muted { color: var(--pcs-muted); }
.pcs-root .pcs-small { font-size: 11px; font-weight: 400; }
.pcs-root .pcs-spin { width: 12px; height: 12px; border: 1.7px solid currentColor; border-right-color: transparent; border-radius: 50%; display: inline-block; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
.pcs-root .pcs-sidebar-logo { display: inline-block; flex: 0 0 auto; background-color: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; vertical-align: middle; }
@container (max-width: 850px) {
  .pcs-root .pcs-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .pcs-root .pcs-overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .pcs-root .pcs-overview-head { padding-bottom: 10px; }
  .pcs-root .pcs-overview-status { grid-column: 1; padding-top: 0; }
  .pcs-root .pcs-metric-grid { grid-column: 2; grid-row: 1 / span 2; align-content: center; border: 0; border-left: 1px solid var(--pcs-border); padding-left: 20px; margin: 17px 20px 17px 0; }
  .pcs-root .pcs-rule-list { grid-column: 1 / -1; padding: 0 20px 18px; }
  .pcs-root .pcs-overview-foot { grid-column: 1 / -1; }
}
@container (max-width: 520px) {
  .pcs-root .pcs-hero { align-items: flex-start; gap: 10px; margin-bottom: 20px; }
  .pcs-root .pcs-brand-lockup { gap: 10px; align-items: flex-start; }
  .pcs-root .pcs-brand-logo { width: 40px; height: 40px; flex-basis: 40px; }
  .pcs-root .pcs-eyebrow { font-size: 10px; letter-spacing: .1em; margin-bottom: 3px; }
  .pcs-root .pcs-title { font-size: 18px; gap: 6px; }
  .pcs-root .pcs-version { font-size: 10px; padding: 1px 5px; }
  .pcs-root .pcs-subtitle { font-size: 11px; margin-top: 6px; }
  .pcs-root .pcs-refresh { font-size: 11px; padding: 5px 8px; min-height: 30px; }
  .pcs-root .pcs-refresh-icon { font-size: 17px; }
  .pcs-root .pcs-current { padding: 12px 14px; gap: 9px; }
  .pcs-root .pcs-current-chip { gap: 3px 8px; }
  .pcs-root .pcs-current-chip strong { font-size: 13px; }
  .pcs-root .pcs-current-chip span { font-size: 11px; }
  .pcs-root .pcs-card-head { padding: 16px; }
  .pcs-root .pcs-card-body { padding: 18px 16px; }
  .pcs-root .pcs-field { margin-bottom: 22px; }
  .pcs-root .pcs-clients { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .pcs-root .pcs-client { padding: 12px; }
  .pcs-root .pcs-client-topline { flex-direction: row; align-items: center; gap: 9px; padding-right: 15px; }
  .pcs-root .pcs-client-description { margin-left: 36px; margin-top: -3px; font-size: 11px; }
  .pcs-root .pcs-client input { top: 20px; right: 14px; }
  .pcs-root .pcs-client-mark { width: 25px; height: 25px; flex: 0 0 25px; }
  .pcs-root .pcs-inline-controls { grid-template-columns: 88px minmax(0, 1fr); }
  .pcs-root .pcs-actions { padding: 14px 16px; flex-wrap: wrap; gap: 12px; }
  .pcs-root .pcs-action-buttons { margin-left: auto; }
  .pcs-root .pcs-overview { display: block; }
  .pcs-root .pcs-metric-grid { border: 0; border-top: 1px solid var(--pcs-border); border-bottom: 1px solid var(--pcs-border); margin: 0 20px; padding: 16px 0; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .pcs-root .pcs-metric > span { font-size: 10px; }
  .pcs-root .pcs-metric > strong { font-size: 18px; }
  .pcs-root .pcs-metric:nth-child(2) > strong { font-size: 14px; }
  .pcs-root .pcs-rule-list { padding-top: 16px; }
  .pcs-root .pcs-listener > summary { padding: 14px 16px; gap: 7px; font-size: 12px; }
  .pcs-root .pcs-listener > summary .pcs-small { font-size: 11px; }
  .pcs-root .pcs-summary-icon { width: 22px; height: 22px; font-size: 18px; }
  .pcs-root .pcs-listener-toolbar { justify-content: flex-start; }
  .pcs-root .pcs-footer { font-size: 10px; }
}
@media (max-width: 620px) { .pcs-root { padding: 20px 14px 18px; } }
@media (prefers-reduced-motion: reduce) { .pcs-root *, .pcs-root *::before, .pcs-root *::after { animation: none !important; transition: none !important; } }
`;

},
"/types.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_PATH = exports.SETTINGS_NS = exports.PLUGIN_VERSION = exports.PLUGIN_NAME = void 0;
exports.PLUGIN_NAME = 'dsh-mimic';
/** Build replaces this marker with package.json version; the test suite asserts they match. */
exports.PLUGIN_VERSION = '0.3.5';
exports.SETTINGS_NS = 'dsh-mimic';
exports.API_PATH = '/dsh-mimic/api';
/** RPC: state {}; save {providerId,rule,revision}; listener {enabled,revision}; logs {}; clear {}. */

}}; const cache={};
function load(id) { if(cache[id])return cache[id].exports; if(!factories[id])return external(id); const module={exports:{}}; cache[id]=module; const local=(name)=>{ if(!name.startsWith("."))return external(name); const parts=id.split("/");parts.pop(); for(const p of name.split("/")){if(p==="..")parts.pop();else if(p!==".")parts.push(p);} return load(parts.join("/")); }; factories[id](local,module,module.exports); return module.exports;}
const entry=load("/client/index.js");return entry.default || entry;
}});
