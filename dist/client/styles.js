export const PANEL_CSS = String.raw `
.pcs-root {
  --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback)); --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback)); --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback)); --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: #0f8177; --pcs-button-fill: #0d8176; --pcs-warn: #a66a13; --pcs-error: #c04450;
  --pcs-soft: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); --pcs-shadow: 0 3px 16px #173d4909;
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1400px; margin: 0 auto; padding: 20px 24px;
  color: var(--pcs-fg); font: 13px/1.5 Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 3px 16px #00000020; }
}
[data-theme="dark"] .pcs-root, .dark .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 3px 16px #00000020; }
[data-theme="light"] .pcs-root, .light .pcs-root { --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed; --pcs-brand: #0f8177; --pcs-warn: #a66a13; --pcs-error: #c04450; --pcs-shadow: 0 3px 16px #173d4909; }
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .45; }
.pcs-root :is(button, select, input):focus-visible { outline: 2px solid var(--pcs-brand); outline-offset: 2px; }
.pcs-root :is(h2, h3, p) { margin: 0; }
.pcs-root .pcs-hero { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.pcs-root .pcs-brand-lockup { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pcs-root .pcs-brand-logo { display: block; width: 46px; height: 46px; flex: 0 0 46px; }
.pcs-root .pcs-eyebrow { color: var(--pcs-brand); font-size: 9px; font-weight: 700; letter-spacing: .15em; }
.pcs-root .pcs-title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 22px; line-height: 1.35; font-weight: 700; letter-spacing: -.03em; }
.pcs-root .pcs-version { padding: 2px 6px; border: 1px solid var(--pcs-border); border-radius: 5px; color: var(--pcs-muted); font-size: 10px; letter-spacing: 0; font-weight: 500; background: var(--pcs-bg); }
.pcs-root .pcs-subtitle { color: var(--pcs-muted); font-size: 11px; margin-top: 2px; }
.pcs-root .pcs-header-actions { display: flex; align-items: center; gap: 12px; }
.pcs-root .pcs-notice { color: var(--pcs-brand); font-size: 11px; }
.pcs-root .pcs-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 6px 12px; border: 1px solid var(--pcs-border); border-radius: 7px; color: var(--pcs-fg); background: var(--pcs-bg); line-height: 1.5; font-size: 12px; font-weight: 550; white-space: nowrap; transition: border-color .15s, background .15s; }
.pcs-root .pcs-button:hover:not(:disabled) { border-color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-button-primary { color: #fff; background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); min-width: 92px; }
.pcs-root .pcs-button-primary:hover:not(:disabled) { background: #096e65; border-color: #096e65; }
.pcs-root .pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); }
.pcs-root .pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; min-height: 38px; margin-bottom: 14px; padding: 9px 13px; border: 1px solid color-mix(in srgb, var(--pcs-brand) 22%, var(--pcs-border)); border-radius: 9px; background: var(--pcs-soft); }
.pcs-root .pcs-current-heading { display: inline-flex; align-items: center; gap: 7px; color: var(--pcs-brand); font-size: 11px; font-weight: 650; white-space: nowrap; }
.pcs-root .pcs-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--pcs-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-current-chip { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px 10px; min-width: 0; max-width: 100%; padding: 0; border: 0; background: transparent; color: var(--pcs-fg); font-size: 11px; text-align: left; overflow-wrap: anywhere; }
.pcs-root .pcs-current-chip strong { font-size: 12px; }
.pcs-root .pcs-current-chip span { color: var(--pcs-muted); }
.pcs-root .pcs-current-chip:hover strong { color: var(--pcs-brand); }
.pcs-root .pcs-current-idle { border-color: var(--pcs-border); background: var(--pcs-layer); }
.pcs-root .pcs-banner { padding: 8px 12px; border: 1px solid var(--pcs-border); border-radius: 7px; margin-bottom: 12px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-banner-warning { color: var(--pcs-warn); }
.pcs-root .pcs-banner-error { color: var(--pcs-error); }
.pcs-root .pcs-layout { display: grid; grid-template-columns: minmax(300px, .95fr) minmax(350px, 1.3fr); gap: 14px; align-items: stretch; }
.pcs-root .pcs-dashboard { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pcs-root .pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 11px; background: var(--pcs-bg); overflow: hidden; box-shadow: var(--pcs-shadow); }
.pcs-root .pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-card-kicker { color: var(--pcs-muted); font-size: 9px; line-height: 1.3; font-weight: 650; letter-spacing: .13em; margin-bottom: 3px; }
.pcs-root .pcs-card-head h3 { font-size: 15px; line-height: 1.4; font-weight: 650; }
.pcs-root .pcs-card-body { padding: 14px 16px; }
.pcs-root .pcs-badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--pcs-border); border-radius: 999px; padding: 3px 7px; font-size: 10px; white-space: nowrap; }
.pcs-root .pcs-badge-saved { color: var(--pcs-brand); background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 20%, var(--pcs-border)); }
.pcs-root .pcs-badge-draft { color: var(--pcs-warn); }
.pcs-root .pcs-badge-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.pcs-root .pcs-editor { display: flex; flex-direction: column; }
.pcs-root .pcs-editor > .pcs-card-body { flex: 1; display: flex; align-items: center; }
.pcs-root .pcs-fieldset { width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; }
.pcs-root .pcs-field { min-width: 0; margin-bottom: 18px; }
.pcs-root .pcs-field:last-child { margin-bottom: 0; }
.pcs-root .pcs-field-label { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-bottom: 7px; color: var(--pcs-fg); font-size: 12px; font-weight: 600; }
.pcs-root .pcs-label-aside { color: var(--pcs-muted); font-size: 10px; font-weight: 400; }
.pcs-root .pcs-control { display: block; width: 100%; min-width: 0; min-height: 36px; padding: 7px 10px; border: 1px solid var(--pcs-border); border-radius: 7px; background: var(--pcs-layer); color: var(--pcs-fg); font-size: 12px; line-height: 1.5; }
.pcs-root .pcs-control:focus { border-color: var(--pcs-brand); }
.pcs-root select.pcs-control { padding-right: 24px; text-overflow: ellipsis; }
.pcs-root .pcs-control:disabled { opacity: .65; }
.pcs-root .pcs-help { margin-top: 6px; color: var(--pcs-muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.pcs-root .pcs-provider-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcs-root .pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.pcs-root .pcs-client { position: relative; display: flex; align-items: center; min-width: 0; min-height: 72px; padding: 12px 9px; border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); cursor: pointer; }
.pcs-root .pcs-client:hover { border-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-client input { position: absolute; top: 8px; right: 7px; width: 10px; height: 10px; margin: 0; accent-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:focus-visible) { outline: 2px solid var(--pcs-brand); outline-offset: 2px; }
.pcs-root .pcs-client:has(input:disabled) { opacity: .6; cursor: default; }
.pcs-root .pcs-client-copy { display: block; min-width: 0; padding-top: 4px; }
.pcs-root .pcs-client-name { display: block; font-size: 11px; line-height: 1.5; font-weight: 650; }
.pcs-root .pcs-client-description { display: block; margin-top: 3px; color: var(--pcs-muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.pcs-root .pcs-inline-controls { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px; }
.pcs-root .pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--pcs-border); background: var(--pcs-layer); }
.pcs-root .pcs-action-note { display: flex; align-items: center; gap: 5px; color: var(--pcs-muted); font-size: 10px; }
.pcs-root .pcs-action-indicator { width: 4px; height: 4px; border-radius: 50%; background: var(--pcs-brand); }
.pcs-root .pcs-action-indicator.is-dirty { background: var(--pcs-warn); }
.pcs-root .pcs-action-buttons { display: flex; align-items: center; gap: 6px; }
.pcs-root .pcs-overview { display: grid; grid-template-columns: 1.35fr 1fr 1fr .8fr; align-items: center; gap: 8px; min-width: 0; padding: 11px 13px; border: 1px solid var(--pcs-border); border-radius: 10px; background: var(--pcs-layer); }
.pcs-root .pcs-overview-status { display: flex; align-items: center; gap: 7px; min-width: 0; }
.pcs-root .pcs-status-icon { display: flex; align-items: center; justify-content: center; flex: 0 0 21px; width: 21px; height: 21px; border-radius: 50%; color: var(--pcs-brand); background: var(--pcs-soft); font-size: 12px; }
.pcs-root .pcs-overview-caption, .pcs-root .pcs-metric > span { display: block; color: var(--pcs-muted); font-size: 10px; white-space: nowrap; }
.pcs-root .pcs-overview-status strong { display: block; color: var(--pcs-brand); font-size: 11px; line-height: 1.7; white-space: nowrap; }
.pcs-root .is-waiting :is(.pcs-status-icon, strong) { color: var(--pcs-warn); }
.pcs-root .pcs-metric { min-width: 0; padding-left: 10px; border-left: 1px solid var(--pcs-border); }
.pcs-root .pcs-metric > strong { display: block; color: var(--pcs-fg); font-size: 16px; line-height: 1.5; font-weight: 600; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-empty { margin-top: 12px; padding: 30px 16px; text-align: center; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 10px; font-size: 12px; }
.pcs-root .pcs-empty strong { display: block; margin-bottom: 7px; color: var(--pcs-fg); font-size: 14px; }
.pcs-root .pcs-muted { color: var(--pcs-muted); }
.pcs-root .pcs-small { font-size: 10px; font-weight: 400; }
.pcs-root .pcs-code { font-family: ui-monospace, Consolas, monospace; }
.pcs-root .pcs-spin { display: inline-block; width: 12px; height: 12px; border: 1.7px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
@container (max-width: 700px) {
  .pcs-root .pcs-layout { grid-template-columns: minmax(0, 1fr); }
  .pcs-root .pcs-editor > .pcs-card-body { display: block; }
}
@container (max-width: 520px) {
  .pcs-root .pcs-notice { display: none; }
  .pcs-root .pcs-hero { align-items: flex-start; }
  .pcs-root .pcs-brand-logo { width: 38px; height: 38px; flex-basis: 38px; }
  .pcs-root .pcs-title { font-size: 19px; }
  .pcs-root .pcs-eyebrow { font-size: 8px; }
  .pcs-root .pcs-subtitle { font-size: 10px; }
  .pcs-root .pcs-header-actions { gap: 0; }
  .pcs-root .pcs-current { gap: 6px; }
  .pcs-root .pcs-current-chip { gap: 3px 7px; }
  .pcs-root .pcs-overview { grid-template-columns: 1.25fr 1fr 1fr .8fr; gap: 5px; padding: 10px; }
  .pcs-root .pcs-overview-status { gap: 4px; }
  .pcs-root .pcs-status-icon { display: none; }
  .pcs-root .pcs-metric { padding-left: 6px; }
  .pcs-root .pcs-overview-caption, .pcs-root .pcs-metric > span { font-size: 9px; }
}
@media (max-width: 900px), (max-height: 760px) { .pcs-root { padding: 14px 18px; } .pcs-root .pcs-hero { margin-bottom: 12px; } }
@media (max-width: 520px) { .pcs-root { padding: 14px 12px; } }
@media (prefers-reduced-motion: reduce) { .pcs-root *, .pcs-root *::before, .pcs-root *::after { animation: none !important; transition: none !important; } }
`;
//# sourceMappingURL=styles.js.map