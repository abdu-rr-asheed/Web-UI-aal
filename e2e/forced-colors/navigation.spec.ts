import { test, expect } from '@playwright/test';

/**
 * Windows Contrast Themes / `forced-colors: active` (PRD AR-19, TR-10).
 *
 * **This suite exists because the `forced-colors` Playwright project was
 * matching no test files at all.** It was configured in Sprint 0 and stayed
 * empty through four sprints of components, each of which shipped a
 * `@media (forced-colors: active)` block that nothing verified. A configured
 * project that runs zero tests reports success, which is worse than having no
 * project: the pipeline was green on a check that never executed.
 *
 * ## What forced-colors actually breaks
 *
 * The OS replaces every author colour with one from the user's chosen palette,
 * and — critically — **`box-shadow` and `background-image` are not rendered at
 * all**. Every AAL component that distinguishes a state with `box-shadow`
 * therefore loses that distinction entirely unless a real border replaces it.
 * That is not a theoretical concern: the selected tab, the current nav link and
 * the current pagination page are all box-shadow indicators.
 *
 * Chromium-only, because Playwright emulates `forced-colors` only there. That
 * is a genuine coverage limit and is recorded as such rather than papered over.
 *
 * ## Why the mode is enabled here rather than by the project config
 *
 * `playwright.config.ts` sets `use: { forcedColors: 'active' }` on this
 * project, and in Playwright 1.62 that option **does not reach the default
 * `page` fixture** (D-007). `colorScheme` on the same project does. So the
 * mode is switched on explicitly below, and the first test asserts that it
 * actually took effect.
 *
 * That guard is the whole reason the problem was visible. A
 * `@media (forced-colors: active)` block is simply inert outside the mode —
 * it changes nothing and breaks nothing — so a suite running in normal
 * rendering has nothing to trip over and reports green while testing the
 * wrong thing entirely.
 */

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
});

const styleOf = (page: import('@playwright/test').Page, selector: string, property: string) =>
  page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).getPropertyValue(prop) : null;
    },
    [selector, property] as const,
  );

test.describe('the emulation is actually active', () => {
  test('the page reports forced-colors: active', async ({ page }) => {
    // A guard on the guard. Without it, every assertion below would pass
    // trivially in a normal rendering and the suite would prove nothing.
    const active = await page.evaluate(() => matchMedia('(forced-colors: active)').matches);
    expect(active, 'forced-colors emulation is not on — this suite proves nothing').toBe(true);
  });
});

test.describe('focus indicators survive (AR-19 / SC 2.4.7)', () => {
  test('the focused tab keeps a visible outline', async ({ page }) => {
    // The two-tone ring is built from outline + box-shadow. box-shadow is
    // dropped here, so the OUTLINE has to carry the indicator alone.
    await page.locator('[role="tab"]').first().focus();

    const outline = await page.evaluate(() => {
      const el = document.activeElement!;
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });

    expect(outline.style).not.toBe('none');
    expect(outline.width, 'focus outline collapsed to nothing in forced colours').toBeGreaterThanOrEqual(2);
  });

  test('the focused navigation link keeps a visible outline', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }).focus();

    const width = await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement!).outlineWidth));
    expect(width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('selected and current states survive without box-shadow', () => {
  test('the selected tab is distinguished by a real BORDER', async ({ page }) => {
    // box-shadow is not painted in forced-colors mode, so the inset bar that
    // marks the selected tab in normal rendering is simply gone. Without the
    // border replacement, a user of Windows Contrast Themes cannot see which
    // tab is selected at all — aria-selected would be the only signal, which
    // helps a screen-reader user and nobody else.
    const width = await styleOf(page, '.aal-tabs__tab--selected', 'border-block-end-width');
    expect(width, 'selected tab has no border in forced colours').not.toBeNull();
    expect(parseFloat(width!)).toBeGreaterThanOrEqual(2);
  });

  test('an unselected tab does NOT carry that border', async ({ page }) => {
    // Otherwise the "distinction" distinguishes nothing.
    const width = await page.evaluate(() => {
      const el = document.querySelector('[role="tab"]:not([aria-selected="true"])');
      return el ? parseFloat(getComputedStyle(el).borderBlockEndWidth) : null;
    });
    expect(width).toBeLessThan(2);
  });

  test('the current navigation link is distinguished by a real border', async ({ page }) => {
    const width = await styleOf(page, '.aal-nav__link[aria-current="page"]', 'border-block-end-width');
    expect(parseFloat(width ?? '0')).toBeGreaterThanOrEqual(2);
  });
});

test.describe('controls keep a visible boundary', () => {
  test('a button still has a rendered border', async ({ page }) => {
    // The reason `forced-color-adjust: none` was originally added was the fear
    // that removing it would leave the button as an unmarked patch of text.
    // It does not: `border-color: ButtonText` inside the media block is
    // honoured on its own, which is what makes the opt-out removable.
    const border = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.aal-button')!);
      return { width: parseFloat(s.borderTopWidth), style: s.borderTopStyle, color: s.borderTopColor };
    });

    expect(border.style).not.toBe('none');
    expect(border.width, 'the button lost its boundary in forced colours').toBeGreaterThan(0);
    expect(border.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('nothing opts out of the user palette', () => {
  test('no element sets forced-color-adjust: none', async ({ page }) => {
    // forced-color-adjust: none tells the OS "keep my colours" and is
    // occasionally legitimate — for a colour swatch whose colour IS the
    // content. It is never legitimate for text or a control, because it
    // reinstates exactly the contrast the user overrode the page to escape.
    const optedOut = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => getComputedStyle(el).forcedColorAdjust === 'none')
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}`),
    );
    expect(optedOut).toEqual([]);
  });
});
