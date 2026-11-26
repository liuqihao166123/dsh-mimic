import type { IncomingMessage, ServerResponse } from 'node:http';
export type Disposer = () => void;
export interface SettingsDescriptor { ns: string; value: unknown; revision: number; }
export interface SettingsHost {
  readonly writable?: boolean;
  describe(options?: { redactSecrets?: boolean }): SettingsDescriptor[];
  configure(options: { auto?: boolean }, owner?: unknown): Disposer;
  replace(ns: string, value: unknown, expectedRevision?: number): Promise<unknown>;
}
export interface LlmDirectory {
  listProviders(): { id: string; name: string }[];
  listConfigurableProviders?(): { provider: string; displayName?: string; settingsNs?: string; settingsPath?: readonly string[]; declared?: boolean; defaultBaseURL?: string; error?: unknown }[];
  listModels(provider: string): Promise<{ id: string; name?: string }[]>;
}
export interface WebServerHost { register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }): Disposer; }
export interface HostContext {
  readonly fiber: unknown;
  get(name: string): unknown;
  inject(dependencies: string[], callback: (ctx: HostContext) => void): unknown;
  effect(callback: () => Disposer | void): unknown;
  on(event: string, callback: (...args: unknown[]) => unknown, options?: { global?: boolean }): Disposer;
}
