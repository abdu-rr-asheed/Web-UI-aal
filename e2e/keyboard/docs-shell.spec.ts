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
    // The cost of this sweep is O(number of focusables on the page), with four
    // round trips to the browser each, and the docs shell grows every sprint as
    // more components are dogfooded into it. Sprint 4 roughly doubled the count
    // and pushed the WebKit run past the default 30s.
    //
    // An explicit generous budget rather than sampling the elements: a keyboard
    // trap on the one control that was not checked is exactly the defect this
    // exists to find, so coverage is the thing that must not be traded away.
    //
    // 30s in isolation on WebKit; test.slow()'s 90s was still not enough with
    // six workers competing for the machine. The runtime is dominated by
    // per-element browser round trips, not by anything that could hang, and
    // retries are off — so a slow pass here is a slow pass, never a flake being
    // absorbed.
    test.setTimeout(240_000);

    await page.goto('/');

    /**
     * SC 2.1.2 requires that keyboard focus can be moved AWAY from any
     * component. It does not require that the browser auto-focuses the
     * document on load, nor that a given engine binds Tab to links — so the
     * criterion is asserted directly, identically on every engine, rather than
     * inferred from a Tab walk.
     *
     * The earlier Tab-walk version passed on Chromium and failed on
     * keyboard-firefox with "focus stuck for 22 consecutive Tabs". That was
     * attributed to headless Firefox never seeding document focus; the
     * attribution was WRONG and is retracted in D-005 — Firefox was in a
     * broken install at the time (D-002), and with it repaired the tab walk on
     * this very page is byte-identical to Chromium.
     *
     * The rewrite is kept anyway, because it was never really a workaround: it
     * asserts the criterion directly and tests strictly more of it, checking
     * every focusable element in both directions rather than wherever a walk
     * happened to land. What is engine-dependent is only the boundary case
     * below.
     */
    /**
     * Two exclusions, both because the element is CORRECTLY not focusable, so
     * asserting that focus can leave it would be asserting a bug:
     *
     *   - **Disabled controls.** The docs shell renders a real disabled AAL
     *     button, which is what surfaced this.
     *   - **Elements not rendered at this viewport.** `:visible` is applied
     *     because a CSS selector cannot see `display: none`. AalNav's
     *     collapsed-viewport toggle is a `<button>` in the markup at every
     *     width and focusable at none above the breakpoint — which is the
     *     point of it, and this test found it the day it was added.
     *
     * WebKit skips links entirely (D-001, D-008), so the set of elements it
     * walks differs from the other two engines. That needs no branching here:
     * each element is focused programmatically, which works on every engine,
     * and the assertion is about leaving it rather than arriving at it.
     *
     * SC 2.1.2 is about components that CAN receive focus, so narrowing the
     * sweep this way tests the criterion rather than something adjacent to it.
     */
    const focusables = await page
      .locator(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ]
          .map((sel) => `${sel}:visible`)
          .join(', '),
      )
      .all();
    expect(focusables.length, 'shell has no focusable elements to test').toBeGreaterThan(0);

    /**
     * Boundary elements are excluded, and precisely:
     *
     *   - Shift+Tab from the FIRST focusable hands focus to browser chrome
     *   - Tab from the LAST focusable does the same
     *
     * Both are correct behaviour and neither is observable from inside the
     * page, so a page-level test cannot distinguish "focus left the document"
     * from "focus did not move". Headless Firefox exposed this by leaving
     * activeElement unchanged where Chromium reports body (D-005). Excluding
     * exactly the two boundary cases keeps every in-document transition under
     * test while asserting nothing the page can neither control nor observe.
     */
    for (const [i, el] of focusables.entries()) {
      const isFirst = i === 0;
      const isLast = i === focusables.length - 1;

      if (!isLast) {
        await el.focus();
        await expect(el).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(el, `Tab could not move focus off focusable #${i} — keyboard trap`).not.toBeFocused();
      }

      if (!isFirst) {
        await el.focus();
        await expect(el).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(el, `Shift+Tab could not move focus off focusable #${i} — keyboard trap`).not.toBeFocused();
      }
    }
  });
});
