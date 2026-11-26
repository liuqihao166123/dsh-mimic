import { PLUGIN_NAME } from '../types.js';
export const PANEL_TITLE = '供应商客户端模拟';
export const SLOT_SERVICE_ID = 'slots';
export const SETTINGS_SLOT_ID = 'settings.section';
export const SIDEBAR_SLOT_ID = 'sidebar.panellist';
export const MAIN_SLOT_ID = 'main';
/** Stable panel identity; the sidebar row `id` and the main-panel `key` must match so a click opens the panel. */
export const PANEL_ID = PLUGIN_NAME;
/**
 * Resolve the slot registry from either accessor spelling used by shipped bundles:
 * the `ctx.slots` property (dshmarket/client.js:25539 `const slots = host.slots`) and the
 * `ctx.get('slots')` service lookup. A bundle can materialize before the shell attaches the
 * registry, in which case both spellings miss and the caller must retry.
 */
function resolveSlots(ctx) {
    const attached = ctx.slots;
    if (attached && typeof attached.inject === 'function' && typeof attached.register === 'function')
        return attached;
    const viaService = ctx.get(SLOT_SERVICE_ID);
    if (viaService && typeof viaService.inject === 'function' && typeof viaService.register === 'function')
        return viaService;
    return undefined;
}
function registerAll(slots, render) {
    slots.inject(SETTINGS_SLOT_ID, () => slots.register({
        name: SETTINGS_SLOT_ID, id: PANEL_ID, order: 40, label: () => PANEL_TITLE,
    }, render.panel));
    slots.inject(MAIN_SLOT_ID, () => slots.register({
        name: MAIN_SLOT_ID, key: PANEL_ID, label: () => PANEL_TITLE,
    }, render.panel));
    slots.inject(SIDEBAR_SLOT_ID, () => slots.register({
        name: SIDEBAR_SLOT_ID, id: PANEL_ID, order: 30, label: () => PANEL_TITLE,
    }, render.icon));
}
/**
 * The left-rail icon row, the main page it opens, and the settings section that all share one
 * panel identity.
 *
 * Ordering is cordis's job, not ours: the plugin declares `inject = ['slots']`, so `ctx.slots` is
 * ready before `apply` runs and an absent registry simply means this shell has no slot service
 * (then we register nothing and stay inert instead of inventing a mount path).
 */
export function registerClientUi(ctx, render) {
    const slots = resolveSlots(ctx);
    if (!slots)
        return;
    registerAll(slots, render);
}
//# sourceMappingURL=slots.js.map