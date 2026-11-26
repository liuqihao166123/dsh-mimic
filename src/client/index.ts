import * as React from 'react';
import { PLUGIN_NAME, PLUGIN_VERSION } from '../types.js';
import type { ClientKind } from '../types.js';
import {
  buildSaveRequest, configuredProviders, createPanelApi, emptyEditorSession,
  isDraftDirty, isRevisionConflict, markRevisionConflict, reconcileState, redactText,
  selectProvider, setDraftClient, simulatingRules, updateDraft,
} from './model.js';
import type { PanelApi, PanelApiRequest } from './model.js';
import { PANEL_TITLE, registerClientUi, SLOT_SERVICE_ID } from './slots.js';
import type { ClientContext } from './slots.js';
import { PANEL_CSS } from './styles.js';

const h = React.createElement;
const CLIENTS: { id: ClientKind; label: string; description: string }[] = [
  { id: 'none', label: 'None', description: '不模拟 · 请求保持原样' },
  { id: 'claude-code', label: 'Claude Code', description: 'Anthropic Messages 客户端指纹' },
  { id: 'codex', label: 'Codex', description: 'OpenAI Responses 客户端指纹' },
];
const clientLabel = (client: ClientKind): string => CLIENTS.find(item => item.id === client)?.label ?? client;
/** Left-rail glyph (a tune/sliders mark) rendered at the size the host gives the sidebar row. */
const SidebarIcon: React.FC<{ size?: number }> = ({ size = 16 }) => {
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  },
    h('path', { d: 'M4 7h9M19 7h1M4 17h1M11 17h9' }),
    h('circle', { cx: 15, cy: 7, r: 2.1 }),
    h('circle', { cx: 9, cy: 17, r: 2.1 }));
};
type Operation = 'refresh' | 'save' | 'listener' | 'logs' | 'clear';
export interface ProviderClientPanelProps { api?: PanelApi }
function Badge(props: { draft?: boolean; children: string }) {
  return h('span', { className: 'pcs-badge ' + (props.draft ? 'pcs-badge-draft' : 'pcs-badge-saved') }, props.children);
}
function entryTime(time: string): string {
  const date = new Date(time);
  return Number.isNaN(date.getTime()) ? time : date.toLocaleString('zh-CN', { hour12: false });
}

export function ProviderClientPanel({ api: providedApi }: ProviderClientPanelProps = {}) {
  const api = React.useMemo(() => providedApi ?? createPanelApi(), [providedApi]);
  const [session, setSession] = React.useState(emptyEditorSession);
  const [busy, setBusy] = React.useState<Operation | null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [lastRead, setLastRead] = React.useState('');
  const alive = React.useRef(false);
  const sequence = React.useRef(0);
  const pending = React.useRef(false);
  const abort = React.useRef<AbortController | null>(null);
  const current = React.useRef(session);
  current.current = session;
  const fieldId = 'pcs-' + React.useId().replace(/:/g, '');

  const run = React.useCallback(async (operation: Operation, request: PanelApiRequest, savedProviderId?: string) => {
    if (pending.current || !alive.current) return;
    pending.current = true;
    const ticket = ++sequence.current;
    const controller = new AbortController();
    abort.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    setBusy(operation); setError(''); setNotice('');
    try {
      const reply = await api.call(request, controller.signal);
      if (!alive.current || ticket !== sequence.current) return;
      if (operation === 'refresh' || operation === 'save' || operation === 'listener') {
        if (!reply.state) throw new Error('服务未返回最新状态。');
        setSession(previous => reconcileState(previous, reply.state!, savedProviderId));
        setNotice(operation === 'save' ? '已保存，立即生效。'
          : operation === 'listener' ? (reply.state.config.listener.enabled ? '出站请求监听已开启。' : '出站请求监听已关闭。')
            : '已读取最新状态。');
      } else {
        const entries = reply.entries ?? reply.state?.entries ?? [];
        setSession(previous => {
          if (reply.state) return { ...reconcileState(previous, reply.state), revisionStale: previous.revisionStale };
          return previous.snapshot ? { ...previous, snapshot: { ...previous.snapshot, entries } } : previous;
        });
        if (operation === 'clear') setNotice('监听记录已清空。');
      }
      setLastRead(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch (failure) {
      if (!alive.current || ticket !== sequence.current) return;
      if (isRevisionConflict(failure)) {
        setSession(markRevisionConflict);
        setError('配置已在别处更新，请先刷新，再重新保存。');
      } else {
        setError(timedOut ? '读取超时，请重试。'
          : redactText(failure instanceof Error ? failure.message : '请求未完成，请重试。'));
      }
    } finally {
      clearTimeout(timeout);
      if (alive.current && ticket === sequence.current) { pending.current = false; abort.current = null; setBusy(null); }
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
  const patch = (change: Parameters<typeof updateDraft>[2]) => {
    if (pending.current) return;
    setError(''); setNotice('');
    setSession(previous => updateDraft(previous, previous.selectedProviderId, change));
  };
  const chooseProvider = (id: string) => {
    if (pending.current) return;
    setError(''); setNotice(''); setSession(previous => selectProvider(previous, id));
  };
  const save = () => {
    try { const request = buildSaveRequest(current.current); void run('save', request, request.providerId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '请检查规则。'); }
  };
  const button = (text: string, onClick: () => void, options: { disabled?: boolean; primary?: boolean; className?: string } = {}) =>
    h('button', { type: 'button', className: 'pcs-button' + (options.primary ? ' pcs-button-primary' : '') + (options.className ? ' ' + options.className : ''),
      onClick, disabled: blocked || options.disabled }, text);

  const providerField = form ? h('div', { className: 'pcs-field' },
    h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-provider' },
      h('span', null, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '1'), '选择供应商')),
    h('select', {
      id: fieldId + '-provider', className: 'pcs-control', value: session.selectedProviderId,
      onChange: (event: { currentTarget: { value: string } }) => chooseProvider(event.currentTarget.value),
    },
      !selected && session.selectedProviderId ? h('option', { value: session.selectedProviderId, disabled: true }, '供应商已移除') : null,
      ...providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.label))),
    h('p', { className: 'pcs-help' }, selected ? selected.adapter + ' · ' + selected.modelIds.length + ' 个已配置模型' : '此供应商已从 DSH 配置移除。')) : null;

  const clientField = form ? h('div', { className: 'pcs-field' },
    h('div', { className: 'pcs-field-label', id: fieldId + '-client-label' },
      h('span', null, h('span', { className: 'pcs-field-step', 'aria-hidden': true }, '2'), '选择模拟客户端')),
    h('div', { className: 'pcs-clients', role: 'radiogroup', 'aria-labelledby': fieldId + '-client-label' },
      ...CLIENTS.map(client => h('label', { key: client.id, className: 'pcs-client' },
        h('input', {
          type: 'radio', name: fieldId + '-client', value: client.id, checked: form.client === client.id,
          onChange: () => patch(setDraftClient(form, client.id, snapshot?.profiles ?? [])),
        }),
        h('span', null,
          h('span', { className: 'pcs-client-name' }, client.label),
          h('span', { className: 'pcs-client-description' }, client.description))))),
    h('p', { className: 'pcs-help' }, '同一时间只模拟一个供应商：保存后，其他供应商会自动恢复为不模拟。')) : null;

  const editor = form && providerField && clientField ? h('article', { className: 'pcs-card', 'aria-labelledby': fieldId + '-editor' },
    h('div', { className: 'pcs-card-head' },
      h('h3', { id: fieldId + '-editor' }, '模拟设置'),
      h(Badge, { draft: dirty, children: dirty ? '未保存' : '已生效' })),
    h('div', { className: 'pcs-card-body' },
      h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, providerField, clientField)),
    h('div', { className: 'pcs-actions' },
      h('span', { className: 'pcs-small pcs-muted' }, dirty ? '尚未生效' : savedRule && savedRule.client !== 'none' ? '正在生效' : '未启用模拟'),
      h('div', { className: 'pcs-action-buttons' },
        button(busy === 'save' ? '保存中…' : '保存', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;

  const listener = snapshot ? h('details', { className: 'pcs-card pcs-listener', 'aria-labelledby': fieldId + '-listener' },
    h('summary', { id: fieldId + '-listener' }, '出站请求监听', h('span', { className: 'pcs-small pcs-muted' }, '调试 · 脱敏')),
    h('div', { className: 'pcs-card-body' },
      h('div', { className: 'pcs-listener-toolbar' },
        h('button', { type: 'button', className: 'pcs-switch', role: 'switch', 'aria-label': '出站请求监听',
          'aria-checked': listenerEnabled, disabled: blocked || session.revisionStale || (!listenerEnabled && !transportActive),
          onClick: () => { void run('listener', { action: 'listener', enabled: !listenerEnabled, revision: snapshot.config.revision }); } },
          h('span', { className: 'pcs-switch-track', 'aria-hidden': true }, h('span', { className: 'pcs-switch-knob' })),
          busy === 'listener' ? '更新中…' : listenerEnabled ? '监听中' : '已关闭'),
        h('span', { className: 'pcs-small pcs-muted' }, snapshot.entries.length + ' 条记录 · 上限 ' + snapshot.config.listener.maxEntries),
        h('div', { className: 'pcs-action-buttons' }, button(busy === 'logs' ? '读取中…' : '读取记录', () => { void run('logs', { action: 'logs' }); }),
          button(busy === 'clear' ? '清空中…' : '清空', () => { void run('clear', { action: 'clear' }); },
            { disabled: !snapshot.entries.length, className: 'pcs-button-danger' }))),
      !transportActive ? h('p', { className: 'pcs-help' }, '出站接入尚未就绪：' + snapshot.runtime.detail) : null,
      snapshot.entries.length ? h('div', { className: 'pcs-log-list' },
        ...snapshot.entries.slice().reverse().map(entry => h('details', { key: entry.id, className: 'pcs-log' },
          h('summary', null, (snapshot.providers.find(provider => provider.id === entry.providerId)?.label ?? '供应商') + ' · ' + entry.modelId + ' · ' + entryTime(entry.time)),
          h('div', { className: 'pcs-log-content' },
            h('div', { className: 'pcs-log-meta' }, h('span', null, clientLabel(entry.client) + ' · ' + entry.profile),
              h('span', null, entry.protocol + ' → ' + entry.targetProtocol), entry.status !== undefined ? h('span', null, 'HTTP ' + entry.status) : null),
            h('p', { className: 'pcs-help pcs-code' }, entry.url),
            entry.error ? h('p', { className: 'pcs-validation' }, entry.error) : null,
            h('div', { className: 'pcs-log-label' }, '请求头 · 已脱敏'), h('pre', null, JSON.stringify(entry.headers, null, 2)),
            h('div', { className: 'pcs-log-label' }, '请求体 · 结构与指纹摘要'), h('pre', null, JSON.stringify(entry.body, null, 2))))))
        : h('p', { className: 'pcs-help' }, listenerEnabled ? '正常使用后点「读取记录」查看实际出站摘要。' : '开启监听后才会记录出站请求。'))) : null;

  return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked },
    h('style', null, PANEL_CSS),
    h('header', { className: 'pcs-hero' }, h('div', null,
      h('div', { className: 'pcs-eyebrow' }, h('span', { className: 'pcs-dot', 'aria-hidden': true }), '单供应商模拟 · 保存即生效'),
      h('h2', { className: 'pcs-title', id: fieldId + '-title' }, PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + PLUGIN_VERSION)),
      h('p', { className: 'pcs-subtitle' }, '选一个供应商和一个客户端，保存即生效。')),
      h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked,
        onClick: () => { void run('refresh', { action: 'state' }); } },
        busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : null,
        busy === 'refresh' ? '刷新中…' : '刷新')),
    snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') },
      h('span', { className: 'pcs-current-label' }, '当前模拟'),
      simulating.length
        ? h('div', { className: 'pcs-current-list' }, ...simulating.map(({ provider, rule }) => h('button', {
          type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked,
          'aria-pressed': provider.id === session.selectedProviderId,
          onClick: () => chooseProvider(provider.id),
        }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile')))))
        : h('span', { className: 'pcs-current-idle-text' }, '未启用（不模拟任何客户端）')) : null,
    session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' },
      h('div', null, h('strong', null, '配置已更新'), h('p', null, '请点刷新后再保存。'))) : null,
    error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null,
    notice ? h('div', { className: 'pcs-banner pcs-banner-success', role: 'status' }, notice) : null,
    !snapshot ? h('div', { className: 'pcs-empty' }, h('strong', null, busy === 'refresh' ? '正在读取' : '尚未读取状态'),
      busy === 'refresh' ? '正在读取当前 DSH 供应商配置。' : '点右上角刷新重试。') : null,
    snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('strong', null, '尚无已配置供应商'),
      '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null,
    editor,
    listener,
    h('p', { className: 'pcs-footer' },
      'v' + PLUGIN_VERSION + ' · 已连接 ' + providers.length + ' 个供应商 · 出站接入 ' + (transportActive ? '已就绪' : '未就绪')
      + (lastRead ? ' · 最近读取 ' + lastRead : '')));
}

export const name = PLUGIN_NAME;
/**
 * Cordis service dependencies of the browser half. `slots` must be declared here: cordis throws
 * `cannot get property "slots" without inject` on an undeclared service read, which leaves the
 * plugin fiber stuck in `loading` and silently drops every slot registration (this is exactly the
 * shape shipped by dshmarket — `const inject = ["slots","locale","theme"]` at client.js:25690).
 */
export const inject = [SLOT_SERVICE_ID];
export function apply(ctx: ClientContext): void {
  registerClientUi(ctx, {
    panel: () => h(ProviderClientPanel),
    icon: (owner) => h(SidebarIcon, { size: owner?.size ?? 16 }),
  });
}
export default { name, inject, apply };
