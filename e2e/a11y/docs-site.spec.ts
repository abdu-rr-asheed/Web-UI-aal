import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Page-level accessibility of the documentation site (PRD NFR-13, TR-04, TR-08).
 *
 * The docs app is the Lighthouse audit target and the environment for the
 * November assistive-technology study, so it has to meet the standard it
 * documents. A docs site that fails WCAG invalidates the library's claim more
 * effectively than any single component defect.
 *
 * These run in Chromium, Firefox and WebKit. Divergence between engines is
 * recorded as a finding rather than retried away (PRD §17 R9).
 */

const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const scan = (page: Page) => new AxeBuilder({ page }).withTags(WCAG_22_AA);

/** PRD §12.3: zero critical, zero serious. Moderate/minor are reported, not gated. */
function assertNoBlockingViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  const blocking = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const detail = blocking
    .map(
      (v) =>
        `[${v.impact}] ${v.id} — ${v.help}\n  ${v.helpUrl}\n` +
        v.nodes.map((n) => `    ${n.target.join(' ')}\n      ${n.failureSummary}`).join('\n'),
    )
    .join('\n\n');
  expect(blocking, `Blocking WCAG violations:\n\n${detail}`).toEqual([]);
}

test.describe('docs site — WCAG 2.2 AA', () => {
  test('home route has no blocking violations', async ({ page }) => {
    await page.goto('/');
    const { violations } = await scan(page).analyze();
    assertNoBlockingViolations(violations);
  });

  test('reports colour-contrast results, which jsdom cannot compute at all', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    // The assertion that matters is that the rule actually RAN. A contrast rule
    // reporting nothing because it could not execute looks identical to a pass.
    const ran = results.passes.length + results.violations.length + results.incomplete.length;
    expect(ran, 'color-contrast rule did not execute').toBeGreaterThan(0);
    expect(results.violations).toEqual([]);
  });
});

test.describe('docs site — structure (AR-24)', () => {
  test('exposes exactly one main landmark and one h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('every navigation landmark has a unique accessible name', async ({ page }) => {
    await page.goto('/');
    const navs = page.getByRole('navigation');
    const names = await navs.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? ''),
    );
    expect(names.every(Boolean), 'a navigation landmark has no accessible name').toBe(true);
    expect(new Set(names).size, 'two navigation landmarks share a name').toBe(names.length);
  });
});

test.describe('docs site — accessibility tree (TR-04)', () => {
  /**
   * Asserted against the COMPUTED accessibility tree, not DOM attributes: the
   * two diverge whenever role, aria-label and content disagree about
   * precedence, and the tree is what assistive technology actually consumes.
   *
   * API note: PRD TR-04 was written against `page.accessibility.snapshot()`,
   * which Playwright removed. The current equivalent is `locator.ariaSnapshot()`
   * (YAML) and the `toMatchAriaSnapshot` matcher. PRD updated — see §19.8.
   */
  test('the computed tree exposes the expected landmarks and heading', async ({ page }) => {
    await page.goto('/');
    const snapshot = await page.locator('body').ariaSnapshot();

    expect(snapshot).toMatch(/heading .*level=1/);
    expect(snapshot).toContain('Skip to main content');
    expect(snapshot).toMatch(/navigation "Primary"/);
    expect(snapshot).toContain('main');
  });

  test('the skip link is a link in the tree, not a styled div', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeAttached();
  });
});
