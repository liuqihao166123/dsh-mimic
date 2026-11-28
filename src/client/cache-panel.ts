import * as React from 'react';
import type { CacheCounters, CacheDimensionStat, CacheProviderReport, PanelState } from '../types.js';
import { combineCounters } from './cache-model.js';
const h = React.createElement;
const rate = (value: number | null | undefined): string => value == null ? '—' : (value * 100).toFixed(1) + '%';
const tokens = (value: number): string => value.toLocaleString('zh-CN');
const dimensionKey = (value: CacheDimensionStat): string => JSON.stringify([value.modelId, value.profile, value.protocol, value.purpose ?? '']);
const dimensionLabel = (value: CacheDimensionStat): string => [value.modelId || '未知模型', value.profile, value.protocol, value.purpose].filter(Boolean).join(' · ');
export function selectCacheCounters(report: CacheProviderReport, view: string, sessionTag: string, model: string): CacheCounters {
  if (view !== 'session' && !model) return view === 'recent' ? report.recent : report.lifetime;
  const rows = view === 'session' ? report.sessions.filter(item => item.sessionTag === sessionTag) : report.models;
  return combineCounters(rows.filter(item => !model || dimensionKey(item) === model).map(item => view === 'recent' ? item.recent : item.counters));
}
export function CacheInspector({ state, providerId }: {
  state: Pick<PanelState, 'runtime'>; providerId: string;
}) {
  const [view, setView] = React.useState('recent');
  const [sessionChoice, setSessionChoice] = React.useState('');
  const [modelChoice, setModelChoice] = React.useState('');
  const report = state.runtime.cacheReport;
  const provider = report?.providers.find(item => item.providerId === providerId);
  const sessions = [...new Set(provider?.sessions.map(item => item.sessionTag!).filter(Boolean) ?? [])];
  const chosenSession = sessions.includes(sessionChoice) ? sessionChoice : provider?.latestSessionTag ?? sessions[0] ?? '';
  const model = provider?.models.some(item => dimensionKey(item) === modelChoice) ? modelChoice : '';
  const counters = provider ? selectCacheCounters(provider, view, chosenSession, model) : combineCounters([]);
  const metric = (label: string, value: string, detail: string, accent = false) => h('div', { className: 'pcs-cache-metric' + (accent ? ' pcs-cache-metric-accent' : ''), key: label },
    h('span', null, label), h('strong', null, value), h('small', null, detail));
  return h('article', { className: 'pcs-card pcs-cache-inspector', 'aria-label': '缓存统计' },
    h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CACHE INSIGHTS'), h('h3', null, '缓存统计')),
      h('span', { className: 'pcs-small pcs-muted' }, '每 5 秒自动更新')),
    h('div', { className: 'pcs-card-body' },
      h('div', { className: 'pcs-cache-filters' },
        h('label', null, h('span', null, '统计范围'), h('select', { className: 'pcs-control', 'aria-label': '缓存统计范围', value: view, onChange: (e: { currentTarget: { value: string } }) => setView(e.currentTarget.value) },
          h('option', { value: 'recent' }, '最近 ' + (report?.windowSize ?? 20) + ' 次 HTTP'), h('option', { value: 'lifetime' }, '本次运行累计'), h('option', { value: 'session' }, '指定会话累计'))),
        h('label', null, h('span', null, '模型 / 身份 / 协议'), h('select', { className: 'pcs-control', 'aria-label': '缓存模型维度', value: model, onChange: (e: { currentTarget: { value: string } }) => setModelChoice(e.currentTarget.value) },
          h('option', { value: '' }, '全部维度'), ...(provider?.models.map(item => h('option', { key: dimensionKey(item), value: dimensionKey(item) }, dimensionLabel(item))) ?? []))),
        view === 'session' ? h('label', { className: 'pcs-cache-session' }, h('span', null, '会话摘要'), h('select', { className: 'pcs-control pcs-code', 'aria-label': '缓存会话摘要', value: chosenSession, onChange: (e: { currentTarget: { value: string } }) => setSessionChoice(e.currentTarget.value) },
          !sessions.length ? h('option', { value: '' }, '暂无会话') : null,
          ...sessions.map(tag => h('option', { value: tag, key: tag }, (tag === provider?.latestSessionTag ? '最近活动 · ' : '') + tag)))) : null),
      h('div', { className: 'pcs-cache-metrics' },
        metric('输入 Token 命中率', rate(counters.hitRate), '按已知输入量加权', true),
        metric('缓存字段覆盖', rate(counters.coverage), counters.cacheReportedRequests + ' / ' + counters.requests + ' 次 HTTP'),
        metric('HTTP 尝试', String(counters.requests), '成功 ' + counters.success + ' · 失败 ' + counters.failed + ' · 取消 ' + counters.cancelled + ' · 未完整 ' + counters.incomplete),
        metric('命中 / 已知输入', tokens(counters.cachedTokens) + ' / ' + tokens(counters.knownPromptTokens), '写入 ' + tokens(counters.writtenTokens) + ' · 已报输入 ' + tokens(counters.promptTokens))),
      h('p', { className: 'pcs-help pcs-cache-explanation', title: '命中率 = 缓存读取 Token / 已明确报告缓存字段的总输入 Token；Claude 总输入含普通输入、缓存读取和写入。' }, '缺少缓存字段显示未知；明确返回 0 才计零命中。'),
      h('div', { className: 'pcs-cache-flags' },
        ...[['缺 usage', counters.missingUsageRequests], ['字段未知', counters.unknownCacheRequests], ['用量异常', counters.invalidUsageRequests], ['首次观测', counters.coldRequests], ['会话回退', counters.fallbackRequests], ['同轮多次', counters.retryRequests]].map(([label, value]) => h('span', { key: String(label) }, label, h('strong', null, String(value)))))));
}
