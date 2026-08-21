import { describe, it, expect, beforeAll } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, rmSync } from 'node:fs';

/**
 * Tests the LINT GATE ITSELF, not the code it lints.
 *
 * Why this exists: the research proposal specified eslint-plugin-jsx-a11y,
 * which parses JSX and therefore reports nothing at all on Angular templates
 * (PRD §19.1). A linter that appears configured but silently checks nothing is
 * worse than no linter — it manufactures false assurance, which is precisely
 * the failure this project criticises in other libraries.
 *
 * So the accessibility rules are proved to FIRE, against fixtures that are
 * deliberately broken. If someone downgrades a rule, renames it, or drops the
 * a11y config, these tests fail rather than the gate going quietly silent.
 *
 * Fixtures live in ./fixtures and are excluded from the normal lint run.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const fixture = (f) => join(HERE, 'fixtures', f);

/** Rule IDs reported for a fixture. */
async function rulesFor(file) {
  const eslint = new ESLint({ cwd: ROOT, ignore: false });
  const [result] = await eslint.lintFiles([file]);
  return (result?.messages ?? []).map((m) => m.ruleId);
}

describe('lint gate — accessibility rules fire (PRD §6.5.1)', () => {
  let rules;
  beforeAll(async () => {
    rules = await rulesFor(fixture('a11y-violations.html'));
  });

  // Each entry: the rule that must fire, and the defect in the fixture.
  const expected = [
    ['@angular-eslint/template/alt-text', 'img with no text alternative'],
    ['@angular-eslint/template/click-events-have-key-events', 'click handler with no keyboard equivalent'],
    ['@angular-eslint/template/interactive-supports-focus', 'interactive element that cannot receive focus'],
    ['@angular-eslint/template/button-has-type', 'button with no explicit type'],
    ['@angular-eslint/template/label-has-associated-control', 'label not associated with a control'],
    ['@angular-eslint/template/no-positive-tabindex', 'positive tabindex breaking focus order'],
    ['@angular-eslint/template/role-has-required-aria', 'role=checkbox without aria-checked'],
    ['@angular-eslint/template/no-distracting-elements', 'marquee element'],
    ['@angular-eslint/template/valid-aria', 'misspelled ARIA attribute'],
  ];

  it.each(expected)('%s fires (%s)', (rule) => {
    expect(rules).toContain(rule);
  });

  it('reports every seeded violation, not just the first', () => {
    expect(rules.length).toBeGreaterThanOrEqual(expected.length);
  });
});

describe('lint gate — layer boundaries are enforced (PRD §7.6, ADR-0011)', () => {
  /**
   * Layer rules are scoped by path (`libs/a11y-core/**`), so a fixture sitting
   * in tools/ would not match them and the test would pass vacuously. These
   * probes are written into the REAL layer directory, linted there, and removed
   * — which is the only way to prove the rule applies where it has to.
   */
  async function probe(layerDir, source) {
    const file = join(ROOT, layerDir, '__gate-probe.ts');
    writeFileSync(file, source);
    try {
      const eslint = new ESLint({ cwd: ROOT, ignore: false });
      const [result] = await eslint.lintFiles([file]);
      return result?.messages ?? [];
    } finally {
      rmSync(file, { force: true });
    }
  }

  it('blocks L2 a11y-core importing from L4 components', async () => {
    const messages = await probe(
      'libs/a11y-core/src/lib',
      "import { X } from '@aal/components';\nexport const bad = X;\n",
    );
    expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });

  it('blocks L3 primitives importing from L4 components', async () => {
    const messages = await probe(
      'libs/primitives/src/lib',
      "import { X } from '@aal/components';\nexport const bad = X;\n",
    );
    expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });

  it('blocks L1 tokens importing Angular', async () => {
    const messages = await probe(
      'libs/tokens/src/lib',
      "import { Injectable } from '@angular/core';\nexport const bad = Injectable;\n",
    );
    expect(messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });

  it('ALLOWS a legal downward import (L3 -> L2)', async () => {
    // A boundary rule that blocks everything is as broken as one that blocks
    // nothing — this asserts the graph permits what it is supposed to permit.
    const messages = await probe(
      'libs/primitives/src/lib',
      "import { X } from '@aal/a11y-core';\nexport const fine = X;\n",
    );
    expect(messages.map((m) => m.ruleId)).not.toContain('no-restricted-imports');
  });

  it('explains the violation by citing the PRD, not just naming the rule', async () => {
    const messages = await probe(
      'libs/a11y-core/src/lib',
      "import { X } from '@aal/components';\nexport const bad = X;\n",
    );
    const msg = messages.find((m) => m.ruleId === 'no-restricted-imports');
    // A boundary error that does not say WHY teaches nobody anything.
    expect(msg.message).toMatch(/PRD §7\.3/);
  });
});

describe('lint gate — component conventions', () => {
  it('enforces the aal selector prefix', async () => {
    const rules = await rulesFor(fixture('a11y-violations.ts'));
    expect(rules).toContain('@angular-eslint/component-selector');
  });

  it('rejects explicit any in library code', async () => {
    const rules = await rulesFor(fixture('a11y-violations.ts'));
    expect(rules).toContain('@typescript-eslint/no-explicit-any');
  });
});

describe('lint gate — the real source tree is clean', () => {
  it('reports no errors across libs/ and apps/', async () => {
    const eslint = new ESLint({ cwd: ROOT, ignore: false });
    const results = await eslint.lintFiles(['libs/**/*.{ts,html}', 'apps/**/*.{ts,html}']);
    const errors = results.flatMap((r) =>
      r.messages
        .filter((m) => m.severity === 2)
        .map((m) => `${r.filePath}:${m.line} ${m.ruleId}: ${m.message}`),
    );
    expect(errors).toEqual([]);
  });
});
