import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, sep } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TOKENS_CSS = join(ROOT, 'libs/tokens/src/styles/tokens.css');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const stylesheets = () =>
  ['libs/components', 'libs/primitives', 'apps/docs/src', 'apps/playground/src']
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => /\.(css|scss)$/.test(f))
    // The generated token file is the definition, not a consumer.
    .filter((f) => !f.includes(join('libs', 'tokens')));

/** Every `--aal-*` custom property the token pipeline actually emits. */
const definedTokens = () => {
  const css = readFileSync(TOKENS_CSS, 'utf8');
  return new Set([...css.matchAll(/^\s*(--aal-[A-Za-z0-9-]+)\s*:/gm)].map((m) => m[1]));
};

/** Every `var(--aal-*)` reference in hand-written stylesheets. */
const referencedTokens = () =>
  stylesheets().flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(/var\(\s*(--aal-[A-Za-z0-9-]+)/g)].map((m) => ({
      token: m[1],
      file: file.slice(ROOT.length + 1).split(sep).join('/'),
      line: text.slice(0, m.index).split('\n').length,
    }));
  });

/**
 * Every design-token reference must resolve to a token the pipeline emits.
 *
 * This exists because of a defect that survived four sprints, three engines of
 * automated auditing and a full contrast gate without anyone noticing.
 *
 * The DTCG source spells the token `font.lineHeight.body`, and the build
 * emitted its key verbatim as `--aal-font-lineHeight-body`. Every stylesheet
 * in the library wrote `--aal-font-lineheight-body`. **CSS custom property
 * names are case-sensitive**, so the two never matched: eleven `line-height`
 * declarations across nine files were invalid and silently dropped by the
 * browser. The 1.5 line height that AR-18 / SC 1.4.12 relies on shipping by
 * default was never applied to a single component.
 *
 * Nothing caught it, and nothing was going to. CSS has no failure mode for an
 * unresolved custom property — the declaration is simply discarded at parse
 * time with no console warning. Stylelint validates syntax, and the syntax was
 * perfectly valid. axe measures the rendered result and had no way to know the
 * result was not the intended one. The contrast validator reads the token JSON,
 * which was correct; the bug was entirely in the join between the tokens and
 * the stylesheets that consume them, which is precisely the seam no existing
 * gate looked at.
 *
 * The build now lower-cases token names, and this test asserts the join holds.
 */
describe('design token references (PRD §10.2)', () => {
  it('the token pipeline emits tokens to check against', () => {
    // A guard on the guard: if the CSS ever moves or the regex stops matching,
    // an empty defined-set would make every assertion below vacuously pass.
    expect(definedTokens().size).toBeGreaterThan(50);
  });

  it('finds stylesheets to check', () => {
    expect(stylesheets().length).toBeGreaterThan(5);
  });

  it('every var(--aal-*) reference resolves to a defined token', () => {
    const defined = definedTokens();
    const unresolved = referencedTokens().filter((r) => !defined.has(r.token));

    expect(
      unresolved.map((r) => `${r.file}:${r.line} references ${r.token}, which no token emits`),
    ).toEqual([]);
  });

  it('token names are lower-case, so a reference cannot miss on case alone', () => {
    // The root cause, asserted directly. Case-sensitivity is the trap; removing
    // upper case from the namespace removes the trap rather than the symptom.
    const camelCased = [...definedTokens()].filter((t) => /[A-Z]/.test(t));
    expect(camelCased).toEqual([]);
  });
});
