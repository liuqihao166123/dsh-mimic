export const PANEL_CSS = String.raw`.pcs-root {
  --pcs-fg-fallback: #172336; --pcs-muted-fallback: #64748b;
  --pcs-bg-fallback: #ffffff; --pcs-layer-fallback: #f6f8fc; --pcs-border-fallback: #e1e6ee;
  --pcs-fg: var(--dsw-alias-label-primary, var(--pcs-fg-fallback));
  --pcs-muted: var(--dsw-alias-label-secondary, var(--pcs-muted-fallback));
  --pcs-bg: var(--dsw-alias-bg-layer-1, var(--pcs-bg-fallback));
  --pcs-layer: var(--dsw-alias-bg-layer-2, var(--pcs-layer-fallback));
  --pcs-border: var(--dsw-alias-border-l1, var(--pcs-border-fallback));
  --pcs-brand: var(--dsw-alias-brand-primary, #5265de);
  --pcs-success: var(--dsw-alias-state-success-primary, #178654);
  --pcs-warn: var(--dsw-alias-state-warn-primary, #a16207);
  --pcs-error: var(--dsw-alias-state-error-primary, #c43e4a);
  container-type: inline-size; box-sizing: border-box; width: 100%; max-width: 1040px;
  color: var(--pcs-fg); font: inherit; font-size: 13px; line-height: 1.6;
}
@media (prefers-color-scheme: dark) {
  .pcs-root { --pcs-fg-fallback: #e5eaf3; --pcs-muted-fallback: #a1adc0;
    --pcs-bg-fallback: #171d29; --pcs-layer-fallback: #1d2534; --pcs-border-fallback: #343e50; }
}
.pcs-root *, .pcs-root *::before, .pcs-root *::after { box-sizing: border-box; }
.pcs-root button, .pcs-root input, .pcs-root select, .pcs-root textarea { font: inherit; }
.pcs-root button { cursor: pointer; }
.pcs-root button:disabled { cursor: default; opacity: .5; }
.pcs-root button:focus-visible, .pcs-root select:focus-visible, .pcs-root textarea:focus-visible,
.pcs-root input:focus-visible, .pcs-root summary:focus-visible {
  outline: 2px solid var(--pcs-brand); outline-offset: 3px;
}
.pcs-root h2, .pcs-root h3, .pcs-root h4, .pcs-root p { margin: 0; }
.pcs-hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.pcs-eyebrow { display: flex; align-items: center; gap: 7px; color: var(--pcs-brand); font-size: 11px; font-weight: 650; letter-spacing: .04em; margin-bottom: 6px; }
.pcs-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.pcs-root .pcs-title { font-size: 23px; line-height: 1.35; font-weight: 700; letter-spacing: -.035em; }
.pcs-subtitle { max-width: 600px; margin-top: 8px !important; color: var(--pcs-muted); line-height: 1.75; }
.pcs-button { border: 1px solid var(--pcs-border); border-radius: 8px; background: var(--pcs-bg); color: var(--pcs-fg); padding: 7px 12px; line-height: 1.4; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; min-height: 34px; transition: border-color 120ms ease, background 120ms ease; }
.pcs-button:hover:not(:disabled) { border-color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 5%, var(--pcs-bg)); }
.pcs-button-primary { border-color: var(--pcs-brand); background: var(--pcs-brand); color: #fff; font-weight: 650; }
.pcs-button-primary:hover:not(:disabled) { background: color-mix(in srgb, var(--pcs-brand) 90%, #000); }
.pcs-button-quiet { border-color: transparent; background: transparent; color: var(--pcs-muted); }
.pcs-button-danger { color: var(--pcs-error); }
.pcs-refresh { flex-shrink: 0; margin-top: 24px; }
.pcs-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.pcs-stat { min-width: 0; border: 1px solid var(--pcs-border); background: var(--pcs-layer); border-radius: 10px; padding: 11px 13px; }
.pcs-stat-label { color: var(--pcs-muted); font-size: 11px; margin-bottom: 3px; }
.pcs-stat-value { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
.pcs-muted { color: var(--pcs-muted); }
.pcs-small { font-size: 11px; }
.pcs-banner { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 11px 13px; border: 1px solid var(--pcs-border); border-radius: 9px; margin-bottom: 14px; overflow-wrap: anywhere; }
.pcs-banner-warning { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 36%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 6%, var(--pcs-bg)); }
.pcs-banner-error { color: var(--pcs-error); border-color: color-mix(in srgb, var(--pcs-error) 36%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-error) 6%, var(--pcs-bg)); }
.pcs-banner-success { color: var(--pcs-success); border-color: color-mix(in srgb, var(--pcs-success) 32%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, var(--pcs-bg)); }
.pcs-current { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 10px 13px; margin-bottom: 14px; border: 1px solid color-mix(in srgb, var(--pcs-success) 34%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, var(--pcs-bg)); border-radius: 9px; }
.pcs-current-idle { border-color: var(--pcs-border); background: var(--pcs-layer); }
.pcs-current-label { font-size: 11px; font-weight: 650; color: var(--pcs-success); flex-shrink: 0; }
.pcs-current-idle .pcs-current-label { color: var(--pcs-muted); }
.pcs-current-list { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.pcs-current-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; border: 1px solid color-mix(in srgb, var(--pcs-success) 40%, var(--pcs-border)); background: var(--pcs-bg); color: var(--pcs-fg); border-radius: 999px; padding: 3px 11px; font-size: 11px; overflow-wrap: anywhere; }
.pcs-current-chip strong { font-weight: 650; }
.pcs-current-chip span { color: var(--pcs-muted); }
.pcs-current-chip:hover:not(:disabled) { border-color: var(--pcs-success); }
.pcs-current-chip[aria-pressed="true"] { border-color: var(--pcs-success); background: color-mix(in srgb, var(--pcs-success) 9%, var(--pcs-bg)); }
.pcs-current-idle-text { font-size: 11px; color: var(--pcs-muted); }
.pcs-grid { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(220px, 1fr); gap: 16px; align-items: start; }
.pcs-card { min-width: 0; border: 1px solid var(--pcs-border); border-radius: 12px; background: var(--pcs-bg); overflow: hidden; }
.pcs-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px; border-bottom: 1px solid var(--pcs-border); }
.pcs-card-head h3 { font-size: 14px; font-weight: 650; }
.pcs-card-body { padding: 16px; }
.pcs-badge { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 2px 7px; font-size: 10px; line-height: 1.6; border: 1px solid var(--pcs-border); color: var(--pcs-muted); border-radius: 5px; }
.pcs-badge-saved { color: var(--pcs-success); border-color: color-mix(in srgb, var(--pcs-success) 30%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-success) 5%, transparent); }
.pcs-badge-draft { color: var(--pcs-warn); border-color: color-mix(in srgb, var(--pcs-warn) 30%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-warn) 5%, transparent); }
.pcs-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.pcs-field { display: block; margin-bottom: 18px; }
.pcs-field-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 650; margin-bottom: 7px; }
.pcs-field-step { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: var(--pcs-layer); border: 1px solid var(--pcs-border); color: var(--pcs-muted); font-size: 10px; margin-right: 7px; }
.pcs-control { width: 100%; min-width: 0; color: var(--pcs-fg); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; padding: 9px 10px; outline: 0; }
.pcs-control:focus { border-color: var(--pcs-brand); }
.pcs-control:disabled { opacity: .65; }
.pcs-code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size: 11px !important; }
.pcs-textarea { display: block; resize: vertical; line-height: 1.65; min-height: 85px; tab-size: 2; }
.pcs-instructions { min-height: 130px; }
.pcs-help { margin-top: 6px !important; font-size: 11px; color: var(--pcs-muted); line-height: 1.75; overflow-wrap: anywhere; }
.pcs-clients { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pcs-client { position: relative; display: flex; align-items: flex-start; gap: 8px; padding: 11px 9px; min-width: 0; border: 1px solid var(--pcs-border); border-radius: 9px; background: var(--pcs-bg); cursor: pointer; }
.pcs-client:has(input:checked) { border-color: var(--pcs-brand); background: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); }
.pcs-client input { margin: 3px 0 0; accent-color: var(--pcs-brand); width: 13px; height: 13px; flex-shrink: 0; }
.pcs-client-name { display: block; font-size: 12px; font-weight: 650; line-height: 1.6; }
.pcs-client-description { display: block; font-size: 10px; color: var(--pcs-muted); line-height: 1.7; margin-top: 3px; }
.pcs-check { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.pcs-check input { accent-color: var(--pcs-brand); width: 14px; height: 14px; }
.pcs-models { margin-top: 10px; }
.pcs-model-options { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.pcs-model-chip { color: var(--pcs-muted); background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 5px; padding: 3px 7px; overflow-wrap: anywhere; font-size: 10px; max-width: 100%; }
.pcs-model-chip[aria-pressed="true"] { color: var(--pcs-brand); border-color: color-mix(in srgb, var(--pcs-brand) 50%, var(--pcs-border)); background: color-mix(in srgb, var(--pcs-brand) 6%, var(--pcs-bg)); }
.pcs-advanced { border-top: 1px solid var(--pcs-border); padding-top: 12px; margin-top: 14px; }
.pcs-advanced > summary { cursor: pointer; color: var(--pcs-muted); font-size: 12px; font-weight: 600; }
.pcs-advanced[open] > summary { color: var(--pcs-fg); margin-bottom: 12px; }
.pcs-advanced-note { padding: 9px 10px; margin-bottom: 14px !important; background: var(--pcs-layer); border-radius: 7px; font-size: 11px; color: var(--pcs-muted); }
.pcs-effective { margin-top: 12px; border: 1px dashed var(--pcs-border); padding: 10px 11px; border-radius: 8px; }
.pcs-effective-label { font-size: 10px; color: var(--pcs-muted); margin-bottom: 5px; }
.pcs-effective strong { font-size: 12px; font-weight: 600; }
.pcs-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; background: var(--pcs-layer); border-top: 1px solid var(--pcs-border); }
.pcs-action-buttons { display: flex; align-items: center; gap: 7px; }
.pcs-validation { color: var(--pcs-error); font-size: 11px; margin: 10px 0 0 !important; }
.pcs-rules { display: grid; gap: 8px; }
.pcs-rule { display: block; text-align: left; width: 100%; min-width: 0; background: var(--pcs-bg); color: var(--pcs-fg); border: 1px solid var(--pcs-border); border-radius: 9px; padding: 11px 12px; transition: border-color 120ms ease; }
.pcs-rule:hover:not(:disabled), .pcs-rule[aria-pressed="true"] { border-color: var(--pcs-brand); }
.pcs-rule[aria-pressed="true"] { background: color-mix(in srgb, var(--pcs-brand) 4%, var(--pcs-bg)); }
.pcs-rule-name { display: flex; align-items: center; justify-content: space-between; gap: 7px; font-size: 12px; font-weight: 650; margin-bottom: 6px; }
.pcs-rule-title { min-width: 0; overflow-wrap: anywhere; }
.pcs-rule-client { font-size: 11px; font-weight: 600; }
.pcs-rule-meta { margin-top: 4px; color: var(--pcs-muted); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.pcs-listener { margin-top: 16px; }
.pcs-listener-head { align-items: flex-start; flex-wrap: wrap; }
.pcs-listener-head h3 { display: flex; align-items: center; gap: 8px; }
.pcs-switch { border: 1px solid var(--pcs-border); background: var(--pcs-layer); color: var(--pcs-muted); border-radius: 7px; display: inline-flex; align-items: center; gap: 9px; padding: 6px 10px; font-size: 11px; }
.pcs-switch-track { width: 27px; height: 15px; border-radius: 12px; background: var(--pcs-border); padding: 2px; display: inline-flex; }
.pcs-switch-knob { width: 11px; height: 11px; background: var(--pcs-bg); border-radius: 50%; }
.pcs-switch[aria-checked="true"] { color: var(--pcs-success); }
.pcs-switch[aria-checked="true"] .pcs-switch-track { background: var(--pcs-success); justify-content: flex-end; }
.pcs-listener-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 13px; }
.pcs-log-list { display: grid; gap: 8px; }
.pcs-log { min-width: 0; background: var(--pcs-layer); border: 1px solid var(--pcs-border); border-radius: 8px; overflow: hidden; }
.pcs-log > summary { padding: 10px 12px; cursor: pointer; font-size: 11px; overflow-wrap: anywhere; }
.pcs-log-content { border-top: 1px solid var(--pcs-border); padding: 12px; }
.pcs-log-meta { display: flex; gap: 6px 14px; flex-wrap: wrap; color: var(--pcs-muted); font-size: 10px; margin-bottom: 9px; }
.pcs-log-label { font-size: 10px; font-weight: 650; margin-top: 10px; margin-bottom: 5px; }
.pcs-log pre { margin: 0; max-height: 260px; max-width: 100%; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pcs-fg); border: 1px solid var(--pcs-border); background: var(--pcs-bg); padding: 10px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; line-height: 1.7; }
.pcs-empty { text-align: center; padding: 26px 16px; color: var(--pcs-muted); background: var(--pcs-layer); border: 1px dashed var(--pcs-border); border-radius: 9px; }
.pcs-empty strong { display: block; margin-bottom: 5px; color: var(--pcs-fg); font-size: 12px; font-weight: 600; }
.pcs-footer { margin-top: 13px; color: var(--pcs-muted); font-size: 10px; text-align: right; }
.pcs-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pcs-version { font-size: 11px; font-weight: 600; letter-spacing: 0; color: var(--pcs-muted); border: 1px solid var(--pcs-border); border-radius: 999px; padding: 2px 8px; }
.pcs-listener > summary { cursor: pointer; font-size: 12px; font-weight: 650; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
.pcs-listener[open] > summary { border-bottom: 1px solid var(--pcs-border); }
.pcs-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; display: inline-block; animation: pcs-spin .8s linear infinite; }
@keyframes pcs-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .pcs-spin { animation: none; } .pcs-root button { transition: none; } }
@container (max-width: 800px) {
  .pcs-grid { grid-template-columns: minmax(0, 1fr); }
  .pcs-rules { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 520px) {
  .pcs-hero { gap: 10px; flex-wrap: wrap; }
  .pcs-title { font-size: 21px !important; }
  .pcs-refresh { margin-top: 0; }
  .pcs-stats { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .pcs-stat { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 11px; }
  .pcs-stat-label { margin-bottom: 0; }
  .pcs-stat-value { font-size: 12px; }
  .pcs-card-body { padding: 13px; }
  .pcs-card-head { padding: 11px 13px; }
  .pcs-clients, .pcs-rules { grid-template-columns: minmax(0, 1fr); }
  .pcs-client { padding: 8px 10px; }
  .pcs-client-description { margin-top: 0; }
  .pcs-actions { padding: 11px 13px; flex-wrap: wrap; }
  .pcs-action-buttons { width: 100%; justify-content: flex-end; }
  .pcs-banner { flex-wrap: wrap; }
}
`;
