export const PANEL_CSS = String.raw`
.pcs-root {
  --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d;
  --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback));
  --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback));
  --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback));
  --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: #0f8177; --pcs-button-fill: #0d8176; --pcs-warn: #a66a13; --pcs-error: #c04450;
  --pcs-soft: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg));
  --pcs-shadow: 0 4px 20px #173d4910;
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto;
  padding: 30px 28px 22px; color: var(--pcs-fg); font: 13px/1.6 Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 4px 20px #00000020; }
}
[data-theme="dark"] .pcs-root, .dark .pcs-root { --pcs-fg-fallback: #e2ebee; --pcs-muted-fallback: #9baeb7; --pcs-bg-fallback: #18272e; --pcs-layer-fallback: #1d3038; --pcs-border-fallback: #33434b; --pcs-brand: #5dc9ba; --pcs-warn: #e8b35b; --pcs-error: #f28d98; --pcs-shadow: 0 4px 20px #00000020; }
[data-theme="light"] .pcs-root, .light .pcs-root { --pcs-fg-fallback: #162d37; --pcs-muted-fallback: #70838d; --pcs-bg-fallback: #fff; --pcs-layer-fallback: #f5f8f9; --pcs-border-fallback: #e3eaed; --pcs-brand: #0f8177; --pcs-warn: #a66a13; --pcs-error: #c04450; --pcs-shadow: 0 4px 20px #173d4910; }
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select, .pcs-root textarea { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .45; }
.pcs-root :is(button, select, input, summary):focus-visible { outline: 2px solid var(--pcs-brand); outline-offset: 3px; }
.pcs-root :is(.pcs-listener, .pcs-log) > summary:focus-visible { outline-offset: -3px; }
.pcs-root :is(h2, h3, p) { margin: 0; }
.pcs-root .pcs-hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 27px; }
.pcs-root .pcs-brand-lockup { display: flex; align-items: center; gap: 16px; min-width: 0; }
.pcs-root .pcs-brand-logo { display: block; width: 60px; height: 60px; flex: 0 0 60px; filter: drop-shadow(0 5px 9px #0f81771a); }
.pcs-root .pcs-eyebrow { margin-bottom: 5px; color: var(--pcs-brand); font-size: 11px; font-weight: 700; letter-spacing: .17em; line-height: 1.5; }
.pcs-root .pcs-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 24px; line-height: 1.4; font-weight: 700; letter-spacing: -.035em; color: var(--pcs-fg); }
.pcs-root .pcs-version { padding: 2px 7px; border: 1px solid var(--pcs-border); border-radius: 6px; color: var(--pcs-muted); font-size: 11px; letter-spacing: 0; font-weight: 550; line-height: 1.6; background: var(--pcs-bg); }
.pcs-root .pcs-subtitle { margin-top: 6px; color: var(--pcs-muted); font-size: 12px; line-height: 1.7; }
.pcs-root .pcs-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 7px 14px; border: 1px solid var(--pcs-border); border-radius: 8px; color: var(--pcs-fg); background: var(--pcs-bg); line-height: 1.5; font-size: 13px; font-weight: 550; white-space: nowrap; box-shadow: 0 1px 2px #173d4905; transition: border-color .15s, background .15s, box-shadow .15s; }
.pcs-root .pcs-button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--pcs-brand) 65%, var(--pcs-border)); background: var(--pcs-soft); }
.pcs-root .pcs-button-primary { background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); color: #fff; min-width: 104px; box-shadow: 0 3px 7px #0d81761a; }
.pcs-root .pcs-button-primary:hover:not(:disabled) { background: #096e65; border-color: #096e65; box-shadow: 0 4px 10px #0d81762b; }
.pcs-root .pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); box-shadow: none; }
.pcs-root .pcs-button-danger { color: var(--pcs-error); }
.pcs-root .pcs-refresh { flex: 0 0 auto; min-height: 34px; font-size: 12px; padding: 6px 12px; }
.pcs-root .pcs-refresh-icon { display: inline-block; font-size: 19px; line-height: 1; font-family: 'Segoe UI Symbol', sans-serif; }
.pcs-root .pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 22px; padding: 14px 18px; border: 1px solid color-mix(in srgb, var(--pcs-brand) 22%, var(--pcs-border)); border-radius: 11px; background: var(--pcs-soft); }
.pcs-root .pcs-current-heading { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 650; color: var(--pcs-brand); white-space: nowrap; }
.pcs-root .pcs-live-dot { width: 6px; height: 6px; background: var(--pcs-brand); border-radius: 50%; box-shadow: 0 0 0 4px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-current-list { display: flex; flex-wrap: wrap; min-width: 0; gap: 7px; }
.pcs-root .pcs-current-chip { display: inline-flex; align-items: center; flex-wrap: wrap; text-align: left; gap: 4px 11px; max-width: 100%; padding: 0; color: var(--pcs-fg); background: transparent; border: 0; border-radius: 4px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-current-chip strong { font-size: 13px; font-weight: 650; }
.pcs-root .pcs-current-chip span { color: var(--pcs-muted); }
.pcs-root .pcs-current-chip:hover:not(:disabled) strong { color: var(--pcs-brand); }
.pcs-root .pcs-current-idle { background: var(--pcs-layer); border-color: var(--pcs-border); }
.pcs-root .pcs-current-idle :is(.pcs-current-heading, .pcs-current-idle-text) { color: var(--pcs-muted); font-size: 12px; }
.pcs-root .pcs-current-idle .pcs-live-dot { background: var(--pcs-muted); box-shadow: none; }
.pcs-root .pcs-cache { margin: 9px 3px 19px; font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-cache strong { color: var(--pcs-brand); font-weight: 650; margin-left: 3px; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-banner { padding: 10px 13px; border: 1px solid var(--pcs-border); border-radius: 8px; margin-bottom: 16px; font-size: 12px; overflow-wrap: anywhere; }
.pcs-root .pcs-banner-success { color: var(--pcs-brand); border-color: color-mix(in srgb, var(--pcs-brand) 25%, var(--pcs-border)); background: var(--pcs-soft); }
.pcs-root .pcs-banner-warning { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 28%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 5%, var(--pcs-bg)); }
.pcs-root .pcs-banner-error { color: var(--pcs-error); border-color: color-mix(in srgb, var(--pcs-error) 28%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-error) 5%, var(--pcs-bg)); }
.pcs-root .pcs-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 20px; align-items: start; }
.pcs-root .pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 13px; background: var(--pcs-bg); overflow: hidden; box-shadow: var(--pcs-shadow); }
.pcs-root .pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 24px 18px; border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-card-kicker { color: var(--pcs-muted); font-size: 10px; line-height: 1.4; font-weight: 650; letter-spacing: .16em; margin-bottom: 5px; }
.pcs-root :is(.pcs-card-head, .pcs-overview-head) h3 { color: var(--pcs-fg); font-size: 15px; line-height: 1.5; font-weight: 650; letter-spacing: -.01em; }
.pcs-root .pcs-card-body { padding: 22px 24px; }
.pcs-root .pcs-badge { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--pcs-border); border-radius: 999px; padding: 3px 8px; font-size: 11px; line-height: 1.5; white-space: nowrap; }
.pcs-root .pcs-badge-saved { color: var(--pcs-brand); background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 21%, var(--pcs-border)); }
.pcs-root .pcs-badge-draft { color: var(--pcs-warn); background: color-mix(in srgb, var(--pcs-warn) 5%, var(--pcs-bg)); border-color: color-mix(in srgb, var(--pcs-warn) 25%, var(--pcs-border)); }
.pcs-root .pcs-badge-dot { height: 4px; width: 4px; background: currentColor; border-radius: 50%; }
.pcs-root .pcs-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.pcs-root .pcs-field { margin-bottom: 25px; min-width: 0; }
.pcs-root .pcs-field:last-child { margin-bottom: 0; }
.pcs-root .pcs-field-label { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; color: var(--pcs-fg); margin-bottom: 9px; font-size: 13px; font-weight: 600; }
.pcs-root .pcs-label-main { display: inline-flex; align-items: center; gap: 9px; }
.pcs-root .pcs-field-step { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; background: var(--pcs-layer); color: var(--pcs-brand); border: 1px solid var(--pcs-border); font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; }
.pcs-root .pcs-label-aside { color: var(--pcs-muted); font-size: 11px; font-weight: 400; }
.pcs-root .pcs-control { display: block; width: 100%; min-width: 0; min-height: 42px; padding: 9px 12px; background: var(--pcs-layer); color: var(--pcs-fg); border: 1px solid var(--pcs-border); border-radius: 8px; font-size: 13px; line-height: 1.6; outline: 0; transition: border-color .15s, box-shadow .15s; }
.pcs-root .pcs-control:focus { border-color: var(--pcs-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pcs-brand) 8%, transparent); }
.pcs-root select.pcs-control { padding-right: 30px; text-overflow: ellipsis; }
.pcs-root .pcs-control:disabled { opacity: .65; }
.pcs-root .pcs-help { margin-top: 7px; font-size: 11px; color: var(--pcs-muted); line-height: 1.75; overflow-wrap: anywhere; }
.pcs-root .pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
.pcs-root .pcs-client { position: relative; display: block; min-width: 0; padding: 15px 12px 13px; color: var(--pcs-fg); background: var(--pcs-bg); border: 1px solid var(--pcs-border); border-radius: 9px; cursor: pointer; transition: background .15s, border-color .15s, box-shadow .15s; }
.pcs-root .pcs-client:hover { border-color: color-mix(in srgb, var(--pcs-brand) 55%, var(--pcs-border)); }
.pcs-root .pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: var(--pcs-soft); box-shadow: 0 0 0 1px color-mix(in srgb, var(--pcs-brand) 10%, transparent); }
.pcs-root .pcs-client input { position: absolute; top: 13px; right: 11px; width: 12px; height: 12px; margin: 0; accent-color: var(--pcs-brand); }
.pcs-root .pcs-client:has(input:focus-visible) { outline: 2px solid var(--pcs-brand); outline-offset: 3px; }
.pcs-root .pcs-client:has(input:disabled) { cursor: default; opacity: .6; }
.pcs-root .pcs-client-copy { display: block; min-width: 0; }
.pcs-root .pcs-client-topline { display: flex; flex-direction: column; gap: 10px; }
.pcs-root .pcs-client-mark { display: inline-flex; align-items: center; justify-content: center; width: 27px; height: 27px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 7px; font-size: 13px; font-weight: 700; }
.pcs-root .pcs-client:has(input:checked) .pcs-client-mark { background: var(--pcs-button-fill); border-color: var(--pcs-button-fill); color: #fff; }
.pcs-root .pcs-client-name { font-size: 12px; font-weight: 650; }
.pcs-root .pcs-client-description { display: block; margin-top: 4px; color: var(--pcs-muted); font-size: 11px; line-height: 1.7; }
.pcs-root .pcs-inline-controls { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 10px; }
.pcs-root .pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--pcs-border); background: var(--pcs-layer); padding: 15px 24px; }
.pcs-root .pcs-action-note { display: flex; align-items: center; gap: 6px; color: var(--pcs-muted); font-size: 11px; line-height: 1.5; }
.pcs-root .pcs-action-indicator { display: inline-block; flex: 0 0 5px; width: 5px; height: 5px; background: var(--pcs-brand); border-radius: 50%; }
.pcs-root .pcs-action-indicator.is-dirty { background: var(--pcs-warn); }
.pcs-root .pcs-action-buttons { display: flex; align-items: center; gap: 7px; }
.pcs-root .pcs-overview { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 13px; background: var(--pcs-layer); overflow: hidden; }
.pcs-root .pcs-overview-head { padding: 22px 20px 17px; }
.pcs-root .pcs-overview-status { display: flex; align-items: flex-start; gap: 9px; padding: 0 20px 18px; }
.pcs-root .pcs-status-icon { display: inline-flex; flex: 0 0 23px; width: 23px; height: 23px; align-items: center; justify-content: center; margin-top: 2px; border-radius: 50%; color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 10%, var(--pcs-layer)); font-size: 13px; font-weight: 600; }
.pcs-root .pcs-overview-status strong { display: block; font-size: 12px; font-weight: 600; line-height: 1.8; color: var(--pcs-brand); }
.pcs-root .pcs-overview-status div > span { display: block; font-size: 11px; color: var(--pcs-muted); line-height: 1.7; overflow-wrap: anywhere; }
.pcs-root .is-waiting .pcs-status-icon { background: color-mix(in srgb, var(--pcs-warn) 10%, var(--pcs-layer)); color: var(--pcs-warn); }
.pcs-root .is-waiting strong { color: var(--pcs-warn); }
.pcs-root .pcs-metric-grid { display: grid; grid-template-columns: 1fr 1fr; margin: 0 20px; border-top: 1px solid var(--pcs-border); border-bottom: 1px solid var(--pcs-border); padding: 16px 0; gap: 17px 10px; }
.pcs-root .pcs-metric { min-width: 0; }
.pcs-root .pcs-metric > span { display: block; font-size: 11px; color: var(--pcs-muted); margin-bottom: 3px; }
.pcs-root .pcs-metric > strong { display: block; font-size: 20px; line-height: 1.4; letter-spacing: -.04em; font-weight: 600; color: var(--pcs-fg); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.pcs-root .pcs-metric:nth-child(2) > strong { font-size: 17px; line-height: 1.65; letter-spacing: -.02em; }
.pcs-root .pcs-rule-list { padding: 18px 20px 20px; }
.pcs-root .pcs-section-caption { font-size: 10px; color: var(--pcs-muted); font-weight: 650; letter-spacing: .13em; margin-bottom: 10px; }
.pcs-root .pcs-route { display: flex; align-items: center; gap: 9px; padding: 10px; width: 100%; text-align: left; border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); color: var(--pcs-fg); }
.pcs-root .pcs-route + .pcs-route { margin-top: 8px; }
.pcs-root .pcs-route:hover:not(:disabled) { border-color: var(--pcs-brand); }
.pcs-root .pcs-route-mark { display: flex; align-items: center; justify-content: center; flex: 0 0 26px; width: 26px; height: 26px; border-radius: 7px; font-size: 12px; font-weight: 700; color: var(--pcs-brand); background: var(--pcs-soft); }
.pcs-root .pcs-route-copy { display: block; min-width: 0; flex: 1; }
.pcs-root .pcs-route-copy strong { display: block; font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
.pcs-root .pcs-route-copy small { display: block; color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-route-arrow { color: var(--pcs-muted); font-size: 13px; }
.pcs-root .pcs-overview-empty { font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-overview-foot { display: flex; align-items: center; gap: 7px; padding: 13px 20px; border-top: 1px solid var(--pcs-border); font-size: 11px; color: var(--pcs-muted); }
.pcs-root .pcs-overview-foot img { display: block; width: 16px; height: 16px; }
.pcs-root .pcs-listener { margin-top: 20px; box-shadow: none; }
.pcs-root .pcs-listener > summary { display: flex; align-items: center; gap: 9px; list-style: none; padding: 17px 20px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--pcs-fg); }
.pcs-root .pcs-listener > summary::-webkit-details-marker { display: none; }
.pcs-root .pcs-listener > summary::after { content: '⌄'; color: var(--pcs-muted); font-size: 16px; margin-left: 4px; transition: transform .15s; }
.pcs-root .pcs-listener[open] > summary { border-bottom: 1px solid var(--pcs-border); }
.pcs-root .pcs-listener[open] > summary::after { transform: rotate(180deg); }
.pcs-root .pcs-summary-icon { display: flex; align-items: center; justify-content: center; width: 25px; height: 25px; border-radius: 7px; color: var(--pcs-brand); background: var(--pcs-soft); font-size: 20px; font-weight: 400; }
.pcs-root .pcs-summary-count { margin-left: auto; font-size: 11px; font-weight: 500; color: var(--pcs-muted); background: var(--pcs-layer); border-radius: 5px; padding: 2px 7px; }
.pcs-root .pcs-switch { border: 1px solid var(--pcs-border); background: var(--pcs-layer); color: var(--pcs-muted); border-radius: 7px; display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; font-size: 12px; }
.pcs-root .pcs-switch-track { width: 29px; height: 17px; border-radius: 12px; background: var(--pcs-border); padding: 2px; display: inline-flex; }
.pcs-root .pcs-switch-knob { width: 13px; height: 13px; background: var(--pcs-bg); border-radius: 50%; box-shadow: 0 1px 2px #0002; }
.pcs-root .pcs-switch[aria-checked="true"] { color: var(--pcs-brand); }
.pcs-root .pcs-switch[aria-checked="true"] .pcs-switch-track { background: var(--pcs-button-fill); justify-content: flex-end; }
.pcs-root .pcs-listener-toolbar { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.pcs-root .pcs-log-list { display: grid; gap: 9px; }
.pcs-root .pcs-log { min-width: 0; background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; overflow: hidden; }
.pcs-root .pcs-log > summary { padding: 11px 13px; cursor: pointer; font-size: 11px; overflow-wrap: anywhere; }
.pcs-root .pcs-log-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; margin-right: 7px; background: var(--pcs-brand); }
.pcs-root .pcs-log-content { border-top: 1px solid var(--pcs-border); padding: 14px; }
.pcs-root .pcs-log-meta { display: flex; flex-wrap: wrap; gap: 7px 15px; color: var(--pcs-muted); font-size: 11px; margin-bottom: 9px; }
.pcs-root .pcs-log-label { font-size: 11px; font-weight: 600; margin: 12px 0 6px; }
.pcs-root .pcs-log pre { margin: 0; max-height: 260px; max-width: 100%; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pcs-fg); border: 1px solid var(--pcs-border); background: var(--pcs-bg); padding: 11px; border-radius: 7px; font: 10px/1.75 ui-monospace, SFMono-Regular, Consolas, monospace; }
.pcs-root .pcs-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
.pcs-root .pcs-validation { color: var(--pcs-error); font-size: 12px; margin-top: 9px; }
.pcs-root .pcs-empty { text-align: center; padding: 38px 20px; margin-top: 10px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 13px; font-size: 12px; }
.pcs-root .pcs-empty strong { display: block; margin: 12px 0 5px; color: var(--pcs-fg); font-size: 14px; font-weight: 600; }
.pcs-root .pcs-empty-logo img { width: 36px; height: 36px; opacity: .8; }
.pcs-root .pcs-footer { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 17px; padding: 0 2px; color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-muted { color: var(--pcs-muted); }
.pcs-root .pcs-small { font-size: 11px; font-weight: 400; }
.pcs-root .pcs-spin { width: 12px; height: 12px; border: 1.7px solid currentColor; border-right-color: transparent; border-radius: 50%; display: inline-block; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
.pcs-root .pcs-sidebar-logo { display: inline-block; flex: 0 0 auto; background-color: currentColor; -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; vertical-align: middle; }
@container (max-width: 850px) {
  .pcs-root .pcs-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .pcs-root .pcs-overview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .pcs-root .pcs-overview-head { padding-bottom: 10px; }
  .pcs-root .pcs-overview-status { grid-column: 1; padding-top: 0; }
  .pcs-root .pcs-metric-grid { grid-column: 2; grid-row: 1 / span 2; align-content: center; border: 0; border-left: 1px solid var(--pcs-border); padding-left: 20px; margin: 17px 20px 17px 0; }
  .pcs-root .pcs-rule-list { grid-column: 1 / -1; padding: 0 20px 18px; }
  .pcs-root .pcs-overview-foot { grid-column: 1 / -1; }
}
@container (max-width: 520px) {
  .pcs-root .pcs-hero { align-items: flex-start; gap: 10px; margin-bottom: 20px; }
  .pcs-root .pcs-brand-lockup { gap: 10px; align-items: flex-start; }
  .pcs-root .pcs-brand-logo { width: 40px; height: 40px; flex-basis: 40px; }
  .pcs-root .pcs-eyebrow { font-size: 10px; letter-spacing: .1em; margin-bottom: 3px; }
  .pcs-root .pcs-title { font-size: 18px; gap: 6px; }
  .pcs-root .pcs-version { font-size: 10px; padding: 1px 5px; }
  .pcs-root .pcs-subtitle { font-size: 11px; margin-top: 6px; }
  .pcs-root .pcs-refresh { font-size: 11px; padding: 5px 8px; min-height: 30px; }
  .pcs-root .pcs-refresh-icon { font-size: 17px; }
  .pcs-root .pcs-current { padding: 12px 14px; gap: 9px; }
  .pcs-root .pcs-current-chip { gap: 3px 8px; }
  .pcs-root .pcs-current-chip strong { font-size: 13px; }
  .pcs-root .pcs-current-chip span { font-size: 11px; }
  .pcs-root .pcs-card-head { padding: 16px; }
  .pcs-root .pcs-card-body { padding: 18px 16px; }
  .pcs-root .pcs-field { margin-bottom: 22px; }
  .pcs-root .pcs-clients { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .pcs-root .pcs-client { padding: 12px; }
  .pcs-root .pcs-client-topline { flex-direction: row; align-items: center; gap: 9px; padding-right: 15px; }
  .pcs-root .pcs-client-description { margin-left: 36px; margin-top: -3px; font-size: 11px; }
  .pcs-root .pcs-client input { top: 20px; right: 14px; }
  .pcs-root .pcs-client-mark { width: 25px; height: 25px; flex: 0 0 25px; }
  .pcs-root .pcs-inline-controls { grid-template-columns: 88px minmax(0, 1fr); }
  .pcs-root .pcs-actions { padding: 14px 16px; flex-wrap: wrap; gap: 12px; }
  .pcs-root .pcs-action-buttons { margin-left: auto; }
  .pcs-root .pcs-overview { display: block; }
  .pcs-root .pcs-metric-grid { border: 0; border-top: 1px solid var(--pcs-border); border-bottom: 1px solid var(--pcs-border); margin: 0 20px; padding: 16px 0; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .pcs-root .pcs-metric > span { font-size: 10px; }
  .pcs-root .pcs-metric > strong { font-size: 18px; }
  .pcs-root .pcs-metric:nth-child(2) > strong { font-size: 14px; }
  .pcs-root .pcs-rule-list { padding-top: 16px; }
  .pcs-root .pcs-listener > summary { padding: 14px 16px; gap: 7px; font-size: 12px; }
  .pcs-root .pcs-listener > summary .pcs-small { font-size: 11px; }
  .pcs-root .pcs-summary-icon { width: 22px; height: 22px; font-size: 18px; }
  .pcs-root .pcs-listener-toolbar { justify-content: flex-start; }
  .pcs-root .pcs-footer { font-size: 10px; }
}
@media (max-width: 620px) { .pcs-root { padding: 20px 14px 18px; } }
@media (prefers-reduced-motion: reduce) { .pcs-root *, .pcs-root *::before, .pcs-root *::after { animation: none !important; transition: none !important; } }
`;
