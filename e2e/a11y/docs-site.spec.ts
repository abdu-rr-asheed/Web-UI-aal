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

test.describe('docs site — keyboard (AR-02, SC 2.4.1)', () => {
  test('the first Tab reaches a skip link that moves focus to main', async ({ page, browserName }) => {
    await page.goto('/');

    // ENGINE DIVERGENCE D-001 (docs/reports/engine-divergences.md).
    // WebKit ships with "Press Tab to highlight each item" OFF, so Tab cycles
    // only form controls and never reaches a link. That is platform behaviour,
    // not an AAL defect, and working around it would break the expectations of
    // users who configured Safari deliberately. On WebKit we therefore assert
    // the link is genuinely focusable and operable — the conformance
    // requirement — rather than asserting a key that platform does not bind.
    // This is NOT a skipped test: the outcome is still verified.
    if (browserName === 'webkit') {
      const link = page.getByRole('link', { name: /skip to main content/i });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
      return;
    }

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText(/skip to main content/i);

    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
  });

  test('the skip link is visible when focused, not merely present', async ({ page }) => {
    await page.goto('/');
    // A skip link that stays off-screen while focused is useless to a sighted
    // keyboard user — the most common way this control is got wrong.
    const link = page.getByRole('link', { name: /skip to main content/i });
    await link.focus();
    const box = await link.boundingBox();
    expect(box, 'focused skip link has no layout box').not.toBeNull();
    expect(box!.y, 'focused skip link is still off-screen').toBeGreaterThanOrEqual(0);
  });

  test('has no keyboard trap: focus keeps advancing (SC 2.1.2)', async ({ page, browserName }) => {
    await page.goto('/');

    // D-001 again. On WebKit this shell has ZERO Tab stops — every control is a
    // link, and WebKit's default binding skips links — so "does focus advance
    // through the tab order" is not a question that engine can answer.
    //
    // SC 2.1.2 is not actually about advancing, though: it requires that focus
    // can LEAVE wherever it currently is. That is testable everywhere, so on
    // WebKit we assert exactly that, which is the criterion rather than a proxy
    // for it.
    if (browserName === 'webkit') {
      const link = page.getByRole('link', { name: /skip to main content/i });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(link, 'focus could not leave the skip link — this is a trap').not.toBeFocused();
      return;
    }

    const sequence: string[] = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      sequence.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return el ? `${el.tagName}#${el.id}.${el.className}:${el.textContent?.slice(0, 20)}` : 'none';
        }),
      );
    }

    // A keyboard trap means focus cannot LEAVE an element. Revisiting elements
    // is not a trap — it is the tab order cycling, which is correct and
    // expected on a short page. The real signal is how many distinct stops
    // exist, and whether focus ever moves off any single one.
    const distinct = new Set(sequence);
    expect(distinct.size, `focus never left one element: ${[...distinct]}`).toBeGreaterThan(1);

    const longestRun = sequence.reduce(
      (acc, id, i) => (i > 0 && id === sequence[i - 1] ? { run: acc.run + 1, max: Math.max(acc.max, acc.run + 1) } : { run: 1, max: acc.max }),
      { run: 1, max: 1 },
    ).max;
    expect(longestRun, 'focus stuck on the same element across consecutive Tabs').toBeLessThan(3);
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
