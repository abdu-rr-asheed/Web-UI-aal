/**
 * WCAG 2.x contrast computation.
 *
 * Implemented directly from the normative definitions rather than taken from a
 * dependency. Three reasons, in order of importance to this project:
 *
 *   1. It is the measurement the entire AR-07/AR-08 conformance claim rests on.
 *      A dissertation that says "a library computed it" is weaker than one that
 *      shows the formula, cites the definition and unit-tests it against known
 *      reference values.
 *   2. NFR-09 — the library ships zero runtime dependencies; the build tooling
 *      should not casually acquire them either.
 *   3. It is about forty lines.
 *
 * Sources:
 *   Relative luminance — WCAG 2.2, Definitions.
 *   https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 *   Contrast ratio     — WCAG 2.2, Definitions.
 *   https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 *
 * Note on the linearisation threshold: WCAG defines the breakpoint as 0.03928,
 * whereas the sRGB specification uses 0.04045. They differ negligibly, but WCAG
 * is the normative source for a WCAG conformance claim, so 0.03928 is used.
 */

/** WCAG's linearisation breakpoint (NOT the sRGB spec's 0.04045). */
const WCAG_LINEAR_THRESHOLD = 0.03928;

/**
 * Parse a CSS hex colour into 8-bit RGB plus alpha in [0,1].
 * Accepts #rgb, #rgba, #rrggbb, #rrggbbaa.
 */
export function parseHex(input) {
  const raw = String(input).trim();
  const m = /^#([0-9a-f]{3,8})$/i.exec(raw);
  if (!m) throw new Error(`Not a hex colour: "${input}". Tokens must resolve to hex for contrast checking.`);

  let h = m[1];
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) throw new Error(`Malformed hex colour: "${input}"`);

  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

/**
 * Composite a possibly-translucent colour over an opaque backdrop (simple
 * source-over alpha blend). Contrast is only meaningful between the colours a
 * user actually sees, so a translucent token must be flattened before measuring.
 */
export function compositeOver(fg, bg) {
  if (fg.a >= 1) return { ...fg, a: 1 };
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1,
  };
}

/** WCAG relative luminance of an opaque sRGB colour. Returns [0,1]. */
export function relativeLuminance({ r, g, b }) {
  const lin = (channel8bit) => {
    const c = channel8bit / 255;
    return c <= WCAG_LINEAR_THRESHOLD ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * WCAG contrast ratio between two colours: (L1 + 0.05) / (L2 + 0.05), where L1
 * is the lighter. Range [1, 21]. Order-independent by construction.
 *
 * A translucent input is composited over `backdrop` first (default white) —
 * pass the real surface underneath, or the number is fiction.
 */
export function contrastRatio(colourA, colourB, backdrop = '#ffffff') {
  const base = parseHex(backdrop);
  const a = compositeOver(parseHex(colourA), base);
  const b = compositeOver(parseHex(colourB), base);

  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Round DOWN to 2dp for reporting.
 *
 * Deliberate: 4.4999 must never be reported as "4.50 — pass". Conformance
 * rounding always goes against the claim, never toward it.
 */
export function reportRatio(ratio) {
  return Math.floor(ratio * 100) / 100;
}

/** Does `ratio` meet `min`? Compared on the floored value, for the reason above. */
export function meets(ratio, min) {
  return reportRatio(ratio) >= min;
}
