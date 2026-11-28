/**
 * Original DSH Mimic artwork. Keep the two SVG strings in sync with assets/logo*.svg.
 * The monochrome URI is intended for a CSS mask whose background is currentColor.
 * An <img> document does not inherit its parent's CSS color.
 */
const COLOR_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="none">
  <title>DSH Mimic</title>
  <rect width="32" height="32" rx="8" fill="#E8F6F3"/>
  <g stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 26V6L16 18L21 12" stroke="#0D9488"/>
    <path d="M21 12L26 6V26" stroke="#17324D"/>
  </g>
</svg>
`;
const MONO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <title>DSH Mimic</title>
  <g stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 26V6L16 18L21 12" stroke="currentColor"/>
    <path d="M21 12L26 6V26" stroke="currentColor"/>
  </g>
</svg>
`;
const svgDataUri = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
/** A self-contained 64px color tile for panel headers and plugin metadata. */
export const LOGO_DATA_URI = svgDataUri(COLOR_LOGO_SVG);
/** An unbacked currentColor mark; use as a CSS mask to inherit the surrounding theme. */
export const MONO_LOGO_DATA_URI = svgDataUri(MONO_LOGO_SVG);
//# sourceMappingURL=brand.js.map