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

  test('has no keyboard trap: focus can always leave (SC 2.1.2)', async ({ page }) => {
    await page.goto('/');

    /**
     * SC 2.1.2 requires that keyboard focus can be moved AWAY from any
     * component. It does not require that the browser auto-focuses the
     * document on load, nor that a given engine binds Tab to links — so the
     * criterion is asserted directly, identically on every engine, rather than
     * inferred from a Tab walk.
     *
     * The earlier Tab-walk version passed on Chromium and failed on
     * keyboard-firefox with "focus stuck for 22 consecutive Tabs". That was an
     * artifact of headless Firefox never seeding document focus, not a barrier
     * a real user would hit — see D-005. Seeding focus explicitly removes the
     * artifact while testing strictly more of the criterion, because it now
     * checks every focusable element rather than wherever a Tab walk happened
     * to land.
     */
    const focusables = await page.locator('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();
    expect(focusables.length, 'shell has no focusable elements to test').toBeGreaterThan(0);

    for (const el of focusables) {
      await el.focus();
      await expect(el).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(el, 'Tab could not move focus off this element — keyboard trap').not.toBeFocused();

      await el.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(el, 'Shift+Tab could not move focus off this element — keyboard trap').not.toBeFocused();
    }
  });
});
