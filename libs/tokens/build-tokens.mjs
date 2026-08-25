#!/usr/bin/env node
/**
 * AAL token build (PRD §10).
 *
 * Style Dictionary is used as the DTCG parser and reference resolver — that is
 * the part worth delegating. Emission is done here rather than through SD
 * formats because the output shape is load-bearing for accessibility and needs
 * exact control:
 *
 *   - cascade layers, so Tier 4 invariants outrank consumer overrides (§10.2)
 *   - a three-state theme switch (system / explicit light / explicit dark),
 *     which a flat `css/variables` format cannot express
 *   - a forced-colors block using system colour keywords, not custom
 *     properties, because in forced-colors mode custom colours are discarded
 *     and a token-only theme simply vanishes (AR-19)
 *
 * Outputs to libs/tokens/src/styles (committed, consumed by components) and
 * dist/tokens/json (resolved, consumed by the contrast validator).
 */

import StyleDictionary from 'style-dictionary';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const TOKENS = join(HERE, 'src/tokens');
const STYLES_OUT = join(HERE, 'src/styles');
const JSON_OUT = join(ROOT, 'dist/tokens/json');

const THEMES = ['light', 'dark', 'high-contrast'];
const BASE_THEME = 'light';

/** Groups that are theme-agnostic; emitted once rather than per theme. */
const THEME_AGNOSTIC = ['space', 'radius', 'target', 'focus', 'border', 'motion', 'layout', 'font'];
/** Tier 4 sealed invariants — emitted into @layer aal.invariants with !important (§10.2). */
const SEALED = ['focus', 'target'];

/**
 * Style Dictionary matches `source` entries as globs, and glob syntax treats a
 * backslash as an escape character — so a Windows path from path.join() silently
 * matches nothing and every reference "cannot be found". Always hand SD posix
 * separators.
 */
const glob = (p) => p.replaceAll('\\', '/');

/**
 * Token path -> CSS custom property name.
 *
 * Each segment is kebab-cased. CSS custom property names are CASE-SENSITIVE,
 * so emitting the DTCG key `lineHeight` verbatim produced
 * `--aal-font-lineHeight-body` while every stylesheet in the library wrote
 * `--aal-font-line-height-body`. The names never matched, so every one of those
 * `line-height` declarations was invalid and silently dropped — meaning the
 * 1.5 line height that AR-18 / SC 1.4.12 depends on was never actually
 * applied. Lower-casing here makes the emitted name the one a human would
 * guess, and tools/lint-gate/token-resolution.spec.mjs now fails the build if
 * a stylesheet references a token that does not exist.
 */
const kebab = (segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const cssVar = (path) => `--aal-${path.map(kebab).join('-')}`;

const cssValue = (token) => {
  const v = token.$value ?? token.value;
  if (!Array.isArray(v)) return String(v);
  // Font stacks: quote any family whose name contains whitespace, or the CSS is
  // invalid and the browser silently drops the rest of the stack.
  return v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
};

/**
 * Resolve one theme's tokens through Style Dictionary.
 *
 * SD is used as a resolver only — we read `allTokens` and key by dot path
 * ourselves rather than emitting through a format. The built-in `json/flat`
 * format keys by the platform's *transformed* name (transformGroup 'js' gives
 * `ColorActionBg`), which would couple the contrast contracts to a naming
 * transform. Contracts reference `color.action.bg`, so that is what we produce.
 */
async function resolveTheme(theme) {
  const sd = new StyleDictionary({
    source: [glob(join(TOKENS, 'base/*.json')), glob(join(TOKENS, `theme/${theme}.json`))],
    usesDtcg: true,
    log: { verbosity: 'silent', warnings: 'disabled' },
    platforms: {
      resolve: { transforms: [], buildPath: glob(`${JSON_OUT}/`), files: [] },
    },
  });

  const { allTokens } = await sd.getPlatformTokens('resolve');

  const flat = {};
  for (const t of allTokens) {
    // The primitive palette is an implementation detail of the semantic layer;
    // emitting it would invite components to reference raw colours directly and
    // bypass the contrast contracts entirely (§10.2 Tier 1).
    if (t.path[0] === 'palette') continue;
    flat[t.path.join('.')] = cssValue(t);
  }
  return flat;
}

/** Split a resolved flat token map into theme-agnostic / themed / sealed buckets. */
function bucket(flat) {
  const agnostic = [];
  const themed = [];
  const sealed = [];
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    const group = parts[0];
    const entry = { path: parts, value };
    if (SEALED.includes(group)) sealed.push(entry);
    else if (THEME_AGNOSTIC.includes(group)) agnostic.push(entry);
    else themed.push(entry);
  }
  const byName = (a, b) => cssVar(a.path).localeCompare(cssVar(b.path));
  return { agnostic: agnostic.sort(byName), themed: themed.sort(byName), sealed: sealed.sort(byName) };
}

const decls = (entries, indent, important = false) =>
  entries
    .map((e) => `${indent}${cssVar(e.path)}: ${e.value}${important ? ' !important' : ''};`)
    .join('\n');

function buildCss(resolved) {
  const base = bucket(resolved[BASE_THEME]);
  const others = Object.fromEntries(
    THEMES.filter((t) => t !== BASE_THEME).map((t) => [t, bucket(resolved[t]).themed]),
  );

  // Guard selectors so an explicit choice always beats a system preference,
  // in both directions. A media query alone would let `prefers-color-scheme:
  // dark` override a user who explicitly asked for light.
  const notExplicit = (...except) =>
    except.map((t) => `:not([data-aal-theme="${t}"])`).join('');

  return `/**
 * AAL design tokens — GENERATED, DO NOT EDIT.
 * Source: libs/tokens/src/tokens/**. Rebuild with \`npm run tokens:build\`.
 *
 * Every colour pairing below is verified against libs/tokens/src/tokens/contracts.json
 * by tools/contrast-validator on every build (TR-07). A failing pair fails CI.
 */

@layer aal.tokens, aal.invariants;

@layer aal.tokens {
  /* Theme-agnostic scale. */
  :root {
${decls(base.agnostic, '    ')}
  }

  /* ${BASE_THEME} — the default, and the fallback when nothing else matches. */
  :root {
${decls(base.themed, '    ')}
  }

  /* System preference: dark. Yields to an explicit light/high-contrast choice. */
  @media (prefers-color-scheme: dark) {
    :root${notExplicit('light', 'high-contrast')} {
${decls(others.dark, '      ')}
    }
  }

  /* Explicit choice: dark. */
  :root[data-aal-theme="dark"] {
${decls(others.dark, '    ')}
  }

  /* System preference: more contrast. Yields to an explicit light/dark choice. */
  @media (prefers-contrast: more) {
    :root${notExplicit('light', 'dark')} {
${decls(others['high-contrast'], '      ')}
    }
  }

  /* Explicit choice: high contrast. */
  :root[data-aal-theme="high-contrast"] {
${decls(others['high-contrast'], '    ')}
  }
}

@layer aal.invariants {
  /**
   * Tier 4 SEALED INVARIANTS (PRD §10.2, AR-05, AR-09).
   *
   * !important on a custom-property declaration wins against consumer
   * overrides. This is the mechanism behind the PRD's "no accessibility-critical
   * override" principle: a consumer can retheme every colour in the library and
   * still cannot delete the focus indicator or shrink a target below 24px.
   */
  :root {
${decls(base.sealed, '    ', true)}
  }

  /**
   * Forced-colors (Windows Contrast Themes) — AR-19.
   *
   * Custom colours are discarded by the OS here, so a token-only theme would
   * leave components invisible. System colour keywords are mapped explicitly
   * and borders are forced visible, so shape-only affordances survive.
   */
  @media (forced-colors: active) {
    :root {
      --aal-color-surface-default: Canvas !important;
      --aal-color-surface-raised: Canvas !important;
      --aal-color-surface-sunken: Canvas !important;
      --aal-color-surface-overlay: Canvas !important;
      --aal-color-text-default: CanvasText !important;
      --aal-color-text-muted: CanvasText !important;
      --aal-color-text-placeholder: GrayText !important;
      --aal-color-text-disabled: GrayText !important;
      --aal-color-text-link: LinkText !important;
      --aal-color-text-on-action: ButtonFace !important;
      --aal-color-text-on-danger: ButtonFace !important;
      --aal-color-action-bg: ButtonText !important;
      --aal-color-action-bg-hover: Highlight !important;
      --aal-color-action-bg-active: Highlight !important;
      --aal-color-action-bg-disabled: ButtonFace !important;
      --aal-color-action-border: ButtonText !important;
      --aal-color-border-default: CanvasText !important;
      --aal-color-border-strong: CanvasText !important;
      --aal-color-border-subtle: CanvasText !important;
      --aal-color-field-bg: Field !important;
      --aal-color-field-bg-disabled: Canvas !important;
      --aal-color-field-border: CanvasText !important;
      --aal-color-field-border-hover: Highlight !important;
      --aal-color-field-border-invalid: CanvasText !important;
      --aal-color-selected-bg: Highlight !important;
      --aal-color-selected-text: HighlightText !important;
      --aal-color-danger-text: CanvasText !important;
      --aal-color-success-text: CanvasText !important;
      --aal-color-warning-text: CanvasText !important;
      --aal-color-focus-outer: Highlight !important;
      --aal-color-focus-inner: Canvas !important;
    }
  }

  /**
   * Visually hidden, still in the accessibility tree.
   *
   * Lives here rather than being repeated in each component's stylesheet: it
   * was duplicated five times across text-field, choice and radio-group, and
   * five copies of a load-bearing idiom is five chances for one of them to
   * drift into "display: none" — which would remove the text from the
   * accessibility tree entirely and hide it from exactly the users it is
   * written for.
   *
   * The px values are deliberate and must not become rem: 1px rather than 0
   * because some screen readers skip zero-area elements, and the -1px margin
   * pulls the residual box out of the layout. Neither should scale with the
   * user's font size.
   */
  .aal-visually-hidden {
    position: absolute !important;
    inline-size: 1px !important;
    block-size: 1px !important;
    margin: -1px !important;
    padding: 0 !important;
    overflow: hidden !important;
    clip-path: inset(50%) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  /* AR-20 — honour the user's motion preference globally, not per component. */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --aal-motion-fast: 0ms !important;
      --aal-motion-medium: 0ms !important;
    }
  }
}
`;
}

function buildScss(resolved) {
  const { agnostic, themed, sealed } = bucket(resolved[BASE_THEME]);
  const all = [...agnostic, ...themed, ...sealed];
  return `// AAL design tokens — GENERATED, DO NOT EDIT.
// SCSS authoring aliases. These reference the CSS custom properties rather than
// inlining values, so runtime theme switching keeps working — inlining the hex
// would freeze components to the light theme.

${all.map((e) => `$${e.path.map(kebab).join('-')}: var(${cssVar(e.path)});`).join('\n')}
`;
}

function buildTs(resolved) {
  const { agnostic, themed, sealed } = bucket(resolved[BASE_THEME]);
  const all = [...agnostic, ...themed, ...sealed];
  const entries = all.map((e) => `  '${e.path.join('.')}': '${cssVar(e.path)}',`).join('\n');
  return `/**
 * AAL design tokens — GENERATED, DO NOT EDIT.
 * Rebuild with \`npm run tokens:build\`.
 *
 * Maps token path -> CSS custom property name. Values are intentionally NOT
 * inlined: a component that reads a literal hex has opted out of theming, and
 * therefore out of the high-contrast and forced-colors support that theming
 * carries (AR-19).
 */

export const AAL_TOKENS = {
${entries}
} as const;

export type AalTokenPath = keyof typeof AAL_TOKENS;

/** CSS \`var()\` reference for a token path. Type-safe: a typo will not compile. */
export function token(path: AalTokenPath): string {
  return \`var(\${AAL_TOKENS[path]})\`;
}

/** Themes shipped by AAL. \`forced-colors\` is a media state, not a selectable theme. */
export const AAL_THEMES = ['light', 'dark', 'high-contrast'] as const;
export type AalTheme = (typeof AAL_THEMES)[number];
`;
}

// ---------------------------------------------------------------------------

rmSync(JSON_OUT, { recursive: true, force: true });
mkdirSync(JSON_OUT, { recursive: true });
mkdirSync(STYLES_OUT, { recursive: true });

const resolved = {};
for (const theme of THEMES) {
  resolved[theme] = await resolveTheme(theme);
  // The contrast validator reads these (TR-07); they are the audit evidence
  // that the shipped colours are the colours that were checked.
  writeFileSync(join(JSON_OUT, `${theme}.json`), JSON.stringify(resolved[theme], null, 2) + '\n');
}

writeFileSync(join(STYLES_OUT, 'tokens.css'), buildCss(resolved));
writeFileSync(join(STYLES_OUT, '_tokens.scss'), buildScss(resolved));
writeFileSync(join(HERE, 'src/lib/tokens.generated.ts'), buildTs(resolved));

const count = Object.keys(resolved[BASE_THEME]).length;
console.log(
  `tokens: built ${count} tokens x ${THEMES.length} themes -> src/styles/tokens.css, _tokens.scss, src/lib/tokens.generated.ts`,
);
