import type { ProviderInfo } from '../types.js';
import type { LlmDirectory, SettingsHost } from './contracts.js';
export declare function discoverProviders(llm: LlmDirectory, settings: SettingsHost): Promise<ProviderInfo[]>;
