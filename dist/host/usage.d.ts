import type { WireProtocol } from '../types.js';
export interface UsageSample {
    prompt: number;
    cached: number;
    written: number;
    cacheReported: boolean;
}
export interface UsageObservation {
    sample?: UsageSample;
    state: 'complete' | 'failed' | 'cancelled' | 'incomplete';
    malformed: boolean;
    limitExceeded: boolean;
}
/** Shared with the response bridge. Counts are snapshots, never token deltas. */
export type NormalizedUsage = {
    input: number;
    output: number;
    cached: number;
    cacheWrite: number;
    reasoning: number;
    anthropicInput?: number;
};
export declare function readUsage(value: unknown, protocol: WireProtocol): Partial<NormalizedUsage>;
export declare function mergeUsage(current: NormalizedUsage, incoming?: Partial<NormalizedUsage>): NormalizedUsage;
export declare class UsageCollector {
    private readonly protocol;
    private readonly decoder;
    private mode;
    private json;
    private sse;
    private merged;
    private state;
    private terminated;
    /** A protocol terminal event may close the bridge before the network reaches EOF. */
    get terminal(): boolean;
    private malformed;
    private limitExceeded;
    private decodeFailed;
    private ended;
    constructor(protocol: WireProtocol, contentType?: string);
    private select;
    private status;
    private absorb;
    private event;
    private text;
    push(chunk: Uint8Array): void;
    private sample;
    finish(): UsageObservation;
}
/** Compatibility helper. Detection examines only an envelope's actual usage fields. */
export declare function extractUsage(text: string, protocol?: WireProtocol): UsageSample | undefined;
