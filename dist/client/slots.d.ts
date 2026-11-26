export declare const PANEL_TITLE = "\u4F9B\u5E94\u5546\u5BA2\u6237\u7AEF\u6A21\u62DF";
export declare const SLOT_SERVICE_ID = "slots";
export declare const SETTINGS_SLOT_ID = "settings.section";
export declare const SIDEBAR_SLOT_ID = "sidebar.panellist";
export declare const MAIN_SLOT_ID = "main";
/** Stable panel identity; the sidebar row `id` and the main-panel `key` must match so a click opens the panel. */
export declare const PANEL_ID = "dsh-mimic";
/**
 * A superset of the fields DSH slot descriptors accept across the slot kinds we use.
 * Verified against the retained, installed plugins:
 *   - sidebar.panellist row: dsh-context/lib/client.js helper `Zd` and dshmarket/client.js:25829-25835
 *     -> { name:'sidebar.panellist', id, order, label, locale } with render (owner) => icon(owner.size)
 *   - main panel: dsh-context helper `Zd` and dshmarket/client.js:25823-25828
 *     -> { name:'main', key, label, locale } with render () => panelElement
 *   - settings.section: dshmarket/client.js:25784-25798
 *     -> { name:'settings.section', id, order, label, locale }
 */
export interface SlotDescriptor {
    name: string;
    id?: string;
    key?: string;
    order?: number;
    label?: () => string;
    locale?: string;
}
export interface SlotsService {
    inject(name: string, callback: () => unknown): unknown;
    register(descriptor: SlotDescriptor, render: (owner?: {
        size?: number;
    }) => unknown): unknown;
}
export interface ClientContext {
    get(name: string): unknown;
    slots?: SlotsService;
}
/** Renderers the panel module supplies; the icon is rendered inside the left-rail row, the panel inside both the settings section and the main area. */
export interface ClientUiRenderers {
    panel: () => unknown;
    icon: (owner?: {
        size?: number;
    }) => unknown;
}
/**
 * The left-rail icon row, the main page it opens, and the settings section that all share one
 * panel identity.
 *
 * Ordering is cordis's job, not ours: the plugin declares `inject = ['slots']`, so `ctx.slots` is
 * ready before `apply` runs and an absent registry simply means this shell has no slot service
 * (then we register nothing and stay inert instead of inventing a mount path).
 */
export declare function registerClientUi(ctx: ClientContext, render: ClientUiRenderers): void;
