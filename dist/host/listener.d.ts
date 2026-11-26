import type { JsonObject, ListenerEntry, TransformContext, TransformResult } from '../types.js';
export declare function safeUrl(value: string): string;
export declare function summarizeBody(body: JsonObject): JsonObject;
export declare class RequestListener {
    private entries;
    private enabled;
    private limit;
    configure(options: {
        enabled: boolean;
        maxEntries: number;
    }): void;
    record(result: TransformResult, context: TransformContext): ListenerEntry | undefined;
    list(): ListenerEntry[];
    clear(): void;
}
