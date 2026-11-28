import * as React from 'react';
import { PLUGIN_NAME, PLUGIN_VERSION } from '../types.js';
import { buildSaveRequest, configuredProviders, createPanelApi, emptyEditorSession, isDraftDirty, isRevisionConflict, markRevisionConflict, reconcileState, redactText, restoreSelectedDraft, selectProvider, setDraftClient, simulatingRules, updateDraft, } from './model.js';
import { PANEL_TITLE, registerClientUi, SLOT_SERVICE_ID } from './slots.js';
import { LOGO_DATA_URI, MONO_LOGO_DATA_URI } from './brand.js';
import { PANEL_CSS } from './styles.js';
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
        WebkitMaskImage: `url("${MONO_LOGO_DATA_URI}")`, maskImage: `url("${MONO_LOGO_DATA_URI}")`,
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
export function ProviderClientPanel({ api: providedApi } = {}) {
    const api = React.useMemo(() => providedApi ?? createPanelApi(), [providedApi]);
    const [session, setSession] = React.useState(emptyEditorSession);
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
                setSession(previous => reconcileState(previous, reply.state, savedProviderId));
                setNotice(operation === 'save' ? '已保存，立即生效。'
                    : operation === 'listener' ? (reply.state.config.listener.enabled ? '出站请求监听已开启。' : '出站请求监听已关闭。')
                        : '已读取最新状态。');
            }
            else {
                const entries = reply.entries ?? reply.state?.entries ?? [];
                setSession(previous => {
                    if (reply.state)
                        return { ...reconcileState(previous, reply.state), revisionStale: previous.revisionStale };
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
            if (isRevisionConflict(failure)) {
                setSession(markRevisionConflict);
                setError('配置已在别处更新，请先刷新，再重新保存。');
            }
            else {
                setError(timedOut ? '读取超时，请重试。'
                    : redactText(failure instanceof Error ? failure.message : '请求未完成，请重试。'));
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
    const providers = snapshot ? configuredProviders(snapshot.providers) : [];
    const selected = providers.find(provider => provider.id === session.selectedProviderId);
    const draft = session.drafts[session.selectedProviderId];
    const form = draft?.form;
    const dirty = draft ? isDraftDirty(draft) : false;
    const savedRule = snapshot?.config.providers[session.selectedProviderId];
    const listenerEnabled = snapshot?.config.listener.enabled ?? false;
    const transportActive = snapshot?.runtime.transport === 'active';
    const simulating = snapshot ? simulatingRules(snapshot, providers) : [];
    const blocked = busy !== null;
    const patch = (change) => {
        if (pending.current)
            return;
        setError('');
        setNotice('');
        setSession(previous => updateDraft(previous, previous.selectedProviderId, change));
    };
    const chooseProvider = (id) => {
        if (pending.current)
            return;
        setError('');
        setNotice('');
        setSession(previous => selectProvider(previous, id));
    };
    const save = () => {
        try {
            const request = buildSaveRequest(current.current);
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
        onChange: () => patch(setDraftClient(form, client.id, snapshot?.profiles ?? [])),
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
    const editor = form && providerField && clientField ? h('article', { className: 'pcs-card pcs-editor', 'aria-labelledby': fieldId + '-editor' }, h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CONFIGURATION'), h('h3', { id: fieldId + '-editor' }, '模拟设置')), h(Badge, { draft: dirty, children: dirty ? '未保存' : savedRule && savedRule.client !== 'none' ? '已生效' : '未启用' })), h('div', { className: 'pcs-card-body' }, h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, providerField, clientField, concurrencyField)), h('div', { className: 'pcs-actions' }, h('div', { className: 'pcs-action-note' }, h('span', { className: 'pcs-action-indicator ' + (dirty ? 'is-dirty' : '') }), dirty ? '修改尚未应用' : savedRule && savedRule.client !== 'none' ? '正在拦截并转换出站请求' : '选择客户端后保存以启用'), h('div', { className: 'pcs-action-buttons' }, dirty ? button('还原', () => { setError(''); setNotice(''); setSession(restoreSelectedDraft); }, { className: 'pcs-button-quiet' }) : null, button(busy === 'save' ? '保存中…' : '保存更改', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;
    const overview = snapshot ? h('aside', { className: 'pcs-overview' }, h('div', { className: 'pcs-overview-head' }, h('div', { className: 'pcs-card-kicker' }, 'LIVE OVERVIEW'), h('h3', null, '运行概览')), h('div', { className: 'pcs-overview-status ' + (transportActive ? 'is-ready' : 'is-waiting') }, h('span', { className: 'pcs-status-icon', 'aria-hidden': true }, transportActive ? '✓' : '·'), h('div', null, h('strong', null, statusLabel(snapshot.runtime.transport)), h('span', null, snapshot.runtime.detail))), h('div', { className: 'pcs-metric-grid' }, h('div', { className: 'pcs-metric' }, h('span', null, '已连接供应商'), h('strong', null, String(providers.length))), h('div', { className: 'pcs-metric' }, h('span', null, '当前模拟'), h('strong', null, simulating.length ? clientShort(simulating[0].rule.client) : '—')), h('div', { className: 'pcs-metric' }, h('span', null, '监听记录'), h('strong', null, String(snapshot.entries.length))), h('div', { className: 'pcs-metric' }, h('span', null, '注册挂载'), h('strong', null, String(snapshot.runtime.registrations)))), h('div', { className: 'pcs-rule-list' }, h('div', { className: 'pcs-section-caption' }, 'ACTIVE ROUTES'), simulating.length ? simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-route', disabled: blocked, onClick: () => chooseProvider(provider.id) }, h('span', { className: 'pcs-route-mark' }, clientShort(rule.client).slice(0, 1)), h('span', { className: 'pcs-route-copy' }, h('strong', null, provider.label), h('small', null, clientLabel(rule.client))), h('span', { className: 'pcs-route-arrow' }, '→')))
        : h('p', { className: 'pcs-overview-empty' }, '还没有启用模拟路由。')), h('div', { className: 'pcs-overview-foot' }, h('img', { src: LOGO_DATA_URI, alt: '', 'aria-hidden': true }), h('span', null, '身份字段在同一请求中原子变换'))) : null;
    const listener = snapshot ? h('details', { className: 'pcs-card pcs-listener', 'aria-labelledby': fieldId + '-listener' }, h('summary', { id: fieldId + '-listener' }, h('span', { className: 'pcs-summary-icon' }, '◌'), h('span', null, '出站请求监听'), h('span', { className: 'pcs-small pcs-muted' }, '调试 · 脱敏'), h('span', { className: 'pcs-summary-count' }, snapshot.entries.length + ' 条')), h('div', { className: 'pcs-card-body' }, h('div', { className: 'pcs-listener-toolbar' }, h('button', { type: 'button', className: 'pcs-switch', role: 'switch', 'aria-label': '出站请求监听',
        'aria-checked': listenerEnabled, disabled: blocked || session.revisionStale || (!listenerEnabled && !transportActive),
        onClick: () => { void run('listener', { action: 'listener', enabled: !listenerEnabled, revision: snapshot.config.revision }); } }, h('span', { className: 'pcs-switch-track', 'aria-hidden': true }, h('span', { className: 'pcs-switch-knob' })), busy === 'listener' ? '更新中…' : listenerEnabled ? '监听中' : '已关闭'), h('span', { className: 'pcs-small pcs-muted' }, '上限 ' + snapshot.config.listener.maxEntries), h('div', { className: 'pcs-action-buttons' }, button(busy === 'logs' ? '读取中…' : '读取记录', () => { void run('logs', { action: 'logs' }); }), button(busy === 'clear' ? '清空中…' : '清空', () => { void run('clear', { action: 'clear' }); }, { disabled: !snapshot.entries.length, className: 'pcs-button-danger' }))), !transportActive ? h('p', { className: 'pcs-help' }, '出站接入尚未就绪：' + snapshot.runtime.detail) : null, snapshot.entries.length ? h('div', { className: 'pcs-log-list' }, ...snapshot.entries.slice().reverse().map(entry => h('details', { key: entry.id, className: 'pcs-log' }, h('summary', null, h('span', { className: 'pcs-log-dot' }), (snapshot.providers.find(provider => provider.id === entry.providerId)?.label ?? '供应商') + ' · ' + entry.modelId + ' · ' + entryTime(entry.time)), h('div', { className: 'pcs-log-content' }, h('div', { className: 'pcs-log-meta' }, h('span', null, clientLabel(entry.client) + ' · ' + entry.profile), h('span', null, entry.protocol + ' → ' + entry.targetProtocol), entry.status !== undefined ? h('span', null, 'HTTP ' + entry.status) : null), h('p', { className: 'pcs-help pcs-code' }, entry.url), entry.error ? h('p', { className: 'pcs-validation' }, entry.error) : null, h('div', { className: 'pcs-log-label' }, '请求头 · 已脱敏'), h('pre', null, JSON.stringify(entry.headers, null, 2)), h('div', { className: 'pcs-log-label' }, '请求体 · 结构与指纹摘要'), h('pre', null, JSON.stringify(entry.body, null, 2))))))
        : h('p', { className: 'pcs-help' }, listenerEnabled ? '正常使用后点「读取记录」查看实际出站摘要。' : '开启监听后才会记录出站请求。'))) : null;
    return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked }, h('style', null, PANEL_CSS), h('header', { className: 'pcs-hero' }, h('div', { className: 'pcs-brand-lockup' }, h('img', { className: 'pcs-brand-logo', src: LOGO_DATA_URI, alt: '' }), h('div', null, h('div', { className: 'pcs-eyebrow' }, 'DSH PLUGIN · WIRE IDENTITY'), h('h2', { className: 'pcs-title', id: fieldId + '-title' }, PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + PLUGIN_VERSION)), h('p', { className: 'pcs-subtitle' }, '为指定供应商选择客户端身份，头与体在同一次出站请求中同步生效。'))), h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked, onClick: () => { void run('refresh', { action: 'state' }); } }, busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : h('span', { className: 'pcs-refresh-icon', 'aria-hidden': true }, '↻'), busy === 'refresh' ? '刷新中…' : '刷新')), snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') }, h('div', { className: 'pcs-current-heading' }, h('span', { className: 'pcs-live-dot', 'aria-hidden': true }), h('span', null, '当前模拟')), simulating.length
        ? h('div', { className: 'pcs-current-list' }, ...simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked, 'aria-pressed': provider.id === session.selectedProviderId, onClick: () => chooseProvider(provider.id) }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile') + (rule.concurrency ? ' · 并发 ' + rule.concurrency : '')))))
        : h('span', { className: 'pcs-current-idle-text' }, '未启用 · 选择下方客户端开始模拟')) : null, cacheLine, session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' }, h('div', null, h('strong', null, '配置已更新'), h('p', null, '请点刷新后再保存。'))) : null, error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null, notice ? h('div', { className: 'pcs-banner pcs-banner-success', role: 'status' }, notice) : null, !snapshot ? h('div', { className: 'pcs-empty' }, h('div', { className: 'pcs-empty-logo' }, h('img', { src: LOGO_DATA_URI, alt: '' })), h('strong', null, busy === 'refresh' ? '正在连接 DSH' : '尚未读取状态'), busy === 'refresh' ? '正在读取当前供应商配置。' : '点右上角刷新重试。') : null, snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('div', { className: 'pcs-empty-logo' }, h('img', { src: LOGO_DATA_URI, alt: '' })), h('strong', null, '尚无已配置供应商'), '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null, snapshot && form ? h('div', { className: 'pcs-layout' }, editor, overview) : null, listener, h('p', { className: 'pcs-footer' }, h('span', null, 'dsh-mimic · v' + PLUGIN_VERSION), h('span', null, providers.length + ' 个供应商 · 出站接入 ' + (transportActive ? '已就绪' : '未就绪') + (lastRead ? ' · 最近读取 ' + lastRead : ''))));
}
export const name = PLUGIN_NAME;
/** Cordis browser service dependency. */
export const inject = [SLOT_SERVICE_ID];
export function apply(ctx) {
    registerClientUi(ctx, {
        panel: () => h(ProviderClientPanel),
        icon: (owner) => h(SidebarIcon, { size: owner?.size ?? 16 }),
    });
}
export default { name, inject, apply };
//# sourceMappingURL=index.js.map