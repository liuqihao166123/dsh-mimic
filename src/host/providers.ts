import type { ProviderInfo, WireProtocol } from '../types.js';
import type { LlmDirectory, SettingsHost } from './contracts.js';
/** DSH 官方供应商（DeepSeek 官方 / 官方账号）使用 `llm-deepseek*` 适配器，不能也不需要伪装，面板里不列。 */
const OFFICIAL_ADAPTER = /^llm-deepseek/;
function at(value: unknown, keys: readonly string[]): unknown {
  let current = value;
  for (const key of keys) { if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined; current = (current as Record<string, unknown>)[key]; }
  return current;
}
function protocol(value: unknown): WireProtocol | undefined {
  if (typeof value !== 'string') return;
  if (/anthropic|messages/i.test(value)) return 'anthropic-messages';
  if (/responses/i.test(value)) return 'openai-responses';
  if (/openai|completions/i.test(value)) return 'openai-chat-completions';
  return;
}
export async function discoverProviders(llm: LlmDirectory, settings: SettingsHost): Promise<ProviderInfo[]> {
  const active = llm.listProviders();
  const configurable = llm.listConfigurableProviders?.() ?? [];
  const descriptions = settings.describe({ redactSecrets: true });
  const rows = await Promise.all(active.map(async provider => {
    const ref = configurable.find(x => x.provider === provider.id);
    const descriptor = ref?.settingsNs ? descriptions.find(x => x.ns === ref.settingsNs) : undefined;
    const raw = ref?.settingsPath && descriptor ? at(descriptor.value, ref.settingsPath) : undefined;
    const profile = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const nativeBase = typeof profile.baseURL === 'string' ? profile.baseURL : typeof profile.baseUrl === 'string' ? profile.baseUrl : undefined;
    let baseUrl: string | undefined;
    if (nativeBase) try { const parsed = new URL(nativeBase); if (!parsed.username && !parsed.password && ['http:', 'https:'].includes(parsed.protocol)) baseUrl = parsed.origin + parsed.pathname; } catch { /* Keep the actual async provider identity as the routing authority. */ }
    let modelIds: string[] = [];
    try { modelIds = [...new Set((await llm.listModels(provider.id)).map(x => x.id))]; } catch { /* Catalogue discovery is not a routing restriction. */ }
    return { id: provider.id, label: provider.name || ref?.displayName || provider.id, adapter: ref?.settingsNs ?? 'registered', configured: true, modelIds, ...(baseUrl ? { baseUrl } : {}), ...(protocol(profile.api ?? profile.protocol) ? { protocol: protocol(profile.api ?? profile.protocol) } : {}) } satisfies ProviderInfo;
  }));
  return rows.filter(row => !OFFICIAL_ADAPTER.test(row.adapter)).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
