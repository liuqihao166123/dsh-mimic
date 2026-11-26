import * as React from 'react';
import type { PanelApi } from './model.js';
import type { ClientContext } from './slots.js';
export interface ProviderClientPanelProps {
    api?: PanelApi;
}
export declare function ProviderClientPanel({ api: providedApi }?: ProviderClientPanelProps): React.DetailedReactHTMLElement<{
    className: string;
    'aria-labelledby': string;
    'aria-busy': boolean;
}, HTMLElement>;
export declare const name = "dsh-mimic";
/**
 * Cordis service dependencies of the browser half. `slots` must be declared here: cordis throws
 * `cannot get property "slots" without inject` on an undeclared service read, which leaves the
 * plugin fiber stuck in `loading` and silently drops every slot registration (this is exactly the
 * shape shipped by dshmarket — `const inject = ["slots","locale","theme"]` at client.js:25690).
 */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
declare const _default: {
    name: string;
    inject: string[];
    apply: typeof apply;
};
export default _default;
