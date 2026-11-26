import type { ClientKind } from '../types.js';
export declare function isIdentityHeader(name: string): boolean;
export declare function isPrivateHeader(name: string): boolean;
/** Independent core callers receive the same bounds as the host plus profile semantics. */
export declare function validateProfileOverrides(value: unknown, client: Exclude<ClientKind, 'none'>): void;
/** Extra headers assert canonical values; structured fields own fingerprint changes. */
export declare function assertCanonicalExtraHeaders(canonical: Headers, value: unknown): void;
