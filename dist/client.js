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
"/client/cache-model.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREFIX_CHANGE_LABELS = exports.COUNTER_KEYS = void 0;
exports.validCacheReport = validCacheReport;
exports.validCacheDiagnostics = validCacheDiagnostics;
exports.projectCounters = projectCounters;
exports.projectCacheReport = projectCacheReport;
exports.projectCacheDiagnostics = projectCacheDiagnostics;
exports.combineCounters = combineCounters;
exports.COUNTER_KEYS = ['requests', 'success', 'failed', 'cancelled', 'incomplete', 'coldRequests', 'fallbackRequests', 'retryRequests',
    'usageRequests', 'cacheReportedRequests', 'missingUsageRequests', 'unknownCacheRequests', 'invalidUsageRequests',
    'promptTokens', 'cachedTokens', 'writtenTokens', 'uncachedTokens', 'knownPromptTokens'];
const PROTOCOLS = ['anthropic-messages', 'openai-responses', 'openai-chat-completions'];
const CHANGES = ['cold', 'model', 'profile', 'protocol', 'endpoint', 'cache-key', 'system', 'tools', 'parameters', 'history', 'append', 'unchanged', 'unknown'];
const OUTCOMES = ['success', 'http-error', 'stream-error', 'cancelled', 'incomplete'];
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => Number.isSafeInteger(v) && Number(v) >= 0;
const text = (v, max = 512) => typeof v === 'string' && v.length <= max;
const time = (v) => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const rate = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const tag = (v, prefix) => typeof v === 'string' && new RegExp('^' + prefix + '-[a-f0-9]{16,24}$').test(v);
const safeText = (v) => v.replace(/\bBearer\s+[^\s]+/gi, '[REDACTED]').replace(/\bsk-(?:proj-)?[a-z0-9_-]{6,}/gi, '[REDACTED]');
function validCounters(v) {
    return object(v) && exports.COUNTER_KEYS.every(key => count(v[key])) && (v.hitRate === null || rate(v.hitRate)) && rate(v.coverage)
        && (v.since === undefined || time(v.since)) && (v.lastAt === undefined || time(v.lastAt));
}
function validDimension(v) {
    return object(v) && text(v.modelId) && text(v.profile, 256) && PROTOCOLS.includes(String(v.protocol))
        && (v.sessionTag === undefined || tag(v.sessionTag, 's')) && (v.sessionSource === undefined || ['host', 'fallback'].includes(String(v.sessionSource)))
        && (v.purpose === undefined || typeof v.purpose === 'string' && /^[a-z0-9._/-]{1,64}$/i.test(v.purpose))
        && validCounters(v.counters) && validCounters(v.recent);
}
function validCacheReport(v) {
    return v === undefined || object(v) && time(v.startedAt) && count(v.windowSize) && Number(v.windowSize) >= 1 && Number(v.windowSize) <= 100
        && Array.isArray(v.providers) && v.providers.length <= 128 && v.providers.every(p => object(p) && text(p.providerId)
        && validCounters(p.lifetime) && validCounters(p.recent) && (p.latestSessionTag === undefined || tag(p.latestSessionTag, 's'))
        && Array.isArray(p.sessions) && p.sessions.length <= 64 && p.sessions.every(validDimension)
        && Array.isArray(p.models) && p.models.length <= 128 && p.models.every(validDimension));
}
function validDiagnostic(v) {
    if (!object(v))
        return false;
    return typeof v.id === 'string' && /^d-[a-z0-9-]{1,80}$/.test(v.id) && time(v.time) && text(v.providerId) && text(v.modelId) && text(v.profile, 256)
        && PROTOCOLS.includes(String(v.protocol)) && tag(v.sessionTag, 's') && ['host', 'fallback'].includes(String(v.sessionSource))
        && (v.purpose === undefined || typeof v.purpose === 'string' && /^[a-z0-9._/-]{1,64}$/i.test(v.purpose))
        && count(v.attempt) && (v.cacheKeyTag === undefined || tag(v.cacheKeyTag, 'k')) && CHANGES.includes(String(v.change))
        && Array.isArray(v.changed) && v.changed.length <= CHANGES.length && v.changed.every(c => CHANGES.includes(String(c)))
        && ['messages', 'previousMessages', 'sharedMessages'].every(key => count(v[key]))
        && (v.firstChangedMessage === undefined || count(v.firstChangedMessage) && v.firstChangedMessage >= 1)
        && typeof v.comparable === 'boolean'
        && ['system', 'tools', 'parameters'].every(key => object(v[key]) && tag(v[key].tag, 'h') && count(v[key].chars))
        && (v.outcome === undefined || OUTCOMES.includes(String(v.outcome)))
        && ['promptTokens', 'cachedTokens', 'writtenTokens'].every(key => v[key] === undefined || count(v[key]))
        && (v.cacheReported === undefined || typeof v.cacheReported === 'boolean') && (v.hitRate === undefined || v.hitRate === null || rate(v.hitRate));
}
function validCacheDiagnostics(v) {
    return v === undefined || object(v) && typeof v.enabled === 'boolean' && count(v.maxEntries) && Number(v.maxEntries) >= 1 && Number(v.maxEntries) <= 500
        && count(v.maxSessions) && Number(v.maxSessions) >= 1 && Number(v.maxSessions) <= 256 && v.keyScope === 'runtime'
        && Array.isArray(v.entries) && v.entries.length <= Number(v.maxEntries) && v.entries.every(validDiagnostic);
}
function projectCounters(v) {
    return { ...Object.fromEntries(exports.COUNTER_KEYS.map(key => [key, v[key]])), hitRate: v.hitRate, coverage: v.coverage,
        ...(v.since ? { since: v.since } : {}), ...(v.lastAt ? { lastAt: v.lastAt } : {}) };
}
function projectDimension(v) {
    return { modelId: safeText(v.modelId), profile: safeText(v.profile), protocol: v.protocol,
        ...(v.sessionTag ? { sessionTag: v.sessionTag } : {}), ...(v.sessionSource ? { sessionSource: v.sessionSource } : {}), ...(v.purpose ? { purpose: v.purpose } : {}),
        counters: projectCounters(v.counters), recent: projectCounters(v.recent) };
}
function projectCacheReport(v) {
    return { startedAt: v.startedAt, windowSize: v.windowSize, providers: v.providers.map(p => ({ providerId: p.providerId,
            lifetime: projectCounters(p.lifetime), recent: projectCounters(p.recent), ...(p.latestSessionTag ? { latestSessionTag: p.latestSessionTag } : {}),
            sessions: p.sessions.map(projectDimension), models: p.models.map(projectDimension) })) };
}
function projectCacheDiagnostics(v) {
    return { enabled: v.enabled, maxEntries: v.maxEntries, maxSessions: v.maxSessions, keyScope: 'runtime', entries: v.entries.map(e => ({
            id: e.id, time: e.time, providerId: e.providerId, modelId: safeText(e.modelId), profile: safeText(e.profile), protocol: e.protocol,
            sessionTag: e.sessionTag, sessionSource: e.sessionSource, ...(e.purpose ? { purpose: e.purpose } : {}), attempt: e.attempt,
            ...(e.cacheKeyTag ? { cacheKeyTag: e.cacheKeyTag } : {}), change: e.change, changed: [...e.changed],
            messages: e.messages, previousMessages: e.previousMessages, sharedMessages: e.sharedMessages, comparable: e.comparable,
            ...(e.firstChangedMessage !== undefined ? { firstChangedMessage: e.firstChangedMessage } : {}),
            system: { tag: e.system.tag, chars: e.system.chars }, tools: { tag: e.tools.tag, chars: e.tools.chars }, parameters: { tag: e.parameters.tag, chars: e.parameters.chars },
            ...(e.outcome ? { outcome: e.outcome } : {}), ...(e.promptTokens !== undefined ? { promptTokens: e.promptTokens } : {}),
            ...(e.cachedTokens !== undefined ? { cachedTokens: e.cachedTokens } : {}), ...(e.writtenTokens !== undefined ? { writtenTokens: e.writtenTokens } : {}),
            ...(e.cacheReported !== undefined ? { cacheReported: e.cacheReported } : {}), ...(e.hitRate !== undefined ? { hitRate: e.hitRate } : {}),
        })) };
}
function combineCounters(items) {
    const result = { ...Object.fromEntries(exports.COUNTER_KEYS.map(key => [key, 0])), hitRate: null, coverage: 0 };
    for (const item of items) {
        for (const key of exports.COUNTER_KEYS)
            result[key] += item[key];
        if (item.since && (!result.since || item.since < result.since))
            result.since = item.since;
        if (item.lastAt && (!result.lastAt || item.lastAt > result.lastAt))
            result.lastAt = item.lastAt;
    }
    result.hitRate = result.knownPromptTokens > 0 ? result.cachedTokens / result.knownPromptTokens : null;
    result.coverage = result.requests > 0 ? result.cacheReportedRequests / result.requests : 0;
    return result;
}
exports.PREFIX_CHANGE_LABELS = { cold: '首次观测', model: '模型变化', profile: '身份模板变化', protocol: '协议变化', endpoint: '上游地址变化',
    'cache-key': '缓存键变化', system: '系统指令变化', tools: '工具定义变化', parameters: '请求参数变化', history: '历史消息改写', append: '仅追加消息', unchanged: '前缀保持一致', unknown: '超出比较范围' };

},
"/client/cache-panel.js": function(require,module,exports) {
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
exports.selectCacheCounters = selectCacheCounters;
exports.CacheInspector = CacheInspector;
const React = __importStar(require("react"));
const cache_model_js_1 = require("./cache-model.js");
const h = React.createElement;
const rate = (value) => value == null ? '—' : (value * 100).toFixed(1) + '%';
const tokens = (value) => value.toLocaleString('zh-CN');
const dimensionKey = (value) => JSON.stringify([value.modelId, value.profile, value.protocol, value.purpose ?? '']);
const dimensionLabel = (value) => [value.modelId || '未知模型', value.profile, value.protocol, value.purpose].filter(Boolean).join(' · ');
function selectCacheCounters(report, view, sessionTag, model) {
    if (view !== 'session' && !model)
        return view === 'recent' ? report.recent : report.lifetime;
    const rows = view === 'session' ? report.sessions.filter(item => item.sessionTag === sessionTag) : report.models;
    return (0, cache_model_js_1.combineCounters)(rows.filter(item => !model || dimensionKey(item) === model).map(item => view === 'recent' ? item.recent : item.counters));
}
function CacheInspector({ state, providerId }) {
    const [view, setView] = React.useState('recent');
    const [sessionChoice, setSessionChoice] = React.useState('');
    const [modelChoice, setModelChoice] = React.useState('');
    const report = state.runtime.cacheReport;
    const provider = report?.providers.find(item => item.providerId === providerId);
    const sessions = [...new Set(provider?.sessions.map(item => item.sessionTag).filter(Boolean) ?? [])];
    const chosenSession = sessions.includes(sessionChoice) ? sessionChoice : provider?.latestSessionTag ?? sessions[0] ?? '';
    const model = provider?.models.some(item => dimensionKey(item) === modelChoice) ? modelChoice : '';
    const counters = provider ? selectCacheCounters(provider, view, chosenSession, model) : (0, cache_model_js_1.combineCounters)([]);
    const metric = (label, value, detail, accent = false) => h('div', { className: 'pcs-cache-metric' + (accent ? ' pcs-cache-metric-accent' : ''), key: label }, h('span', null, label), h('strong', null, value), h('small', null, detail));
    return h('article', { className: 'pcs-card pcs-cache-inspector', 'aria-label': '缓存统计' }, h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CACHE INSIGHTS'), h('h3', null, '缓存统计')), h('span', { className: 'pcs-small pcs-muted' }, '每 5 秒自动更新')), h('div', { className: 'pcs-card-body' }, h('div', { className: 'pcs-cache-filters' }, h('label', null, h('span', null, '统计范围'), h('select', { className: 'pcs-control', 'aria-label': '缓存统计范围', value: view, onChange: (e) => setView(e.currentTarget.value) }, h('option', { value: 'recent' }, '最近 ' + (report?.windowSize ?? 20) + ' 次 HTTP'), h('option', { value: 'lifetime' }, '本次运行累计'), h('option', { value: 'session' }, '指定会话累计'))), h('label', null, h('span', null, '模型 / 身份 / 协议'), h('select', { className: 'pcs-control', 'aria-label': '缓存模型维度', value: model, onChange: (e) => setModelChoice(e.currentTarget.value) }, h('option', { value: '' }, '全部维度'), ...(provider?.models.map(item => h('option', { key: dimensionKey(item), value: dimensionKey(item) }, dimensionLabel(item))) ?? []))), view === 'session' ? h('label', { className: 'pcs-cache-session' }, h('span', null, '会话摘要'), h('select', { className: 'pcs-control pcs-code', 'aria-label': '缓存会话摘要', value: chosenSession, onChange: (e) => setSessionChoice(e.currentTarget.value) }, !sessions.length ? h('option', { value: '' }, '暂无会话') : null, ...sessions.map(tag => h('option', { value: tag, key: tag }, (tag === provider?.latestSessionTag ? '最近活动 · ' : '') + tag)))) : null), h('div', { className: 'pcs-cache-metrics' }, metric('输入 Token 命中率', rate(counters.hitRate), '按已知输入量加权', true), metric('缓存字段覆盖', rate(counters.coverage), counters.cacheReportedRequests + ' / ' + counters.requests + ' 次 HTTP'), metric('HTTP 尝试', String(counters.requests), '成功 ' + counters.success + ' · 失败 ' + counters.failed + ' · 取消 ' + counters.cancelled + ' · 未完整 ' + counters.incomplete), metric('命中 / 已知输入', tokens(counters.cachedTokens) + ' / ' + tokens(counters.knownPromptTokens), '写入 ' + tokens(counters.writtenTokens) + ' · 已报输入 ' + tokens(counters.promptTokens))), h('p', { className: 'pcs-help pcs-cache-explanation', title: '命中率 = 缓存读取 Token / 已明确报告缓存字段的总输入 Token；Claude 总输入含普通输入、缓存读取和写入。' }, '缺少缓存字段显示未知；明确返回 0 才计零命中。'), h('div', { className: 'pcs-cache-flags' }, ...[['缺 usage', counters.missingUsageRequests], ['字段未知', counters.unknownCacheRequests], ['用量异常', counters.invalidUsageRequests], ['首次观测', counters.coldRequests], ['会话回退', counters.fallbackRequests], ['同轮多次', counters.retryRequests]].map(([label, value]) => h('span', { key: String(label) }, label, h('strong', null, String(value)))))));
}

},
"/client/cache-styles.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_CSS = void 0;
exports.CACHE_CSS = String.raw `
.pcs-root .pcs-cache-inspector { flex: 1; }
.pcs-root .pcs-cache-filters { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 8px; margin-bottom: 10px; }
.pcs-root .pcs-cache-filters:has(.pcs-cache-session) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pcs-root .pcs-cache-filters > label { display: grid; gap: 5px; min-width: 0; font-size: 11px; font-weight: 600; }
.pcs-root .pcs-cache-filters .pcs-control { text-overflow: ellipsis; font-weight: 400; }
.pcs-root .pcs-cache-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pcs-root .pcs-cache-metric { display: flex; flex-direction: column; justify-content: center; min-width: 0; min-height: 76px; padding: 9px 11px; border: 1px solid var(--pcs-border); background: var(--pcs-layer); border-radius: 8px; }
.pcs-root .pcs-cache-metric-accent { background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 25%, var(--pcs-border)); }
.pcs-root .pcs-cache-metric > span { color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-cache-metric > strong { margin: 2px 0; font-size: 24px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.03em; overflow-wrap: anywhere; }
.pcs-root .pcs-cache-metric-accent > strong { color: var(--pcs-brand); }
.pcs-root .pcs-cache-metric:last-child > strong { font-size: 14px; line-height: 1.6; letter-spacing: -.02em; }
.pcs-root .pcs-cache-metric > small { color: var(--pcs-muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.pcs-root .pcs-cache-explanation { margin-top: 8px; }
.pcs-root .pcs-cache-flags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.pcs-root .pcs-cache-flags > span { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid var(--pcs-border); border-radius: 5px; color: var(--pcs-muted); font-size: 10px; }
.pcs-root .pcs-cache-flags strong { color: var(--pcs-fg); font-weight: 600; font-variant-numeric: tabular-nums; }
@container (max-width: 520px) {
  .pcs-root .pcs-cache-filters, .pcs-root .pcs-cache-filters:has(.pcs-cache-session) { grid-template-columns: minmax(0, 1fr); }
  .pcs-root .pcs-cache-metric { padding: 10px; }
  .pcs-root .pcs-cache-metric:last-child > strong { font-size: 13px; }
}
`;

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
exports.ProviderClientPage = ProviderClientPage;
exports.apply = apply;
const React = __importStar(require("react"));
const types_js_1 = require("../types.js");
const model_js_1 = require("./model.js");
const slots_js_1 = require("./slots.js");
const brand_js_1 = require("./brand.js");
const styles_js_1 = require("./styles.js");
const cache_styles_js_1 = require("./cache-styles.js");
const cache_panel_js_1 = require("./cache-panel.js");
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
        WebkitMaskImage: `url("${brand_js_1.MONO_LOGO_DATA_URI}")`, maskImage: `url("${brand_js_1.MONO_LOGO_DATA_URI}")`,
    },
});
function Badge(props) {
    return h('span', { className: 'pcs-badge ' + (props.draft ? 'pcs-badge-draft' : 'pcs-badge-saved') }, h('span', { className: 'pcs-badge-dot', 'aria-hidden': true }), props.children);
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
            setSession(previous => (0, model_js_1.reconcileState)(previous, reply.state, savedProviderId));
            setNotice(operation === 'save' ? '已保存，立即生效。' : '已读取最新状态。');
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
    const providers = snapshot ? (0, model_js_1.configuredProviders)(snapshot.providers) : [];
    const selected = providers.find(provider => provider.id === session.selectedProviderId);
    const draft = session.drafts[session.selectedProviderId];
    const form = draft?.form;
    const dirty = draft ? (0, model_js_1.isDraftDirty)(draft) : false;
    const savedRule = snapshot?.config.providers[session.selectedProviderId];
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
    const concurrencyStat = snapshot?.runtime.concurrency?.find(item => item.providerId === session.selectedProviderId);
    const editor = form ? h('article', { className: 'pcs-card pcs-editor', 'aria-labelledby': fieldId + '-editor' }, h('div', { className: 'pcs-card-head' }, h('div', null, h('div', { className: 'pcs-card-kicker' }, 'CONFIGURATION'), h('h3', { id: fieldId + '-editor' }, '模拟设置')), h(Badge, { draft: dirty, children: dirty ? '未保存' : savedRule && savedRule.client !== 'none' ? '已生效' : '未启用' })), h('div', { className: 'pcs-card-body' }, h('fieldset', { className: 'pcs-fieldset', disabled: blocked }, h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-provider' }, '供应商', selected ? h('span', { className: 'pcs-label-aside' }, selected.modelIds.length + ' 个模型') : null), h('select', { id: fieldId + '-provider', className: 'pcs-control', value: session.selectedProviderId,
        onChange: (event) => chooseProvider(event.currentTarget.value) }, !selected && session.selectedProviderId ? h('option', { value: session.selectedProviderId, disabled: true }, '供应商已移除') : null, ...providers.map(provider => h('option', { key: provider.id, value: provider.id }, provider.label))), h('p', { className: 'pcs-help pcs-provider-detail' }, selected ? selected.adapter + ' · ' + (selected.protocol ?? '自动识别') : '此供应商已从 DSH 配置移除。')), h('div', { className: 'pcs-field' }, h('div', { className: 'pcs-field-label', id: fieldId + '-client-label' }, '客户端身份', h('span', { className: 'pcs-label-aside' }, '请求头与请求体同步')), h('div', { className: 'pcs-clients', role: 'radiogroup', 'aria-labelledby': fieldId + '-client-label' }, ...CLIENTS.map(client => h('label', { key: client.id, className: 'pcs-client' }, h('input', { type: 'radio', name: fieldId + '-client', value: client.id, checked: form.client === client.id,
        onChange: () => patch((0, model_js_1.setDraftClient)(form, client.id, snapshot?.profiles ?? [])) }), h('span', { className: 'pcs-client-copy' }, h('span', { className: 'pcs-client-name' }, client.label), h('span', { className: 'pcs-client-description' }, client.description))))), h('p', { className: 'pcs-help' }, '保存后，其他供应商自动恢复为原样请求。')), h('div', { className: 'pcs-field' }, h('label', { className: 'pcs-field-label', htmlFor: fieldId + '-concurrency' }, '并发上限', h('span', { className: 'pcs-label-aside' }, '0 = 不限制')), h('div', { className: 'pcs-inline-controls' }, h('input', { id: fieldId + '-concurrency', className: 'pcs-control pcs-number', type: 'number', inputMode: 'numeric',
        min: 0, max: 64, step: 1, value: form.concurrencyText, placeholder: '0',
        onChange: (event) => patch({ concurrencyText: event.currentTarget.value }) }), h('select', { id: fieldId + '-concurrency-mode', className: 'pcs-control', value: form.concurrencyMode, 'aria-label': '超出并发上限时',
        onChange: (event) => patch({ concurrencyMode: event.currentTarget.value === 'reject' ? 'reject' : 'queue' }) }, h('option', { value: 'queue' }, '超限排队'), h('option', { value: 'reject' }, '超限报错')))))), h('div', { className: 'pcs-actions' }, h('span', { className: 'pcs-action-note' }, h('span', { className: 'pcs-action-indicator ' + (dirty ? 'is-dirty' : '') }), dirty ? '修改尚未应用' : '保存即生效'), h('div', { className: 'pcs-action-buttons' }, dirty ? button('还原', () => { setError(''); setNotice(''); setSession(model_js_1.restoreSelectedDraft); }, { className: 'pcs-button-quiet' }) : null, button(busy === 'save' ? '保存中…' : '保存更改', save, { primary: true, disabled: !dirty || !selected || session.revisionStale })))) : null;
    const overview = snapshot ? h('aside', { className: 'pcs-overview', 'aria-label': '运行概况' }, h('div', { className: 'pcs-overview-status ' + (transportActive ? 'is-ready' : 'is-waiting'), title: snapshot.runtime.detail }, h('span', { className: 'pcs-status-icon', 'aria-hidden': true }, transportActive ? '✓' : '·'), h('div', null, h('span', { className: 'pcs-overview-caption' }, '运行概况'), h('strong', null, statusLabel(snapshot.runtime.transport)))), h('div', { className: 'pcs-metric' }, h('span', null, '已连接供应商'), h('strong', null, String(providers.length))), h('div', { className: 'pcs-metric' }, h('span', null, '当前并发'), h('strong', null, concurrencyStat ? concurrencyStat.active + ' / ' + concurrencyStat.limit : '—')), h('div', { className: 'pcs-metric' }, h('span', null, '注册挂载'), h('strong', null, String(snapshot.runtime.registrations)))) : null;
    return h('section', { className: 'pcs-root', 'aria-labelledby': fieldId + '-title', 'aria-busy': blocked }, h('style', null, styles_js_1.PANEL_CSS + cache_styles_js_1.CACHE_CSS), h('header', { className: 'pcs-hero' }, h('div', { className: 'pcs-brand-lockup' }, h('img', { className: 'pcs-brand-logo', src: brand_js_1.LOGO_DATA_URI, alt: '' }), h('div', null, h('div', { className: 'pcs-eyebrow' }, 'DSH PLUGIN · WIRE IDENTITY'), h('h2', { className: 'pcs-title', id: fieldId + '-title' }, slots_js_1.PANEL_TITLE, h('span', { className: 'pcs-version' }, 'v' + types_js_1.PLUGIN_VERSION)), h('p', { className: 'pcs-subtitle' }, '供应商配置与缓存表现，一屏掌握。'))), h('div', { className: 'pcs-header-actions' }, notice ? h('span', { className: 'pcs-notice', role: 'status' }, notice) : null, h('button', { type: 'button', className: 'pcs-button pcs-refresh', disabled: blocked, onClick: () => { void run('refresh', { action: 'state' }); } }, busy === 'refresh' ? h('span', { className: 'pcs-spin', 'aria-hidden': true }) : h('span', { 'aria-hidden': true }, '↻'), busy === 'refresh' ? '刷新中…' : '刷新'))), snapshot ? h('div', { className: 'pcs-current' + (simulating.length ? '' : ' pcs-current-idle') }, h('span', { className: 'pcs-current-heading' }, h('span', { className: 'pcs-live-dot', 'aria-hidden': true }), '当前模拟'), simulating.length ? simulating.map(({ provider, rule }) => h('button', { type: 'button', key: provider.id, className: 'pcs-current-chip', disabled: blocked,
        'aria-pressed': provider.id === session.selectedProviderId, onClick: () => chooseProvider(provider.id) }, h('strong', null, provider.label), h('span', null, clientLabel(rule.client) + ' · ' + (rule.profile ?? '默认 profile') + (rule.concurrency ? ' · 并发 ' + rule.concurrency : ''))))
        : h('span', { className: 'pcs-muted' }, '未启用 · 选择客户端并保存')) : null, session.revisionStale ? h('div', { className: 'pcs-banner pcs-banner-warning', role: 'alert' }, '配置已更新，请刷新后再保存。') : null, error ? h('div', { className: 'pcs-banner pcs-banner-error', role: 'alert' }, error) : null, !snapshot ? h('div', { className: 'pcs-empty' }, h('strong', null, busy === 'refresh' ? '正在连接 DSH' : '尚未读取状态'), '正在读取供应商配置，请稍候。') : null, snapshot && !providers.length && !form ? h('div', { className: 'pcs-empty' }, h('strong', null, '尚无已配置供应商'), '先在 DSH 供应商设置里配置模型连接，再刷新此面板。') : null, snapshot && form ? h('div', { className: 'pcs-layout' }, editor, h('div', { className: 'pcs-dashboard' }, overview, session.selectedProviderId ? h(cache_panel_js_1.CacheInspector, { key: session.selectedProviderId, state: snapshot, providerId: session.selectedProviderId }) : null)) : null);
}
/** The main slot supplies bounded space; overflow remains available on small screens and large text. */
function ProviderClientPage(props = {}) {
    return h('div', {
        className: 'pcs-viewport', role: 'region', 'aria-label': '客户端模拟面板', tabIndex: 0,
        style: { width: '100%', height: '100%', maxHeight: '100%', minHeight: 0, minWidth: 0, flex: '1 1 0',
            overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' },
    }, h(ProviderClientPanel, props));
}
exports.name = types_js_1.PLUGIN_NAME;
exports.inject = [slots_js_1.SLOT_SERVICE_ID];
function apply(ctx) {
    (0, slots_js_1.registerClientUi)(ctx, {
        panel: () => h(ProviderClientPanel),
        mainPanel: () => h(ProviderClientPage),
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
const cache_model_js_1 = require("./cache-model.js");
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
            ...(state.runtime.cache ? { cache: state.runtime.cache.map(item => ({ providerId: item.providerId, requests: item.requests, promptTokens: item.promptTokens, cachedTokens: item.cachedTokens, hitRate: item.hitRate })) } : {}),
            ...(state.runtime.cacheReport ? { cacheReport: (0, cache_model_js_1.projectCacheReport)(state.runtime.cacheReport) } : {}),
            ...(state.runtime.cacheDiagnostics ? { cacheDiagnostics: (0, cache_model_js_1.projectCacheDiagnostics)(state.runtime.cacheDiagnostics) } : {}) },
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
        || !validConcurrencyStats(value.runtime.concurrency) || !validCacheStats(value.runtime.cache)
        || !(0, cache_model_js_1.validCacheReport)(value.runtime.cacheReport) || !(0, cache_model_js_1.validCacheDiagnostics)(value.runtime.cacheDiagnostics))
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
            if (request.action === 'state' || request.action === 'save' || request.action === 'listener' || request.action === 'cache-reset' || request.action === 'cache-diagnostics' || request.action === 'cache-diagnostics-clear') {
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
exports.PANEL_TITLE = '客户端模拟';
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
    }, render.mainPanel ?? render.panel));
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
  --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback)); --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback)); --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback)); --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: #0f8177; --pcs-button-fill: #0d8176; --pcs-warn: #a66a13; --pcs-error: #c04450;
  --pcs-soft: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); --pcs-shadow: 0 3px 16px #173d4909;
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1400px; margin: 0 auto; padding: 20px 24px;
  color: var(--pcs-fg); font: 13px/1.5 Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 3px 16px #00000020; }
}
[data-theme="dark"] .pcs-root, .dark .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 3px 16px #00000020; }
[data-theme="light"] .pcs-root, .light .pcs-root { --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed; --pcs-brand: #0f8177; --pcs-warn: #a66a13; --pcs-error: #c04450; --pcs-shadow: 0 3px 16px #173d4909; }
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .45; }
.pcs-root :is(button, select, input):focus-visible { outline: 2px solid var(--pcs-brand); outline-offset: 2px; }
.pcs-root :is(h2, h3, p) { margin: 0; }
.pcs-root .pcs-hero { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.pcs-root .pcs-brand-lockup { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pcs-root .pcs-brand-logo { display: block; width: 46px; height: 46px; flex: 0 0 46px; }
.pcs-root .pcs-eyebrow { color: var(--pcs-brand); font-size: 9px; font-weight: 700; letter-spacing: .15em; }
.pcs-root .pcs-title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 22px; line-height: 1.35; font-weight: 700; letter-spacing: -.03em; }
.pcs-root .pcs-version { padding: 2px 6px; border: 1px solid var(--pcs-border); border-radius: 5px; color: var(--pcs-muted); font-size: 10px; letter-spacing: 0; font-weight: 500; background: var(--pcs-bg); }
.pcs-root .pcs-subtitle { color: var(--pcs-muted); font-size: 11px; margin-top: 2px; }
.pcs-root .pcs-header-actions { display: flex; align-items: center; gap: 12px; }
.pcs-root .pcs-notice { color: var(--pcs-brand); font-size: 11px; }
.pcs-root .pcs-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--pcs-border); border-radius: 7px; color: var(--pcs-fg); background: var(--pcs-bg); line-height: 1.5; font-size: 12px; font-weight: 550; white-space: nowrap; transition: border-color .15s, background .15s; }
.pcs-root .pcs-button:hover:not(:disabled) { border-color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-button-primary { color: #fff; background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); min-width: 92px; }
.pcs-root .pcs-button-primary:hover:not(:disabled) { background: #096e65; border-color: #096e65; }
.pcs-root .pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); }
.pcs-root .pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; min-height: 38px; margin-bottom: 14px; padding: 9px 13px; border: 1px solid color-mix(in srgb, var(--pcs-brand) 22%, var(--pcs-border)); border-radius: 9px; background: var(--pcs-soft); }
.pcs-root .pcs-current-heading { display: inline-flex; align-items: center; gap: 7px; color: var(--pcs-brand); font-size: 11px; font-weight: 650; white-space: nowrap; }
.pcs-root .pcs-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--pcs-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-current-chip { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; min-width: 0; max-width: 100%; padding: 0; border: 0; background: transparent; color: var(--pcs-fg); font-size: 11px; text-align: left; overflow-wrap: anywhere; }
.pcs-root .pcs-current-chip strong { font-size: 12px; }
.pcs-root .pcs-current-chip span { color: var(--pcs-muted); }
.pcs-root .pcs-current-chip:hover strong { color: var(--pcs-brand); }
.pcs-root .pcs-current-idle { border-color: var(--pcs-border); background: var(--pcs-layer); }
.pcs-root .pcs-banner { padding: 8px 12px; border: 1px solid var(--pcs-border); border-radius: 7px; margin-bottom: 12px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-banner-warning { color: var(--pcs-warn); }
.pcs-root .pcs-banner-error { color: var(--pcs-error); }
.pcs-root .pcs-layout { display: grid; grid-template-columns: minmax(300px, .95fr) minmax(350px, 1.3fr); gap: 14px; align-items: stretch; }
.pcs-root .pcs-dashboard { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pcs-root .pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 11px; background: var(--pcs-bg); overflow: hidden; box-shadow: var(--pcs-shadow); }
.pcs-root .pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-card-kicker { color: var(--pcs-muted); font-size: 9px; line-height: 1.3; font-weight: 650; letter-spacing: .13em; margin-bottom: 3px; }
.pcs-root .pcs-card-head h3 { font-size: 15px; line-height: 1.4; font-weight: 650; }
.pcs-root .pcs-card-body { padding: 14px 16px; }
.pcs-root .pcs-badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--pcs-border); border-radius: 999px; padding: 3px 7px; font-size: 10px; white-space: nowrap; }
.pcs-root .pcs-badge-saved { color: var(--pcs-brand); background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 20%, var(--pcs-border)); }
.pcs-root .pcs-badge-draft { color: var(--pcs-warn); }
.pcs-root .pcs-badge-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.pcs-root .pcs-editor { display: flex; flex-direction: column; }
.pcs-root .pcs-editor > .pcs-card-body { flex: 1; display: flex; align-items: center; }
.pcs-root .pcs-fieldset { width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; }
.pcs-root .pcs-field { min-width: 0; margin-bottom: 18px; }
.pcs-root .pcs-field:last-child { margin-bottom: 0; }
.pcs-root .pcs-field-label { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; color: var(--pcs-fg); font-size: 12px; font-weight: 600; }
.pcs-root .pcs-label-aside { color: var(--pcs-muted); font-size: 10px; font-weight: 400; }
.pcs-root .pcs-control { display: block; width: 100%; min-width: 0; min-height: 36px; padding: 7px 10px; border: 1px solid var(--pcs-border); border-radius: 7px; background: var(--pcs-layer); color: var(--pcs-fg); font-size: 12px; line-height: 1.5; }
.pcs-root .pcs-control:focus { border-color: var(--pcs-brand); }
.pcs-root select.pcs-control { padding-right: 24px; text-overflow: ellipsis; }
.pcs-root .pcs-control:disabled { opacity: .65; }
.pcs-root .pcs-help { margin-top: 6px; color: var(--pcs-muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.pcs-root .pcs-provider-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcs-root .pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.pcs-root .pcs-client { position: relative; display: flex; align-items: center; min-width: 0; min-height: 72px; padding: 12px 9px; border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); cursor: pointer; }
.pcs-root .pcs-client:hover { border-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-client input { position: absolute; top: 8px; right: 7px; width: 10px; height: 10px; margin: 0; accent-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:focus-visible) { outline: 2px solid var(--pcs-brand); outline-offset: 2px; }
.pcs-root .pcs-client:has(input:disabled) { opacity: .6; cursor: default; }
.pcs-root .pcs-client-copy { display: block; min-width: 0; padding-top: 4px; }
.pcs-root .pcs-client-name { display: block; font-size: 11px; line-height: 1.5; font-weight: 650; }
.pcs-root .pcs-client-description { display: block; margin-top: 3px; color: var(--pcs-muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.pcs-root .pcs-inline-controls { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px; }
.pcs-root .pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--pcs-border); background: var(--pcs-layer); }
.pcs-root .pcs-action-note { display: flex; align-items: center; gap: 5px; color: var(--pcs-muted); font-size: 10px; }
.pcs-root .pcs-action-indicator { width: 4px; height: 4px; border-radius: 50%; background: var(--pcs-brand); }
.pcs-root .pcs-action-indicator.is-dirty { background: var(--pcs-warn); }
.pcs-root .pcs-action-buttons { display: flex; align-items: center; gap: 6px; }
.pcs-root .pcs-overview { display: grid; grid-template-columns: 1.35fr 1fr 1fr .8fr; align-items: center; gap: 8px; min-width: 0; padding: 11px 13px; border: 1px solid var(--pcs-border); border-radius: 10px; background: var(--pcs-layer); }
.pcs-root .pcs-overview-status { display: flex; align-items: center; gap: 7px; min-width: 0; }
.pcs-root .pcs-status-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 21px; width: 21px; height: 21px; border-radius: 50%; color: var(--pcs-brand); background: var(--pcs-soft); font-size: 12px; }
.pcs-root .pcs-overview-caption, .pcs-root .pcs-metric > span { display: block; color: var(--pcs-muted); font-size: 10px; white-space: nowrap; }
.pcs-root .pcs-overview-status strong { display: block; color: var(--pcs-brand); font-size: 11px; line-height: 1.7; white-space: nowrap; }
.pcs-root .is-waiting :is(.pcs-status-icon, strong) { color: var(--pcs-warn); }
.pcs-root .pcs-metric { min-width: 0; padding-left: 10px; border-left: 1px solid var(--pcs-border); }
.pcs-root .pcs-metric > strong { display: block; color: var(--pcs-fg); font-size: 16px; line-height: 1.5; font-weight: 600; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-empty { margin-top: 12px; padding: 30px 16px; text-align: center; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 10px; font-size: 12px; }
.pcs-root .pcs-empty strong { display: block; margin-bottom: 7px; color: var(--pcs-fg); font-size: 14px; }
.pcs-root .pcs-muted { color: var(--pcs-muted); }
.pcs-root .pcs-small { font-size: 10px; font-weight: 400; }
.pcs-root .pcs-code { font-family: ui-monospace, Consolas, monospace; }
.pcs-root .pcs-spin { display: inline-block; width: 12px; height: 12px; border: 1.7px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
@container (max-width: 700px) {
  .pcs-root .pcs-layout { grid-template-columns: minmax(0, 1fr); }
  .pcs-root .pcs-editor > .pcs-card-body { display: block; }
}
@container (max-width: 520px) {
  .pcs-root .pcs-notice { display: none; }
  .pcs-root .pcs-hero { align-items: flex-start; }
  .pcs-root .pcs-brand-logo { width: 38px; height: 38px; flex-basis: 38px; }
  .pcs-root .pcs-title { font-size: 19px; }
  .pcs-root .pcs-eyebrow { font-size: 8px; }
  .pcs-root .pcs-subtitle { font-size: 10px; }
  .pcs-root .pcs-header-actions { gap: 0; }
  .pcs-root .pcs-current { gap: 6px; }
  .pcs-root .pcs-current-chip { gap: 3px 7px; }
  .pcs-root .pcs-overview { grid-template-columns: 1.25fr 1fr 1fr .8fr; gap: 5px; padding: 10px; }
  .pcs-root .pcs-overview-status { gap: 4px; }
  .pcs-root .pcs-status-icon { display: none; }
  .pcs-root .pcs-metric { padding-left: 6px; }
  .pcs-root .pcs-overview-caption, .pcs-root .pcs-metric > span { font-size: 9px; }
}
@media (max-width: 900px), (max-height: 760px) { .pcs-root { padding: 14px 18px; } .pcs-root .pcs-hero { margin-bottom: 12px; } }
@media (max-width: 520px) { .pcs-root { padding: 14px 12px; } }
@media (prefers-reduced-motion: reduce) { .pcs-root *, .pcs-root *::before, .pcs-root *::after { animation: none !important; transition: none !important; } }
`;

},
"/types.js": function(require,module,exports) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_PATH = exports.SETTINGS_NS = exports.PLUGIN_VERSION = exports.PLUGIN_NAME = void 0;
exports.PLUGIN_NAME = 'dsh-mimic';
/** Build replaces this marker with package.json version; the test suite asserts they match. */
exports.PLUGIN_VERSION = '0.4.2';
exports.SETTINGS_NS = 'dsh-mimic';
exports.API_PATH = '/dsh-mimic/api';
/** RPC: state {}; save {providerId,rule,revision}; listener {enabled,revision}; logs {}; clear {}. */

}}; const cache={};
function load(id) { if(cache[id])return cache[id].exports; if(!factories[id])return external(id); const module={exports:{}}; cache[id]=module; const local=(name)=>{ if(!name.startsWith("."))return external(name); const parts=id.split("/");parts.pop(); for(const p of name.split("/")){if(p==="..")parts.pop();else if(p!==".")parts.push(p);} return load(parts.join("/")); }; factories[id](local,module,module.exports); return module.exports;}
const entry=load("/client/index.js");return entry.default || entry;
}});
