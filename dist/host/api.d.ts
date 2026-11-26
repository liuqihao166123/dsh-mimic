import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PanelState, RuntimeState } from '../types.js';
import { ConfigStore } from './config.js';
import type { LlmDirectory, SettingsHost } from './contracts.js';
import { RequestListener } from './listener.js';
export declare class PanelController {
    readonly store: ConfigStore;
    readonly llm: LlmDirectory;
    readonly settings: SettingsHost;
    readonly listener: RequestListener;
    readonly runtime: () => RuntimeState;
    constructor(store: ConfigStore, llm: LlmDirectory, settings: SettingsHost, listener: RequestListener, runtime: () => RuntimeState);
    state(): Promise<PanelState>;
    call(input: unknown): Promise<unknown>;
}
export declare function createApiHandler(controller: PanelController): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
