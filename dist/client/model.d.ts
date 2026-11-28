import type { ClientKind, Json, ListenerEntry, PanelState, ProfileOverrides, ProviderInfo, ProviderRule } from '../types.js';
export type ProfileInfo = PanelState['profiles'][number];
export type PublicPanelState = Omit<PanelState, 'config'> & {
    config: Pick<PanelState['config'], 'schemaVersion' | 'revision' | 'providers' | 'listener'>;
};
export interface RuleDraft {
    client: ClientKind;
    profile: string;
    restrictModels: boolean;
    modelIdsText: string;
    overridesText: string;
    instructionsText: string;
    concurrencyText: string;
}
export interface ProviderDraft {
    form: RuleDraft;
    baseline: RuleDraft;
}
export interface EditorSession {
    snapshot: PublicPanelState | null;
    selectedProviderId: string;
    drafts: Record<string, ProviderDraft>;
    revisionStale: boolean;
}
export type PanelApiRequest = {
    action: 'state';
} | {
    action: 'save';
    providerId: string;
    rule: ProviderRule;
    revision: number;
} | {
    action: 'listener';
    enabled: boolean;
    revision: number;
} | {
    action: 'logs';
} | {
    action: 'clear';
};
export interface PanelApiReply {
    state?: PublicPanelState;
    entries?: ListenerEntry[];
}
export interface PanelApi {
    call(request: PanelApiRequest, signal?: AbortSignal): Promise<PanelApiReply>;
}
export type FetchLike = (path: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
export declare const EDITABLE_OVERRIDE_KEYS: readonly ["version", "runtimeVersion", "sdkVersion", "beta", "identity", "originator", "metadataFormat", "extraHeaders"];
export declare class DraftValidationError extends Error {
    constructor(message: string);
}
export declare class PanelRpcError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(message: string, code?: string, status?: number);
}
export declare function isRevisionConflict(error: unknown): boolean;
/** Display projection only: credentials and persistent account/device identity never enter the editor. */
export declare function visibleOverrides(overrides: ProfileOverrides | undefined): ProfileOverrides;
/** DSH 官方供应商（DeepSeek 官方 / 官方账号）不能也不需要伪装，面板里不列。 */
export declare const OFFICIAL_ADAPTER: RegExp;
export declare function configuredProviders(providers: ProviderInfo[]): ProviderInfo[];
export declare function profilesForClient(profiles: ProfileInfo[], client: ClientKind): ProfileInfo[];
export declare function parseModelIds(text: string): string[];
export declare function ruleToDraft(rule: ProviderRule | undefined, profiles: ProfileInfo[]): RuleDraft;
export declare function setDraftClient(draft: RuleDraft, client: ClientKind, profiles: ProfileInfo[]): RuleDraft;
export declare function isDraftDirty(draft: ProviderDraft): boolean;
export declare function parseOverrides(text: string, instructions: string): ProfileOverrides | undefined;
export declare function parseConcurrency(text: string): number;
export declare function draftToRule(draft: RuleDraft, profiles: ProfileInfo[]): ProviderRule;
export declare function draftProblem(draft: RuleDraft | undefined, profiles: ProfileInfo[]): string;
export declare function emptyEditorSession(): EditorSession;
export declare function projectPanelState(state: PanelState | PublicPanelState): PublicPanelState;
/** Refresh is a rebase, never a draft reset. A successful save resets only its own provider. */
export declare function reconcileState(previous: EditorSession, incoming: PanelState | PublicPanelState, savedProviderId?: string): EditorSession;
/** Providers that currently have a non-None rule, i.e. the clients being simulated right now. */
export declare function simulatingRules(snapshot: PublicPanelState, providers: ProviderInfo[]): {
    provider: ProviderInfo;
    rule: ProviderRule;
}[];
export declare function selectProvider(session: EditorSession, providerId: string): EditorSession;
export declare function updateDraft(session: EditorSession, providerId: string, patch: Partial<RuleDraft>): EditorSession;
export declare function restoreSelectedDraft(session: EditorSession): EditorSession;
export declare function markRevisionConflict(session: EditorSession): EditorSession;
export declare function buildSaveRequest(session: EditorSession): Extract<PanelApiRequest, {
    action: 'save';
}>;
export declare function redactText(text: string): string;
export declare function redactUrl(url: string): string;
export declare function redactValue(value: unknown, key?: string, depth?: number, privateContent?: boolean): Json;
export declare function redactListenerEntry(entry: ListenerEntry): ListenerEntry;
export declare function createPanelApi(fetcher?: FetchLike): PanelApi;
