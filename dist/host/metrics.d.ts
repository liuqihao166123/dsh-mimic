import type { CacheStat } from '../types.js';
/** One upstream usage snapshot, normalized across the Anthropic and OpenAI families. */
export interface UsageSample {
    prompt: number;
    cached: number;
    written: number;
}
/**
 * Collects every `"usage": {...}` object in a response body with a bounded brace scan, so both
 * SSE frames and plain JSON replies work without buffering the whole stream into memory twice.
 */
export declare function extractUsage(text: string): UsageSample | undefined;
/** Per-provider cache counters, derived only from upstream usage fields. */
export declare class CacheMetrics {
    private readonly buckets;
    record(providerId: string, sample: UsageSample): void;
    ingest(providerId: string, text: string): void;
    snapshot(): CacheStat[];
    clear(): void;
}
