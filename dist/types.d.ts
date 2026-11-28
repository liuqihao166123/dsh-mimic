/** Shared contract. Host owns DSH wiring; core owns deterministic wire transformations. */
export type ClientKind = 'none' | 'claude-code' | 'codex';
export type WireProtocol = 'anthropic-messages' | 'openai-responses' | 'openai-chat-completions';
export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
export type JsonObject = {
    [key: string]: Json;
};
export interface ProfileOverrides {
    version?: string;
    runtimeVersion?: string;
    sdkVersion?: string;
    beta?: string[];
    identity?: string;
    instructions?: string;
    originator?: string;
    metadataFormat?: 'legacy' | 'json';
    accountId?: string;
    deviceId?: string;
    extraHeaders?: Record<string, string>;
}
export interface ProviderRule {
    client: ClientKind;
    profile?: string;
    modelIds?: string[];
    baseUrl?: string;
    overrides?: ProfileOverrides;
    /** Max in-flight generation requests for this supplier; 0 / undefined means unlimited. */
    concurrency?: number;
    /** What to do when the cap is reached: queue and wait (default) or fail the new request at once. */
    concurrencyMode?: 'queue' | 'reject';
}
export interface PluginConfig {
    schemaVersion: 1;
    revision: number;
    providers: Record<string, ProviderRule>;
    listener: {
        enabled: boolean;
        maxEntries: number;
    };
    identity: {
        deviceId: string;
        accountId: string;
    };
}
export interface ProviderInfo {
    id: string;
    label: string;
    adapter: string;
    modelIds: string[];
    baseUrl?: string;
    protocol?: WireProtocol;
    configured: boolean;
}
export interface RequestIdentity {
    providerId: string;
    modelId: string;
    sessionId: string;
    requestId: string;
    url: string;
    protocol: WireProtocol;
    cwd?: string;
}
export interface TransformContext {
    identity: RequestIdentity;
    rule: ProviderRule;
    deviceId: string;
    accountId: string;
}
export interface WireRequest {
    url: string;
    method: string;
    headers: Headers;
    body: JsonObject;
}
export interface TransformResult extends WireRequest {
    changed: boolean;
    originalProtocol: WireProtocol;
    targetProtocol: WireProtocol;
    toolNames: Record<string, string>;
    profile: string;
}
export interface ListenerEntry {
    id: string;
    time: string;
    providerId: string;
    modelId: string;
    client: Exclude<ClientKind, 'none'>;
    profile: string;
    url: string;
    protocol: WireProtocol;
    targetProtocol: WireProtocol;
    headers: Record<string, string>;
    body: JsonObject;
    status?: number;
    error?: string;
}
export interface ConcurrencyStat {
    providerId: string;
    limit: number;
    active: number;
    queued: number;
}
export interface CacheStat {
    providerId: string;
    requests: number;
    promptTokens: number;
    cachedTokens: number;
    hitRate: number;
}
export interface RuntimeState {
    transport: 'active' | 'waiting' | 'unsupported';
    detail: string;
    registrations: number;
    concurrency?: ConcurrencyStat[];
    cache?: CacheStat[];
}
export interface PanelState {
    providers: ProviderInfo[];
    config: PluginConfig;
    runtime: RuntimeState;
    profiles: {
        id: string;
        client: Exclude<ClientKind, 'none'>;
        version: string;
        label: string;
        evidence: string;
    }[];
    entries: ListenerEntry[];
}
export declare const PLUGIN_NAME = "dsh-mimic";
/** Build replaces this marker with package.json version; the test suite asserts they match. */
export declare const PLUGIN_VERSION = "__PLUGIN_VERSION__";
export declare const SETTINGS_NS = "dsh-mimic";
export declare const API_PATH = "/dsh-mimic/api";
/** RPC: state {}; save {providerId,rule,revision}; listener {enabled,revision}; logs {}; clear {}. */
