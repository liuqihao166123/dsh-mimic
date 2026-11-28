import type { CacheOutcome, ListenerEntry, ProviderRule, RequestIdentity, TransformContext, TransformResult, WireProtocol } from '../types.js';
import { type UsageObservation } from './usage.js';
export interface TransportAttempt {
    complete(observation: UsageObservation, outcome?: CacheOutcome): void;
}
export interface TransportScope {
    identity: Omit<RequestIdentity, 'url' | 'protocol'>;
    rule: ProviderRule;
    deviceId: string;
    accountId: string;
    baseUrl?: string;
    record: (result: TransformResult, context: TransformContext) => ListenerEntry | undefined;
    /** Passive accounting observes the transformed wire request and never changes it. */
    observe?: (result: TransformResult, context: TransformContext) => TransportAttempt;
    onError: (code: string) => void;
}
export declare function detectProtocol(url: string): WireProtocol | undefined;
export interface TransportLease {
    run<T>(scope: TransportScope, fn: () => T): T;
    bind<T>(scope: TransportScope, factory: () => AsyncIterable<T>): AsyncIterable<T>;
    bypass<T>(factory: () => AsyncIterable<T>): AsyncIterable<T>;
    release(): void;
    active(): boolean;
    registrations(): number;
}
export declare function installTransport(): TransportLease;
