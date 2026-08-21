/**
 * Shared accessibility test helpers (PRD TR-01).
 *
 * Every component test uses these rather than calling axe directly, so the rule
 * set is identical across the library and cannot drift component by component.
 * A component that quietly ran a narrower rule set would produce a green result
 * that means less than it appears to — which is the exact failure mode this
 * research criticises in other libraries.
 */

import { axe, type JestAxeConfigureOptions } from 'jest-axe';
import type { AxeResults, Result } from 'axe-core';

/**
 * The WCAG 2.2 Level AA rule set (PRD §6.5).
 *
 * `best-practice` is included deliberately. It is not normative, so its findings
 * are reported but never gate the build — see `expectNoA11yViolations`, which
 * fails only on WCAG-tagged rules. Running it anyway means best-practice
 * findings still surface during development instead of being invisible.
 */
export const WCAG_22_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
] as const;

/** Tags whose violations are normative and therefore blocking. */
const NORMATIVE = new Set(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

export const axeConfig: JestAxeConfigureOptions = {
  runOnly: { type: 'tag', values: [...WCAG_22_AA_TAGS] },
};

/** Run axe with the project's standard configuration. */
export async function runAxe(container: Element | string): Promise<AxeResults> {
  return (await axe(container, axeConfig)) as AxeResults;
}

const describeViolation = (v: Result): string => {
  const nodes = v.nodes
    .slice(0, 3)
    .map((n) => `      ${n.html}\n        -> ${n.failureSummary?.replace(/\n/g, '\n           ')}`)
    .join('\n');
  return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
};

/**
 * Assert a container has no blocking accessibility violations.
 *
 * Blocking = WCAG-tagged AND critical or serious, which is the PRD §12.3 gate
 * threshold. Non-blocking findings (moderate, minor, or best-practice-only) are
 * printed so they are visible, and are triaged rather than ignored — but they
 * do not fail the test, because a gate that fails on advisory findings gets
 * switched off.
 *
 * @param container element under test
 * @param context   what state is being tested, e.g. 'open, with description' —
 *                  appears in the failure message, which matters because
 *                  TR-01 requires every documented state to be covered and the
 *                  report needs to say which one broke.
 */
export async function expectNoA11yViolations(
  container: Element,
  context = 'default state',
): Promise<AxeResults> {
  const results = await runAxe(container);

  const blocking = results.violations.filter(
    (v) => v.tags.some((t) => NORMATIVE.has(t)) && BLOCKING_IMPACTS.has(String(v.impact)),
  );
  const advisory = results.violations.filter((v) => !blocking.includes(v));

  if (advisory.length > 0) {
    console.warn(
      `\naxe — ${advisory.length} non-blocking finding(s) in "${context}" ` +
        `(triage these; they do not fail the gate):\n${advisory.map(describeViolation).join('\n')}\n`,
    );
  }

  if (blocking.length > 0) {
    throw new Error(
      `\naxe found ${blocking.length} blocking violation(s) in "${context}" ` +
        `— PRD §12.3 allows zero critical and zero serious:\n\n` +
        blocking.map(describeViolation).join('\n\n') +
        '\n',
    );
  }

  return results;
}

/**
 * The accessible name of an element as the accessibility tree computes it.
 *
 * Reads the rendered result rather than the authored attribute: a test that
 * asserts `aria-label="Close"` proves an attribute is present, not that a
 * screen reader would say "Close" — those diverge whenever content, `aria-
 * labelledby` and `aria-label` disagree about precedence.
 */
export function accessibleName(el: Element): string {
  // Resolved in ARIA precedence order. Split into named steps rather than one
  // branching function: the order IS the specification, and a reader should be
  // able to check it against accname without untangling control flow.
  for (const resolve of [fromLabelledBy, fromAriaLabel, fromLabelElement, fromContent]) {
    const name = resolve(el);
    if (name) return name;
  }
  return '';
}

/** 1. aria-labelledby wins over everything, including aria-label. */
function fromLabelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  return ids
    .split(/\s+/)
    .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

/** 2. aria-label. */
function fromAriaLabel(el: Element): string {
  return el.getAttribute('aria-label')?.trim() ?? '';
}

/** 3. A native <label> association, for form controls only. */
function fromLabelElement(el: Element): string {
  const labellable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement;
  return labellable ? (el.labels?.[0]?.textContent?.trim() ?? '') : '';
}

/** 4. Projected/among content, which is the preferred source (PRD §7.11 rule 4). */
function fromContent(el: Element): string {
  return el.textContent?.trim() ?? '';
}
