import { randomBytes, randomUUID } from 'node:crypto';
import { listProfiles } from '../core/profiles.js';
import { SETTINGS_NS } from '../types.js';
export class RpcError extends Error {
    code;
    status;
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'RpcError';
    }
}
export function defaultConfig() {
    return { schemaVersion: 1, revision: 0, providers: {}, listener: { enabled: false, maxEntries: 50 }, identity: { deviceId: randomBytes(32).toString('hex'), accountId: randomUUID() } };
}
function object(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function text(v, max = 1024) { return typeof v === 'string' && v.length <= max; }
const blocked = new Set(['__proto__', 'constructor', 'prototype']);
const identityHeader = /^(user-agent|originator|anthropic-(version|beta|client)|x-app|x-stainless-[a-z-]+|x-(claude-code-session-id|client-request-id|codex-[a-z-]+)|session_id|openai-client)$/i;
const privateHeader = /(?:^|[-_])(auth(?:orization|entication)?|api[-_]?key|token|credential|secret|password|cookie|account(?:[-_]?id)?|device(?:[-_]?id)?)(?:$|[-_])/i;
export function validateRule(value) {
    if (!object(value) || !['none', 'claude-code', 'codex'].includes(String(value.client)))
        throw new RpcError('INVALID_RULE', '请选择 None、Claude Code 或 Codex。');
    const rule = { client: value.client };
    if (value.profile !== undefined) {
        if (!text(value.profile, 120))
            throw new RpcError('INVALID_PROFILE', '配置档案标识无效。');
        if (rule.client !== 'none' && !listProfiles().some(p => p.id === value.profile && p.client === rule.client))
            throw new RpcError('INVALID_PROFILE', '档案与所选客户端不匹配。');
        rule.profile = value.profile;
    }
    if (value.modelIds !== undefined) {
        if (!Array.isArray(value.modelIds) || value.modelIds.length > 500 || value.modelIds.some(x => !text(x, 512) || !x.length))
            throw new RpcError('INVALID_MODELS', '模型限制应为模型标识数组。');
        rule.modelIds = [...new Set(value.modelIds)];
    }
    if (value.baseUrl !== undefined) {
        if (!text(value.baseUrl, 4096))
            throw new RpcError('INVALID_BASE_URL', '连接地址格式无效。');
        let u;
        try {
            u = new URL(value.baseUrl);
        }
        catch {
            throw new RpcError('INVALID_BASE_URL', '连接地址格式无效。');
        }
        if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
            throw new RpcError('INVALID_BASE_URL', '连接地址应为 HTTP(S) URL。');
        rule.baseUrl = value.baseUrl;
    }
    if (value.overrides !== undefined) {
        if (!object(value.overrides))
            throw new RpcError('INVALID_OVERRIDES', '高级覆盖应为 JSON 对象。');
        const overrides = {};
        const stringKeys = ['version', 'runtimeVersion', 'sdkVersion', 'identity', 'instructions', 'originator', 'accountId', 'deviceId'];
        for (const key of stringKeys)
            if (value.overrides[key] !== undefined) {
                if (!text(value.overrides[key], key === 'instructions' ? 250000 : 4096))
                    throw new RpcError('INVALID_OVERRIDES', '高级覆盖字段格式无效：' + key);
                overrides[key] = value.overrides[key];
            }
        if (value.overrides.metadataFormat !== undefined) {
            if (!['legacy', 'json'].includes(String(value.overrides.metadataFormat)))
                throw new RpcError('INVALID_OVERRIDES', 'metadataFormat 应为 legacy 或 json。');
            overrides.metadataFormat = value.overrides.metadataFormat;
        }
        if (value.overrides.beta !== undefined) {
            const beta = value.overrides.beta;
            if (!Array.isArray(beta) || beta.length > 64 || beta.some(x => !text(x, 200) || /[\r\n]/.test(x)))
                throw new RpcError('INVALID_OVERRIDES', 'beta 应为字符串数组。');
            overrides.beta = beta;
        }
        if (value.overrides.extraHeaders !== undefined) {
            if (!object(value.overrides.extraHeaders) || Object.keys(value.overrides.extraHeaders).length > 64)
                throw new RpcError('INVALID_HEADERS', '客户端身份头格式无效。');
            const headers = {};
            for (const [name, val] of Object.entries(value.overrides.extraHeaders)) {
                if (!identityHeader.test(name) || privateHeader.test(name) || !text(val, 4096) || /[\r\n]/.test(val))
                    throw new RpcError('INVALID_HEADERS', '高级头仅接受客户端身份字段：' + name);
                headers[name] = val;
            }
            overrides.extraHeaders = headers;
        }
        rule.overrides = overrides;
    }
    return rule;
}
export function normalizeConfig(value, fallback = defaultConfig()) {
    if (!object(value))
        return structuredClone(fallback);
    if (value.schemaVersion !== undefined && value.schemaVersion !== 1)
        throw new RpcError('CONFIG_VERSION', '插件配置版本需要迁移。');
    const cfg = structuredClone(fallback);
    cfg.revision = Number.isSafeInteger(value.revision) && Number(value.revision) >= 0 ? Number(value.revision) : 0;
    cfg.providers = {};
    if (object(value.providers))
        for (const [id, rule] of Object.entries(value.providers)) {
            if (blocked.has(id) || !id.length || id.length > 256)
                throw new RpcError('INVALID_PROVIDER', '供应商标识无效。');
            cfg.providers[id] = validateRule(rule);
        }
    let activeProvider;
    for (const [id, rule] of Object.entries(cfg.providers)) {
        if (rule.client === 'none')
            continue;
        if (activeProvider === undefined)
            activeProvider = id;
        else
            cfg.providers[id] = { client: 'none' };
    }
    if (object(value.listener)) {
        cfg.listener.enabled = value.listener.enabled === true;
        const limit = Number(value.listener.maxEntries);
        cfg.listener.maxEntries = Number.isInteger(limit) && limit >= 1 && limit <= 500 ? limit : 50;
    }
    if (object(value.identity)) {
        if (text(value.identity.deviceId, 128) && /^[a-f0-9]{64}$/i.test(value.identity.deviceId))
            cfg.identity.deviceId = value.identity.deviceId;
        if (text(value.identity.accountId, 80) && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.identity.accountId))
            cfg.identity.accountId = value.identity.accountId;
    }
    return cfg;
}
export function publicConfig(config) {
    const copy = structuredClone(config);
    copy.identity = { deviceId: '[redacted]', accountId: '[redacted]' };
    for (const rule of Object.values(copy.providers)) {
        delete rule.baseUrl;
        if (rule.overrides) {
            delete rule.overrides.accountId;
            delete rule.overrides.deviceId;
        }
    }
    return copy;
}
export class ConfigStore {
    settings;
    namespace;
    current;
    documentRevision;
    queue = Promise.resolve();
    constructor(settings, initial, namespace = SETTINGS_NS) {
        this.settings = settings;
        this.namespace = namespace;
        this.current = normalizeConfig(initial);
        this.refresh();
    }
    refresh() {
        const own = this.settings.describe({ redactSecrets: false }).find(d => d.ns === this.namespace);
        this.documentRevision = own?.revision;
        if (own && object(own.value))
            this.current = normalizeConfig(own.value.config, this.current);
        return structuredClone(this.current);
    }
    snapshot() { return this.refresh(); }
    peek() { return this.current; }
    async change(revision, mutate) {
        const prior = this.queue;
        let unlock = () => { };
        this.queue = new Promise(resolve => { unlock = resolve; });
        await prior;
        try {
            const current = this.refresh();
            const observedDocumentRevision = this.documentRevision;
            if (revision !== current.revision)
                throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存；当前草稿仍保留。', 409);
            if (this.settings.writable === false)
                throw new RpcError('READ_ONLY', '当前配置为只读。', 409);
            mutate(current);
            current.revision++;
            const next = normalizeConfig(current, this.current);
            if (observedDocumentRevision === undefined)
                throw new RpcError('SETTINGS_NOT_READY', '插件配置命名空间正在加载，请稍后刷新。', 503);
            let receipt;
            try {
                receipt = await this.settings.replace(this.namespace, { config: next }, observedDocumentRevision);
            }
            catch (error) {
                if (object(error) && (error.name === 'SettingsConflictError' || error.code === 'REVISION_CONFLICT'))
                    throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存；当前草稿仍保留。', 409);
                throw error;
            }
            if (object(receipt) && (receipt.ok === false || ['error', 'rejected', 'conflict'].includes(String(receipt.status))))
                throw new RpcError('REVISION_CONFLICT', '配置已更新，请刷新后保存。', 409);
            this.current = next;
            return structuredClone(next);
        }
        finally {
            unlock();
        }
    }
    saveProvider(providerId, value, revision) {
        if (blocked.has(providerId) || !providerId.length || providerId.length > 256)
            throw new RpcError('INVALID_PROVIDER', '供应商标识无效。');
        const input = validateRule(value);
        return this.change(revision, config => {
            const previous = config.providers[providerId];
            const rule = { ...input };
            // The panel deliberately never returns or posts these private/native-connection fields.
            if (previous?.baseUrl && rule.baseUrl === undefined)
                rule.baseUrl = previous.baseUrl;
            if (previous?.overrides?.accountId || previous?.overrides?.deviceId)
                rule.overrides = { ...rule.overrides, ...(previous.overrides.accountId ? { accountId: previous.overrides.accountId } : {}), ...(previous.overrides.deviceId ? { deviceId: previous.overrides.deviceId } : {}) };
            config.providers[providerId] = rule;
            // Single-simulation invariant: only one supplier may simulate a client at a time.
            // Saving a simulating rule resets every other supplier to plain passthrough.
            if (rule.client !== 'none') {
                for (const id of Object.keys(config.providers)) {
                    if (id !== providerId)
                        config.providers[id] = { client: 'none' };
                }
            }
        });
    }
}
//# sourceMappingURL=config.js.map