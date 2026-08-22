import { test, expect } from '@playwright/test';

/**
 * Keyboard conformance for the documentation shell (PRD TR-02).
 *
 * Lives under e2e/keyboard/ because TR-02 requires keyboard conformance to be
 * its own suite: from Phase 3 onward each component gets a file here with one
 * describe per row of its APG interaction table, so the report reads as a
 * conformance document rather than a pile of assertions.
 *
 * Engine-aware where WebKit genuinely differs — see D-001 in
 * docs/reports/engine-divergences.md.
 */

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
