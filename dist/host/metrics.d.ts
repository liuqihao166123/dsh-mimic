import type { CacheCounters, CacheOutcome, CacheReport, CacheSessionSource, CacheStat, WireProtocol } from '../types.js';
import { type UsageObservation, type UsageSample } from './usage.js';
export { extractUsage, type UsageSample } from './usage.js';
export interface CacheRequestMeta {
    providerId: string;
    modelId: string;
    profile: string;
    protocol: WireProtocol;
    sessionTag: string;
    sessionSource: CacheSessionSource;
    operationTag?: string;
    purpose?: string;
}
export interface CacheTicket {
    complete(observation: UsageObservation, outcome?: CacheOutcome): void;
}
export declare const emptyCacheCounters: () => CacheCounters;
/** Bounded, in-memory HTTP-attempt accounting. Unknown cache reporting never becomes a false 0% hit. */
export declare class CacheMetrics {
    private readonly now;
    private readonly providers;
    private startedAt;
    constructor(now?: () => number);
    begin(input: CacheRequestMeta): CacheTicket;
    /** Compatibility helper for deterministic text fixtures, not used by the streaming transport. */
    ingest(providerId: string, text: string, protocol?: WireProtocol): void;
    record(providerId: string, sample: UsageSample | undefined): void;
    report(): CacheReport;
    /** Legacy summary retained so an older client can still display counts during a reload. */
    snapshot(): CacheStat[];
    clear(providerId?: string): void;
}
