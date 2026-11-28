export type ConcurrencyMode = 'queue' | 'reject';
/** Raised when a provider is at its cap and the rule is set to reject instead of queue. */
export declare class ConcurrencyLimitError extends Error {
    readonly code = "CONCURRENCY_LIMIT";
    readonly providerId: string;
    readonly limit: number;
    constructor(providerId: string, limit: number);
}
export declare class ProviderLimiter {
    private readonly gates;
    private gate;
    /** Hands the slot to the oldest waiter instead of dropping the counter, so active never exceeds the cap. */
    private releaser;
    acquire(providerId: string, limit: number, mode?: ConcurrencyMode): Promise<() => void>;
    /**
     * Wraps an async iterable so that the upstream stream is only opened after a slot is granted, and
     * the slot is returned on completion, error, or early consumer return.
     */
    wrap<T>(providerId: string, limit: number, mode: ConcurrencyMode, factory: () => AsyncIterable<T>): AsyncIterable<T>;
    usage(providerId: string): {
        active: number;
        queued: number;
    };
    clear(): void;
}
