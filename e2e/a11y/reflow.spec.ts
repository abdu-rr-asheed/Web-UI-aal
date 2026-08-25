import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Reflow at 320 CSS px (PRD AR-17 / SC 1.4.10).
 *
 * **This suite exists because the `reflow-320` Playwright project was matching
 * no test files.** It was configured in Sprint 0 with `testMatch:
 * /a11y\/.*reflow.*\.spec\.ts/` and no such file was ever written, so four
 * sprints of components claimed a reflow box in the Definition of Done on the
 * strength of a project that ran zero tests and therefore reported success.
 *
 * SC 1.4.10 requires content to be presentable at 320 CSS px without loss of
 * information or functionality, **and without two-dimensional scrolling**. The
 * horizontal scrollbar is the observable failure, and it is trivial to check
 * and easy to introduce: any fixed width, any `min-width` in px, any
 * non-wrapping row of controls.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('the viewport is actually 320px wide', () => {
  test('reports a 320px layout viewport', async ({ page }) => {
    // A guard on the guard: at desktop width every assertion below passes
    // trivially and the suite proves nothing.
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(width, 'this suite must run in the reflow-320 project').toBeLessThanOrEqual(320);
  });
});

test.describe('no two-dimensional scrolling (SC 1.4.10)', () => {
  test('the document does not scroll horizontally', async ({ page }) => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // A single pixel of tolerance for sub-pixel layout rounding; anything
    // larger is a real overflow.
    expect(scrollWidth, 'the page scrolls horizontally at 320px').toBeLessThanOrEqual(clientWidth + 1);
  });

  test('names the culprit when something overflows', async ({ page }) => {
    // A bare "the page is too wide" failure means opening a browser to find
    // out why. This reports the element, which is the difference between a
    // five-minute fix and an afternoon.
    const overflowing = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => el.getBoundingClientRect().right > limit + 1)
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()}.${el.className || '(no class)'}`);
    });

    expect(overflowing).toEqual([]);
  });
});

test.describe('navigation reflows rather than scrolling (AR-17)', () => {
  test('the primary navigation collapses behind its toggle', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();
  });

  test('the tab list WRAPS instead of becoming a horizontal scroller', async ({ page }) => {
    // A horizontal scroller is operable with a pointer and with nothing else:
    // the overflowed tabs stay reachable by arrow key, but a sighted keyboard
    // user cannot see where focus has gone.
    const tablist = await page.evaluate(() => {
      const el = document.querySelector('[role="tablist"]');
      return el ? { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null;
    });

    expect(tablist).not.toBeNull();
    expect(tablist!.scrollWidth, 'the tab list scrolls horizontally at 320px').toBeLessThanOrEqual(
      tablist!.clientWidth + 1,
    );
  });

  test('pagination wraps rather than overflowing', async ({ page }) => {
    await page.locator('[role="tab"]:has-text("Pagination")').click();

    const pagination = await page.evaluate(() => {
      const el = document.querySelector('.aal-pagination');
      return el ? { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null;
    });

    expect(pagination).not.toBeNull();
    expect(pagination!.scrollWidth).toBeLessThanOrEqual(pagination!.clientWidth + 1);
  });
});

test.describe('nothing is lost at 320px', () => {
  test('every control still meets the 24px target minimum (SC 2.5.8)', async ({ page }) => {
    /**
     * Reflow commonly squeezes controls below the minimum instead of wrapping
     * them, trading one criterion for another.
     *
     * Inline targets are excluded, because SC 2.5.8 excludes them: the
     * "Inline" exception covers a target "in a sentence, or its size is
     * otherwise constrained by the line-height of non-target text". A link
     * inside a paragraph is exactly that, and its height is the line box.
     *
     * The exception is applied deliberately rather than because a link tripped
     * the check. The docs shell's "Read the WCAG 2.2 specification" link did
     * trip the first version of this test, and it is conformant — an inline
     * link cannot be given a 24px box without changing the line spacing of the
     * prose around it, which is why the criterion exempts it.
     */
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
        .filter((el) => !getComputedStyle(el).display.startsWith('inline') || el.tagName === 'BUTTON')
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.width < 24 || r.height < 24);
        })
        .slice(0, 5)
        .map((el) => `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 30)}"`),
    );

    expect(undersized).toEqual([]);
  });

  test('axe finds no blocking violations at this width', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
