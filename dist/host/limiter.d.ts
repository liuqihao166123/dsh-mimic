export declare class ProviderLimiter {
    private readonly gates;
    private gate;
    /** Hands the slot to the oldest waiter instead of dropping the counter, so active never exceeds the cap. */
    private releaser;
    acquire(providerId: string, limit: number): Promise<() => void>;
    /**
     * Wraps an async iterable so that the upstream stream is only opened after a slot is granted, and
     * the slot is returned on completion, error, or early consumer return.
     */
    wrap<T>(providerId: string, limit: number, factory: () => AsyncIterable<T>): AsyncIterable<T>;
    usage(providerId: string): {
        active: number;
        queued: number;
    };
    clear(): void;
}
