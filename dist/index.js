import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { API_PATH, PLUGIN_NAME, SETTINGS_NS } from './types.js';
import { ConfigStore, defaultConfig } from './host/config.js';
import { PanelController, createApiHandler } from './host/api.js';
import { RequestListener } from './host/listener.js';
import { ProviderLimiter } from './host/limiter.js';
import { CacheMetrics } from './host/metrics.js';
import { PrefixDiagnostics } from './host/diagnostics.js';
import { installTransport } from './host/transport.js';
export const name = PLUGIN_NAME;
export const inject = ['settings', 'llm', 'webServer'];
export const Config = z.object({ config: z.any().default(defaultConfig()).volatile() });
function resolveNamespace(ctx) {
    // Same entry-id seam used by the shipped llm-pi-ai adapter, including generated bundle ids.
    const owner = ctx.fiber;
    return owner?.entry?.options?.id || SETTINGS_NS;
}
export function apply(ctx, options = {}) {
    ctx.inject(['settings', 'llm', 'webServer'], child => {
        const settings = child.get('settings');
        const llm = child.get('llm');
        const webServer = child.get('webServer');
        const namespace = resolveNamespace(ctx);
        const store = new ConfigStore(settings, options.config, namespace);
        const listener = new RequestListener();
        listener.configure(store.snapshot().listener);
        const limiter = new ProviderLimiter();
        const metrics = new CacheMetrics();
        const diagnostics = new PrefixDiagnostics();
        let transport = 'waiting';
        let detail = '等待请求传输拦截器。';
        let registrations = () => 0;
        const concurrencyStats = () => Object.entries(store.peek().providers)
            .filter(([, rule]) => (rule.concurrency ?? 0) > 0)
            .map(([providerId, rule]) => {
            const usage = limiter.usage(providerId);
            return { providerId, limit: rule.concurrency ?? 0, active: usage.active, queued: usage.queued };
        });
        const controller = new PanelController(store, llm, settings, listener, () => ({ transport, detail, registrations: registrations(), concurrency: concurrencyStats(), cache: metrics.snapshot(), cacheReport: metrics.report(), cacheDiagnostics: diagnostics.snapshot() }), {
            resetCache: providerId => metrics.clear(providerId),
            diagnostics: enabled => diagnostics.setEnabled(enabled),
            clearDiagnostics: providerId => diagnostics.clear(providerId),
        });
        child.effect(() => settings.configure({ auto: false }, ctx.fiber));
        child.effect(() => webServer.register({ kind: 'exact', path: API_PATH, handler: createApiHandler(controller) }));
        child.effect(() => {
            const lease = installTransport();
            transport = 'active';
            detail = '已接入 llm/stream；只变换选中供应商的生成请求。';
            registrations = () => lease.registrations();
            // { global: true } so the host-context LlmRuntime waterfall reaches this listener; a
            // context-local listener on the injected child never fires for host-emitted streams.
            const stop = child.on('llm/stream', (...args) => {
                const request = args[0];
                const next = args[1];
                if (typeof next !== 'function')
                    throw new Error('INVALID_LLM_WATERFALL');
                if (!request || typeof request.provider !== 'string')
                    return lease.bypass(next);
                const config = store.peek();
                const rule = config.providers[request.provider];
                const limit = rule?.concurrency ?? 0;
                // No body/header access, copying, or async-context allocation for unconfigured / None suppliers.
                if (!rule || (rule.client === 'none' && limit === 0))
                    return lease.bypass(next);
                const modelId = typeof request.model === 'string' ? request.model : '';
                if (rule.modelIds?.length && !rule.modelIds.includes(modelId))
                    return lease.bypass(next);
                const sessionSource = typeof request.sessionId === 'string' ? 'host' : 'fallback';
                const purpose = typeof request.purpose === 'string' ? request.purpose : undefined;
                const factory = () => rule.client === 'none'
                    ? lease.bypass(next)
                    : lease.bind({
                        identity: { providerId: request.provider, modelId, sessionId: typeof request.sessionId === 'string' ? request.sessionId : randomUUID(), requestId: randomUUID() },
                        rule: structuredClone(rule), deviceId: config.identity.deviceId, accountId: config.identity.accountId,
                        record: (result, context) => listener.record(result, context),
                        observe: (result, context) => {
                            const ticket = metrics.begin({ providerId: context.identity.providerId,
                                modelId: typeof result.body.model === 'string' ? result.body.model : context.identity.modelId,
                                profile: result.profile, protocol: result.targetProtocol,
                                sessionTag: diagnostics.sessionTag(context.identity.sessionId), sessionSource,
                                operationTag: diagnostics.sessionTag('operation:' + context.identity.requestId), purpose });
                            let entry;
                            try {
                                entry = diagnostics.observe(result, context, { sessionSource, purpose });
                            }
                            catch {
                                entry = undefined;
                            }
                            return { complete: (observation, outcome) => {
                                    ticket.complete(observation, outcome);
                                    if (entry) {
                                        const sample = observation.sample;
                                        const valid = sample && Number.isSafeInteger(sample.prompt) && sample.prompt >= 0 && Number.isSafeInteger(sample.cached) && sample.cached >= 0
                                            && Number.isSafeInteger(sample.written) && sample.written >= 0 && sample.cached <= sample.prompt && sample.written <= sample.prompt - sample.cached
                                            && !observation.malformed && !observation.limitExceeded;
                                        diagnostics.complete(entry.id, { outcome: outcome ?? (observation.state === 'complete' ? 'success' : observation.state === 'failed' ? 'stream-error' : observation.state),
                                            ...(sample && valid ? { promptTokens: sample.prompt, cachedTokens: sample.cached, writtenTokens: sample.written, cacheReported: sample.cacheReported,
                                                hitRate: sample.cacheReported && sample.prompt > 0 ? sample.cached / sample.prompt : null } : {}) });
                                    }
                                } };
                        },
                        onError: code => { detail = '最近一次请求变换错误：' + code; },
                    }, next);
                // A supplier-level cap queues (or rejects) generation streams instead of letting them burst upstream.
                return limit > 0 ? limiter.wrap(request.provider, limit, rule.concurrencyMode ?? 'queue', factory) : factory();
            }, { global: true });
            const stopSettings = child.on('settings/document-updated', (...args) => {
                if (args[0] !== namespace)
                    return;
                try {
                    listener.configure(store.snapshot().listener);
                }
                catch {
                    detail = '插件配置正在重新加载。';
                }
            });
            return () => { stopSettings(); stop(); lease.release(); limiter.clear(); metrics.clear(); diagnostics.clear(); listener.clear(); transport = 'waiting'; };
        });
    });
}
export default { name, inject, Config, apply };
//# sourceMappingURL=index.js.map