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
/** The main slot supplies bounded space; overflow remains available on small screens and large text. */
export declare function ProviderClientPage(props?: ProviderClientPanelProps): React.DetailedReactHTMLElement<{
    className: string;
    role: "region";
    'aria-label': string;
    tabIndex: number;
    style: {
        width: string;
        height: string;
        maxHeight: string;
        minHeight: number;
        minWidth: number;
        flex: string;
        overflowY: "auto";
        overflowX: "hidden";
        overscrollBehavior: "contain";
    };
}, HTMLElement>;
export declare const name = "dsh-mimic";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
declare const _default: {
    name: string;
    inject: string[];
    apply: typeof apply;
};
export default _default;
