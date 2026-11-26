import z from '@deepseek-ai/schemastery';
import { randomUUID } from 'node:crypto';
import { API_PATH, PLUGIN_NAME, SETTINGS_NS } from './types.js';
import type { RuntimeState } from './types.js';
import { ConfigStore, defaultConfig } from './host/config.js';
import { PanelController, createApiHandler } from './host/api.js';
import type { HostContext, LlmDirectory, SettingsHost, WebServerHost } from './host/contracts.js';
import { RequestListener } from './host/listener.js';
import { installTransport } from './host/transport.js';
export const name = PLUGIN_NAME;
export const inject = ['settings', 'llm', 'webServer'];
export const Config = z.object({ config: z.any().default(defaultConfig()).volatile() });
export interface Options { config?: unknown }
function resolveNamespace(ctx: HostContext): string {
  // Same entry-id seam used by the shipped llm-pi-ai adapter, including generated bundle ids.
  const owner = ctx.fiber as { entry?: { options?: { id?: string } } } | undefined;
  return owner?.entry?.options?.id || SETTINGS_NS;
}
export function apply(ctx: HostContext, options: Options = {}): void {
  ctx.inject(['settings', 'llm', 'webServer'], child => {
    const settings = child.get('settings') as SettingsHost;
    const llm = child.get('llm') as LlmDirectory;
    const webServer = child.get('webServer') as WebServerHost;
    const namespace = resolveNamespace(ctx);
    const store = new ConfigStore(settings, options.config, namespace);
    const listener = new RequestListener(); listener.configure(store.snapshot().listener);
    let transport = 'waiting' as RuntimeState['transport'];
    let detail = '等待请求传输拦截器。';
    let registrations = () => 0;
    const controller = new PanelController(store, llm, settings, listener, () => ({ transport, detail, registrations: registrations() }));
    child.effect(() => settings.configure({ auto: false }, ctx.fiber));
    child.effect(() => webServer.register({ kind: 'exact', path: API_PATH, handler: createApiHandler(controller) }));
    child.effect(() => {
      const lease = installTransport(); transport = 'active'; detail = '已接入 llm/stream；只变换选中供应商的生成请求。'; registrations = () => lease.registrations();
      // { global: true } so the host-context LlmRuntime waterfall reaches this listener; a
      // context-local listener on the injected child never fires for host-emitted streams.
      const stop = child.on('llm/stream', (...args: unknown[]) => {
        const request = args[0] as { provider?: unknown; model?: unknown; sessionId?: unknown };
        const next = args[1] as () => AsyncIterable<unknown>;
        if (typeof next !== 'function') throw new Error('INVALID_LLM_WATERFALL');
        if (!request || typeof request.provider !== 'string') return lease.bypass(next);
        const config = store.peek();
        const rule = config.providers[request.provider];
        // No body/header access, copying, or async-context allocation for unconfigured / None suppliers.
        if (!rule || rule.client === 'none') return lease.bypass(next);
        const modelId = typeof request.model === 'string' ? request.model : '';
        if (rule.modelIds?.length && !rule.modelIds.includes(modelId)) return lease.bypass(next);
        return lease.bind({ identity: { providerId: request.provider, modelId, sessionId: typeof request.sessionId === 'string' ? request.sessionId : randomUUID(), requestId: randomUUID() }, rule: structuredClone(rule), deviceId: config.identity.deviceId, accountId: config.identity.accountId, record: (result, context) => listener.record(result, context), onError: code => { detail = '最近一次请求变换错误：' + code; } }, next);
      }, { global: true });
      const stopSettings = child.on('settings/document-updated', (...args: unknown[]) => {
        if (args[0] !== namespace) return;
        try { listener.configure(store.snapshot().listener); } catch { detail = '插件配置正在重新加载。'; }
      });
      return () => { stopSettings(); stop(); lease.release(); listener.clear(); transport = 'waiting'; };
    });
  });
}
export default { name, inject, Config, apply };
