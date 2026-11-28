import type { IncomingMessage, ServerResponse } from 'node:http';
import { listProfiles } from '../core/profiles.js';
import type { PanelState, RuntimeState } from '../types.js';
import { ConfigStore, publicConfig, RpcError } from './config.js';
import type { LlmDirectory, SettingsHost } from './contracts.js';
import { RequestListener } from './listener.js';
import { discoverProviders } from './providers.js';
function isObject(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export interface RuntimeControls {
  resetCache(providerId?: string): void;
  diagnostics(enabled: boolean): void;
  clearDiagnostics(providerId?: string): void;
}
export class PanelController {
  constructor(readonly store: ConfigStore, readonly llm: LlmDirectory, readonly settings: SettingsHost, readonly listener: RequestListener, readonly runtime: () => RuntimeState, readonly controls?: RuntimeControls) {}
  async state(): Promise<PanelState> {
    const config = this.store.snapshot(); this.listener.configure(config.listener);
    return { providers: await discoverProviders(this.llm, this.settings), config: publicConfig(config), runtime: this.runtime(), profiles: listProfiles(), entries: this.listener.list() };
  }
  async call(input: unknown): Promise<unknown> {
    if (!isObject(input)) throw new RpcError('INVALID_REQUEST', '请求应为 JSON 对象。');
    switch (input.action) {
      case 'state': return { ok: true, state: await this.state() };
      case 'save': {
        if (typeof input.providerId !== 'string' || !this.llm.listProviders().some(p => p.id === input.providerId)) throw new RpcError('UNKNOWN_PROVIDER', '供应商已移除或尚未配置，请刷新目录。', 409);
        const config = await this.store.saveProvider(input.providerId, input.rule, input.revision);
        this.listener.configure(config.listener);
        return { ok: true, state: await this.state() };
      }
      case 'listener': {
        if (typeof input.enabled !== 'boolean') throw new RpcError('INVALID_LISTENER', '监听开关应为布尔值。');
        const config = await this.store.change(input.revision, cfg => { cfg.listener.enabled = input.enabled as boolean; });
        this.listener.configure(config.listener);
        return { ok: true, state: await this.state() };
      }
      case 'logs': return { ok: true, entries: this.listener.list() };
      case 'clear': this.listener.clear(); return { ok: true, state: await this.state() };
      case 'cache-reset':
      case 'cache-diagnostics-clear': {
        if (!this.controls) throw new RpcError('DIAGNOSTICS_UNAVAILABLE', '缓存诊断尚未接入，请刷新插件。', 503);
        if (input.providerId !== undefined && (typeof input.providerId !== 'string' || !input.providerId || input.providerId.length > 512)) throw new RpcError('INVALID_PROVIDER', '供应商标识格式有误。');
        if (input.action === 'cache-reset') this.controls.resetCache(input.providerId as string | undefined);
        else this.controls.clearDiagnostics(input.providerId as string | undefined);
        return { ok: true, state: await this.state() };
      }
      case 'cache-diagnostics': {
        if (!this.controls) throw new RpcError('DIAGNOSTICS_UNAVAILABLE', '缓存诊断尚未接入，请刷新插件。', 503);
        if (typeof input.enabled !== 'boolean') throw new RpcError('INVALID_DIAGNOSTICS', '诊断开关应为布尔值。');
        this.controls.diagnostics(input.enabled);
        return { ok: true, state: await this.state() };
      }
      default: throw new RpcError('UNKNOWN_ACTION', '插件接口操作不存在。', 404);
    }
  }
}
function reply(res: ServerResponse, status: number, value: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}
export function createApiHandler(controller: PanelController): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') throw new RpcError('METHOD_NOT_ALLOWED', '此接口使用 POST JSON。', 405);
      const origin = req.headers.origin;
      if (origin) {
        let valid = false;
        try { const u = new URL(origin); valid = ['http:', 'https:'].includes(u.protocol) && u.host === req.headers.host; } catch { /* malformed origin */ }
        if (!valid) throw new RpcError('ORIGIN_MISMATCH', '请求来源与当前 DSH 页面不匹配。', 403);
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new RpcError('ORIGIN_MISMATCH', '请求来源与当前 DSH 页面不匹配。', 403);
      if (String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new RpcError('JSON_REQUIRED', '请发送 application/json。', 415);
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        size += bytes.length;
        if (size > 1024 * 1024) throw new RpcError('REQUEST_TOO_LARGE', '配置请求超过 1 MiB。', 413);
        chunks.push(bytes);
      }
      let data: unknown; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RpcError('INVALID_JSON', 'JSON 格式无效。'); }
      reply(res, 200, await controller.call(data));
    } catch (error) {
      req.resume(); // Drain rejected bodies without retaining them or tearing down the response socket.
      const failure = error instanceof RpcError ? error : new RpcError('HOST_ERROR', '宿主操作未完成，请刷新状态后重试。', 500);
      reply(res, failure.status, { ok: false, code: failure.code, error: failure.message });
    }
  };
}
