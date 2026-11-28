import type { CacheCounters, CacheDiagnosticsState, CachePrefixChange, CacheReport } from '../types.js';
export declare const COUNTER_KEYS: readonly ["requests", "success", "failed", "cancelled", "incomplete", "coldRequests", "fallbackRequests", "retryRequests", "usageRequests", "cacheReportedRequests", "missingUsageRequests", "unknownCacheRequests", "invalidUsageRequests", "promptTokens", "cachedTokens", "writtenTokens", "uncachedTokens", "knownPromptTokens"];
export declare function validCacheReport(v: unknown): boolean;
export declare function validCacheDiagnostics(v: unknown): boolean;
export declare function projectCounters(v: CacheCounters): CacheCounters;
export declare function projectCacheReport(v: CacheReport): CacheReport;
export declare function projectCacheDiagnostics(v: CacheDiagnosticsState): CacheDiagnosticsState;
export declare function combineCounters(items: CacheCounters[]): CacheCounters;
export declare const PREFIX_CHANGE_LABELS: Record<CachePrefixChange, string>;
