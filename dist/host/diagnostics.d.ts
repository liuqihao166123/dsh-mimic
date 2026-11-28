import type { CacheDiagnosticEntry, CacheDiagnosticsState, CacheOutcome, CacheSessionSource, TransformContext, TransformResult } from '../types.js';
interface Options {
    enabled?: boolean;
    maxEntries?: number;
    maxSessions?: number;
    maxMessages?: number;
}
/** Passive, bounded HTTP-attempt diagnostics. No request body or header is changed or retained.
 * The secret is private runtime memory; all exported tags are domain-separated keyed hashes.
 * Fingerprint chars count JSON characters, not tokens or retained prompt text. */
export declare class PrefixDiagnostics {
    #private;
    private enabled;
    private readonly maxEntries;
    private readonly maxSessions;
    private readonly maxMessages;
    private readonly sessions;
    private readonly pending;
    private readonly entryProviders;
    private entries;
    private sequence;
    constructor(options?: Options);
    private digest;
    sessionTag(sessionId: string): string;
    /** Stream JSON into the HMAC; no serialized prompt survives this call.
     * Limits, unsupported values, accessors and cycles produce an incomparable fingerprint. */
    private fingerprint;
    observe(result: TransformResult, context: TransformContext, meta?: {
        sessionSource?: CacheSessionSource;
        purpose?: string;
    }): CacheDiagnosticEntry | undefined;
    complete(id: string, result: {
        outcome: CacheOutcome;
        promptTokens?: number;
        cachedTokens?: number;
        writtenTokens?: number;
        cacheReported?: boolean;
        hitRate?: number | null;
    }): void;
    setEnabled(enabled: boolean): void;
    clear(providerId?: string): void;
    snapshot(): CacheDiagnosticsState;
}
export {};
