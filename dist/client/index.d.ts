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
/** Cordis browser service dependency. */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
declare const _default: {
    name: string;
    inject: string[];
    apply: typeof apply;
};
export default _default;
