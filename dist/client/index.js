import * as React from 'react';
import { PLUGIN_NAME, PLUGIN_VERSION } from '../types.js';
import { buildSaveRequest, configuredProviders, createPanelApi, emptyEditorSession, isDraftDirty, isRevisionConflict, markRevisionConflict, reconcileState, redactText, restoreSelectedDraft, selectProvider, setDraftClient, simulatingRules, updateDraft, } from './model.js';
import { PANEL_TITLE, registerClientUi, SLOT_SERVICE_ID } from './slots.js';
import { LOGO_DATA_URI, MONO_LOGO_DATA_URI } from './brand.js';
import { PANEL_CSS } from './styles.js';
import { CACHE_CSS } from './cache-styles.js';
import { CacheInspector } from './cache-panel.js';
const h = React.createElement;
const CLIENTS = [
    { id: 'none', label: '原样请求', short: 'N', description: '保持原始请求' },
    { id: 'claude-code', label: 'Claude Code', short: 'C', description: 'Anthropic Messages' },
    { id: 'codex', label: 'Codex', short: 'C', description: 'OpenAI Responses' },
];
const clientLabel = (client) => CLIENTS.find(item => item.id === client)?.label ?? client;
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
function statusLabel(transport) {
    return transport === 'active' ? '接入已就绪' : transport === 'waiting' ? '等待接入' : '暂不可用';
}
export function ProviderClientPanel({ api: providedApi } = {}) {
    const api = React.useMemo(() => providedApi ?? createPanelApi(), [providedApi]);
    const [session, setSession] = React.useState(emptyEditorSession);
    const [busy, setBusy] = React.useState(null);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
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
            if (!reply.state)
                throw new Error('服务未返回最新状态。');
            setSession(previous => reconcileState(previous, reply.state, savedProviderId));
            setNotice(operation === 'save' ? '已保存，立即生效。' : '已读取最新状态。');
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
    React.useEffect(() => {
        let disposed = false, polling = false;
        let controller;
        const timer = setInterval(() => {
            if (polling || pending.current || !current.current.snapshot || document.visibilityState === 'hidden')
                return;
            polling = true;
            const ticket = sequence.current;
            controller = new AbortController();
            const timeout = setTimeout(() => controller?.abort(), 4500);
            void api.call({ action: 'state' }, controller.signal).then(reply => {
                if (disposed || !alive.current || pending.current || ticket !== sequence.current || !reply.state)
                    return;
                // Refresh only runtime so polling preserves the draft, baseline and configuration revision.
                setSession(previous => previous.snapshot ? { ...previous, snapshot: { ...previous.snapshot, runtime: reply.state.runtime } } : previous);
            }).catch(() => { }).finally(() => { clearTimeout(timeout); polling = false; });
        }, 5000);
        return () => { disposed = true; clearInterval(timer); controller?.abort(); };
    }, [api]);
    const snapshot = session.snapshot;
    const providers = snapshot ? configuredProviders(snapshot.providers) : [];
    const selected = providers.find(provider => provider.id === session.selectedProviderId);
    const draft = session.drafts[session.selectedProviderId];
    const form = draft?.form;
    const dirty = draft ? isDraftDirty(draft) : false;
    const savedRule = snapshot?.config.providers[session.selectedProviderId];
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
    const concurrencyStat = snapshot?.runtime.concurrency?.find(item => item.providerId === session.selectedProviderId);
    const editor = form ? h('article', { className: 'pcs-card pcs-editor', 'aria-labelledby': fieldId + '-editor' }, h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CONFIGURATION'), h('h3', { id: fieldId + '-editor' }, '模拟设置')), h(Badge, { draft: dirty, children: dirty ? '未保存' : savedRule && savedRule.client !== 'none' ? '已生效' : '未启用' })), h('div', { className: 'pcs-card-body' }, h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-provider' }, '供应商', selected ? h('span', { className: 'pcs-label-aside' }, selected.modelIds.length + ' 个模型') : null), h('select', { id: fieldId + '-provider', className: 'pcs-control', value: session.selectedProviderId,
        onChange: (event) => chooseProvider(event.currentTarget.value) }, !selected && session.selectedProviderId ? h('option', { value: session.selectedProviderId, disabled: true }, '供应商已移除') : null, ...providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.label))), h('p', { className: 'pcs-help pcs-provider-detail' }, selected ? selected.adapter + ' · ' + (selected.protocol ?? '自动识别') : '此供应商已从 DSH 配置移除。')), h('div', { className: 'pcs-field' }, h('div', { className: 'pcs-field-label', id: fieldId + '-client-label' }, '客户端身份', h('span', { className: 'pcs-label-aside' }, '请求头与请求体同步')), h('div', { className: 'pcs-clients', role: 'radiogroup', 'aria-labelledby': fieldId + '-client-label' }, ...CLIENTS.map(client => h('label', { key: client.id, className: 'pcs-client' }, h('input', { type: 'radio', name: fieldId + '-client', value: client.id, checked: form.client === client.id,
        onChange: () => patch(setDraftClient(form, client.id, snapshot?.profiles ?? [])) }), h('span', { className: 'pcs-client-copy' }, h('span', { className: 'pcs-client-name' }, client.label), h('span', { className: 'pcs-client-description' }, client.description))))), h('p', { className: 'pcs-help' }, '保存后，其他供应商自动恢复为原样请求。')), h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-concurrency' }, '并发上限', h('span', { className: 'pcs-label-aside' }, '0 = 不限制')), h('div', { className: 'pcs-inline-controls' }, h('input', { id: fieldId + '-concurrency', className: 'pcs-control pcs-number', type: 'number', inputMode: 'numeric',
        min: 0, max: 64, step: 1, value: form.concurrencyText, placeholder: '0',
        onChange: (event) => patch({ concurrencyText: event.currentTarget.value }) }), h('select', { id: fieldId + '-concurrency-mode', className: 'pcs-control', value: form.concurrencyMode, 'aria-label': '超出并发上限时',
        onChange: (event) => patch({ concurrencyMode: event.currentTarget.value === 'reject' ? 'reject' : 'queue' }) }, h('option', { value: 'queue' }, '超限排队'), h('option', { value: 'reject' }, '超限报错')))))), h('div', { className: 'pcs-actions' }, h('span', { className: 'pcs-action-note' }, h('span', { className: 'pcs-action-indicator ' + (dirty ? 'is-dirty' : '') }), dirty ? '修改尚未应用' : '保存即生效'), h('div', { className: 'pcs-action-buttons' }, dirty ? button('还原', () => { setError(''); setNotice(''); setSession(restoreSelectedDraft); }, { className: 'pcs-button-quiet' }) : null, button(busy === 'save' ? '保存中…' : '保存更改', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;
    const overview = snapshot ? h('aside', { className: 'pcs-overview', 'aria-label': '运行概况' }, h('div', { className: 'pcs-overview-status ' + (transportActive ? 'is-ready' : 'is-waiting'), title: snapshot.runtime.detail }, h('span', { className: 'pcs-status-icon', 'aria-hidden': true }, transportActive ? '✓' : '·'), h('div', null, h('span', { className: 'pcs-overview-caption' }, '运行概况'), h('strong', null, statusLabel(snapshot.runtime.transport)))), h('div', { className: 'pcs-metric' }, h('span', null, '已连接供应商'), h('strong', null, String(providers.length))), h('div', { className: 'pcs-metric' }, h('span', null, '当前并发'), h('strong', null, concurrencyStat ? concurrencyStat.active + ' / ' + concurrencyStat.limit : '—')), h('div', { className: 'pcs-metric' }, h('span', null, '注册挂载'), h('strong', null, String(snapshot.runtime.registrations)))) : null;
    return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked }, h('style', null, PANEL_CSS + CACHE_CSS), h('header', { className: 'pcs-hero' }, h('div', { className: 'pcs-brand-lockup' }, h('img', { className: 'pcs-brand-logo', src: LOGO_DATA_URI, alt: '' }), h('div', null, h('div', { className: 'pcs-eyebrow' }, 'DSH PLUGIN · WIRE IDENTITY'), h('h2', { className: 'pcs-title', id: fieldId + '-title' }, PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + PLUGIN_VERSION)), h('p', { className: 'pcs-subtitle' }, '供应商配置与缓存表现，一屏掌握。'))), h('div', { className: 'pcs-header-actions' }, notice ? h('span', { className: 'pcs-notice', role: 'status' }, notice) : null, h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked, onClick: () => { void run('refresh', { action: 'state' }); } }, busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : h('span', { 'aria-hidden': true }, '↻'), busy === 'refresh' ? '刷新中…' : '刷新'))), snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') }, h('span', { className: 'pcs-current-heading' }, h('span', { className: 'pcs-live-dot', 'aria-hidden': true }), '当前模拟'), simulating.length ? simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked,
        'aria-pressed': provider.id === session.selectedProviderId, onClick: () => chooseProvider(provider.id) }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile') + (rule.concurrency ? ' · 并发 ' + rule.concurrency : ''))))
        : h('span', { className: 'pcs-muted' }, '未启用 · 选择客户端并保存')) : null, session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' }, '配置已更新，请刷新后再保存。') : null, error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null, !snapshot ? h('div', { className: 'pcs-empty' }, h('strong', null, busy === 'refresh' ? '正在连接 DSH' : '尚未读取状态'), '正在读取供应商配置，请稍候。') : null, snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('strong', null, '尚无已配置供应商'), '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null, snapshot && form ? h('div', { className: 'pcs-layout' }, editor, h('div', { className: 'pcs-dashboard' }, overview, session.selectedProviderId ? h(CacheInspector, { key: session.selectedProviderId, state: snapshot, providerId: session.selectedProviderId }) : null)) : null);
}
/** The main slot supplies bounded space; overflow remains available on small screens and large text. */
export function ProviderClientPage(props = {}) {
    return h('div', {
        className: 'pcs-viewport', role: 'region', 'aria-label': '客户端模拟面板', tabIndex: 0,
        style: { width: '100%', height: '100%', maxHeight: '100%', minHeight: 0, minWidth: 0, flex: '1 1 0',
            overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' },
    }, h(ProviderClientPanel, props));
}
export const name = PLUGIN_NAME;
export const inject = [SLOT_SERVICE_ID];
export function apply(ctx) {
    registerClientUi(ctx, {
        panel: () => h(ProviderClientPanel),
        mainPanel: () => h(ProviderClientPage),
        icon: (owner) => h(SidebarIcon, { size: owner?.size ?? 16 }),
    });
}
export default { name, inject, apply };
//# sourceMappingURL=index.js.map