import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PanelState, RuntimeState } from '../types.js';
import { ConfigStore } from './config.js';
import type { LlmDirectory, SettingsHost } from './contracts.js';
import { RequestListener } from './listener.js';
export interface RuntimeControls {
    resetCache(providerId?: string): void;
    diagnostics(enabled: boolean): void;
    clearDiagnostics(providerId?: string): void;
}
export declare class PanelController {
    readonly store: ConfigStore;
    readonly llm: LlmDirectory;
    readonly settings: SettingsHost;
    readonly listener: RequestListener;
    readonly runtime: () => RuntimeState;
    readonly controls?: RuntimeControls | undefined;
    constructor(store: ConfigStore, llm: LlmDirectory, settings: SettingsHost, listener: RequestListener, runtime: () => RuntimeState, controls?: RuntimeControls | undefined);
    state(): Promise<PanelState>;
    call(input: unknown): Promise<unknown>;
}
export declare function createApiHandler(controller: PanelController): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
