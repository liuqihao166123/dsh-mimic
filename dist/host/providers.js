/** DSH 官方供应商（DeepSeek 官方 / 官方账号）使用 `llm-deepseek*` 适配器，不能也不需要伪装，面板里不列。 */
const OFFICIAL_ADAPTER = /^llm-deepseek/;
function at(value, keys) {
    let current = value;
    for (const key of keys) {
        if (!current || typeof current !== 'object' || Array.isArray(current))
            return undefined;
        current = current[key];
    }
    return current;
}
function protocol(value) {
    if (typeof value !== 'string')
        return;
    if (/anthropic|messages/i.test(value))
        return 'anthropic-messages';
    if (/responses/i.test(value))
        return 'openai-responses';
    if (/openai|completions/i.test(value))
        return 'openai-chat-completions';
    return;
}
export async function discoverProviders(llm, settings) {
    const active = llm.listProviders();
    const configurable = llm.listConfigurableProviders?.() ?? [];
    const descriptions = settings.describe({ redactSecrets: true });
    const rows = await Promise.all(active.map(async (provider) => {
        const ref = configurable.find(x => x.provider === provider.id);
        const descriptor = ref?.settingsNs ? descriptions.find(x => x.ns === ref.settingsNs) : undefined;
        const raw = ref?.settingsPath && descriptor ? at(descriptor.value, ref.settingsPath) : undefined;
        const profile = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const nativeBase = typeof profile.baseURL === 'string' ? profile.baseURL : typeof profile.baseUrl === 'string' ? profile.baseUrl : undefined;
        let baseUrl;
        if (nativeBase)
            try {
                const parsed = new URL(nativeBase);
                if (!parsed.username && !parsed.password && ['http:', 'https:'].includes(parsed.protocol))
                    baseUrl = parsed.origin + parsed.pathname;
            }
            catch { /* Keep the actual async provider identity as the routing authority. */ }
        let modelIds = [];
        try {
            modelIds = [...new Set((await llm.listModels(provider.id)).map(x => x.id))];
        }
        catch { /* Catalogue discovery is not a routing restriction. */ }
        return { id: provider.id, label: provider.name || ref?.displayName || provider.id, adapter: ref?.settingsNs ?? 'registered', configured: true, modelIds, ...(baseUrl ? { baseUrl } : {}), ...(protocol(profile.api ?? profile.protocol) ? { protocol: protocol(profile.api ?? profile.protocol) } : {}) };
    }));
    return rows.filter(row => !OFFICIAL_ADAPTER.test(row.adapter)).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}
//# sourceMappingURL=providers.js.map