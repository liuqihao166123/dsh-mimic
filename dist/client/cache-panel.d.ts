import * as React from 'react';
import type { CacheCounters, CacheProviderReport, PanelState } from '../types.js';
export declare function selectCacheCounters(report: CacheProviderReport, view: string, sessionTag: string, model: string): CacheCounters;
export declare function CacheInspector({ state, providerId }: {
    state: Pick<PanelState, 'runtime'>;
    providerId: string;
}): React.DetailedReactHTMLElement<{
    className: string;
    'aria-label': string;
}, HTMLElement>;
