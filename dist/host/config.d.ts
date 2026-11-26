import type { PluginConfig, ProviderRule } from '../types.js';
import type { SettingsHost } from './contracts.js';
export declare class RpcError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status?: number);
}
export declare function defaultConfig(): PluginConfig;
export declare function validateRule(value: unknown): ProviderRule;
export declare function normalizeConfig(value: unknown, fallback?: PluginConfig): PluginConfig;
export declare function publicConfig(config: PluginConfig): PluginConfig;
export declare class ConfigStore {
    private readonly settings;
    readonly namespace: string;
    private current;
    private documentRevision;
    private queue;
    constructor(settings: SettingsHost, initial?: unknown, namespace?: string);
    refresh(): PluginConfig;
    snapshot(): PluginConfig;
    peek(): Readonly<PluginConfig>;
    change(revision: unknown, mutate: (config: PluginConfig) => void): Promise<PluginConfig>;
    saveProvider(providerId: string, value: unknown, revision: unknown): Promise<PluginConfig>;
}
