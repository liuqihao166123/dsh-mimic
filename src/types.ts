/** Shared contract. Host owns DSH wiring; core owns deterministic wire transformations. */
export type ClientKind = 'none' | 'claude-code' | 'codex';
export type WireProtocol = 'anthropic-messages' | 'openai-responses' | 'openai-chat-completions';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export interface ProfileOverrides {
  version?: string; runtimeVersion?: string; sdkVersion?: string; beta?: string[];
  identity?: string; instructions?: string; originator?: string;
  metadataFormat?: 'legacy' | 'json'; accountId?: string; deviceId?: string;
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
  listener: { enabled: boolean; maxEntries: number };
  identity: { deviceId: string; accountId: string };
}
export interface ProviderInfo {
  id: string; label: string; adapter: string; modelIds: string[];
  baseUrl?: string; protocol?: WireProtocol; configured: boolean;
}
export interface RequestIdentity {
  providerId: string; modelId: string; sessionId: string; requestId: string;
  url: string; protocol: WireProtocol; cwd?: string;
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
  id: string; time: string; providerId: string; modelId: string;
  client: Exclude<ClientKind, 'none'>; profile: string;
  url: string; protocol: WireProtocol; targetProtocol: WireProtocol;
  headers: Record<string, string>;
  body: JsonObject; status?: number; error?: string;
}
export interface ConcurrencyStat { providerId: string; limit: number; active: number; queued: number }
export interface CacheStat { providerId: string; requests: number; promptTokens: number; cachedTokens: number; hitRate: number }
export type CacheOutcome = 'success' | 'http-error' | 'stream-error' | 'cancelled' | 'incomplete';
export type CacheSessionSource = 'host' | 'fallback';
/** All counters represent upstream HTTP attempts, not logical user turns. */
export interface CacheCounters {
  requests: number; success: number; failed: number; cancelled: number; incomplete: number;
  coldRequests: number; fallbackRequests: number; retryRequests: number;
  usageRequests: number; cacheReportedRequests: number; missingUsageRequests: number;
  unknownCacheRequests: number; invalidUsageRequests: number;
  promptTokens: number; cachedTokens: number; writtenTokens: number; uncachedTokens: number;
  /** Denominator only for samples that explicitly reported cache-read usage. */
  knownPromptTokens: number; hitRate: number | null; coverage: number;
  since?: string; lastAt?: string;
}
export interface CacheDimensionStat {
  modelId: string; profile: string; protocol: WireProtocol; sessionTag?: string;
  sessionSource?: CacheSessionSource; purpose?: string; counters: CacheCounters; recent: CacheCounters;
}
export interface CacheProviderReport {
  providerId: string; lifetime: CacheCounters; recent: CacheCounters;
  latestSessionTag?: string; sessions: CacheDimensionStat[]; models: CacheDimensionStat[];
}
export interface CacheReport { startedAt: string; windowSize: number; providers: CacheProviderReport[] }
export type CachePrefixChange = 'cold' | 'model' | 'profile' | 'protocol' | 'endpoint' | 'cache-key' | 'system' | 'tools' | 'parameters' | 'history' | 'append' | 'unchanged' | 'unknown';
export interface CacheFingerprint { tag: string; chars: number }
/** Keyed hashes have a random in-memory key per runtime; raw prompts/IDs never enter this contract. */
export interface CacheDiagnosticEntry {
  id: string; time: string; providerId: string; modelId: string; profile: string; protocol: WireProtocol;
  sessionTag: string; sessionSource: CacheSessionSource; purpose?: string; attempt: number;
  cacheKeyTag?: string; change: CachePrefixChange; changed: CachePrefixChange[];
  messages: number; previousMessages: number; sharedMessages: number; firstChangedMessage?: number;
  comparable: boolean; system: CacheFingerprint; tools: CacheFingerprint; parameters: CacheFingerprint;
  outcome?: CacheOutcome; promptTokens?: number; cachedTokens?: number; writtenTokens?: number;
  cacheReported?: boolean; hitRate?: number | null;
}
export interface CacheDiagnosticsState {
  enabled: boolean; maxEntries: number; maxSessions: number; keyScope: 'runtime'; entries: CacheDiagnosticEntry[];
}
export interface RuntimeState {
  transport: 'active' | 'waiting' | 'unsupported';
  detail: string;
  registrations: number;
  concurrency?: ConcurrencyStat[];
  cache?: CacheStat[];
  cacheReport?: CacheReport;
  cacheDiagnostics?: CacheDiagnosticsState;
}
export interface PanelState {
  providers: ProviderInfo[];
  config: PluginConfig;
  runtime: RuntimeState;
  profiles: { id: string; client: Exclude<ClientKind, 'none'>; version: string; label: string; evidence: string }[];
  entries: ListenerEntry[];
}
export const PLUGIN_NAME = 'dsh-mimic';
/** Build replaces this marker with package.json version; the test suite asserts they match. */
export const PLUGIN_VERSION = '__PLUGIN_VERSION__';
export const SETTINGS_NS = 'dsh-mimic';
export const API_PATH = '/dsh-mimic/api';
/** RPC: state {}; save {providerId,rule,revision}; listener {enabled,revision}; logs {}; clear {}. */
