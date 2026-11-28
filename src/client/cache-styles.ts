export const CACHE_CSS = String.raw`
.pcs-root .pcs-cache-inspector { flex: 1; }
.pcs-root .pcs-cache-filters { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 8px; margin-bottom: 10px; }
.pcs-root .pcs-cache-filters:has(.pcs-cache-session) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pcs-root .pcs-cache-filters > label { display: grid; gap: 5px; min-width: 0; font-size: 11px; font-weight: 600; }
.pcs-root .pcs-cache-filters .pcs-control { text-overflow: ellipsis; font-weight: 400; }
.pcs-root .pcs-cache-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pcs-root .pcs-cache-metric { display: flex; flex-direction: column; justify-content: center; min-width: 0; min-height: 76px; padding: 9px 11px; border: 1px solid var(--pcs-border); background: var(--pcs-layer); border-radius: 8px; }
.pcs-root .pcs-cache-metric-accent { background: var(--pcs-soft); border-color: color-mix(in srgb, var(--pcs-brand) 25%, var(--pcs-border)); }
.pcs-root .pcs-cache-metric > span { color: var(--pcs-muted); font-size: 11px; }
.pcs-root .pcs-cache-metric > strong { margin: 2px 0; font-size: 24px; line-height: 1.25; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -.03em; overflow-wrap: anywhere; }
.pcs-root .pcs-cache-metric-accent > strong { color: var(--pcs-brand); }
.pcs-root .pcs-cache-metric:last-child > strong { font-size: 14px; line-height: 1.6; letter-spacing: -.02em; }
.pcs-root .pcs-cache-metric > small { color: var(--pcs-muted); font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.pcs-root .pcs-cache-explanation { margin-top: 8px; }
.pcs-root .pcs-cache-flags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.pcs-root .pcs-cache-flags > span { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid var(--pcs-border); border-radius: 5px; color: var(--pcs-muted); font-size: 10px; }
.pcs-root .pcs-cache-flags strong { color: var(--pcs-fg); font-weight: 600; font-variant-numeric: tabular-nums; }
@container (max-width: 520px) {
  .pcs-root .pcs-cache-filters, .pcs-root .pcs-cache-filters:has(.pcs-cache-session) { grid-template-columns: minmax(0, 1fr); }
  .pcs-root .pcs-cache-metric { padding: 10px; }
  .pcs-root .pcs-cache-metric:last-child > strong { font-size: 13px; }
}
`;
