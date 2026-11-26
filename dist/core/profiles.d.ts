import type { PanelState, ProviderRule } from '../types.js';
import type { ClaudeBillingControls } from './billing.js';
export interface ProfileEvidence {
    kind: 'public-source' | 'reference-specification';
    captureVerified: false;
    description: string;
    sources: readonly string[];
    commit?: string;
    sha256?: string;
}
interface CommonProfile {
    id: string;
    label: string;
    version: string;
    evidence: ProfileEvidence;
    extraHeaders: Readonly<Record<string, string>>;
}
export interface ClaudeProfile extends CommonProfile {
    client: 'claude-code';
    mode: 'source-api-key' | 'compatibility';
    runtimeVersion: string;
    sdkVersion: string;
    beta: readonly string[];
    betaPolicy: 'source-agentic' | 'fixed';
    betaMarkers: {
        cli: string;
        interleaved: string;
        scope: string;
        context1m: string;
    };
    identity: string;
    metadataFormat: 'legacy' | 'json';
    accountPolicy: 'empty-unless-supplied' | 'context-uuid';
    entrypoint: string;
    os: string;
    arch: string;
    maxTokens: number;
    apiVersion: string;
    billing: ClaudeBillingControls;
    cache: {
        type: 'ephemeral';
        ttl?: '1h';
        maxBreakpoints: number;
        placement: 'source-org' | 'compatibility-system';
    };
    headers: {
        app: string;
        sessionRequestIds: boolean;
        timeoutSeconds?: number;
        acceptJson?: boolean;
        dangerouslyAllowBrowser?: boolean;
    };
}
export interface CodexProfile extends CommonProfile {
    client: 'codex';
    originator: string;
    instructions: string;
    os: string;
    osVersion: string;
    arch: string;
    terminal: string;
    betaFeatures: string;
}
export type ClientProfile = ClaudeProfile | CodexProfile;
/** Replays the selected first-party API-key/agentic beta branch; feature-flag betas are not invented. */
export declare function claudeBetas(profile: ClaudeProfile, model: string): string[];
export declare function listProfiles(): PanelState['profiles'];
/** Validate independent callers too; overriding a source profile is an explicit custom specification. */
export declare function resolveProfile(rule: ProviderRule): ClientProfile;
export {};
