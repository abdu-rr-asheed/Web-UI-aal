import { test, expect } from '@playwright/test';

/**
 * Tabs — keyboard conformance in a real browser (PRD TR-02, TR-04, §9.7).
 *
 * The unit suite verifies what the component DOES. This verifies what a
 * keyboard user EXPERIENCES, and two properties are only observable here:
 *
 *   - **The tab list is a single tab stop.** jsdom has no tab order at all, so
 *     "Tab enters the list once and leaves it once" cannot be asserted there.
 *     The unit suite can only count `tabindex` attributes, which is a proxy.
 *   - **The computed accessibility tree.** A DOM-attribute assertion passes on
 *     markup a browser maps to something else entirely — the mistake that let a
 *     `<fieldset>` masquerade as a radiogroup in Sprint 2.
 *
 * One describe block per row of the APG Tabs interaction table.
 */

const tab = (name: string) => `[role="tab"]:has-text("${name}")`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('semantics (SC 4.1.2)', () => {
  test('the computed tree reports a named tablist with tabs', async ({ page }) => {
    const snapshot = await page.getByRole('tablist', { name: 'Navigation patterns' }).ariaSnapshot();
    expect(snapshot).toContain('tab');
    expect(snapshot).toContain('Disclosure nav');
  });

  test('exactly one panel is exposed at a time', async ({ page }) => {
    // hidden removes the others from the accessibility tree. A CSS-only hide
    // would leave all three readable in browse mode.
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('the exposed panel is the one the selected tab controls', async ({ page }) => {
    const selected = page.locator('[role="tab"][aria-selected="true"]');
    const panelId = await selected.getAttribute('aria-controls');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('id', panelId!);
  });
});

test.describe('Tab — the tab list is a SINGLE tab stop (SC 2.4.3)', () => {
  test('one Tab press enters the list, one more leaves it', async ({ page }) => {
    // Not observable in jsdom, which has no tab order. For a switch-access
    // user, every extra press is a deliberate physical effort.
    const first = page.locator('[role="tab"]').first();
    await first.focus();
    await expect(first).toBeFocused();

    await page.keyboard.press('Tab');

    const stillInList = await page.evaluate(
      () => document.activeElement?.getAttribute('role') === 'tab',
    );
    expect(stillInList, 'Tab moved to another tab instead of leaving the list').toBe(false);
  });

  test('re-entering the list lands on the tab the user left, not the first', async ({ page }) => {
    const second = page.locator('[role="tab"]').nth(1);
    await page.locator('[role="tab"]').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(second).toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');

    await expect(second, 'the roving tab stop did not follow focus').toBeFocused();
  });
});

test.describe('Right and Left Arrow — move focus between tabs', () => {
  test('Right Arrow advances', async ({ page }) => {
    await page.locator(tab('Disclosure nav')).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator(tab('Menu button'))).toBeFocused();
  });

  test('Left Arrow retreats', async ({ page }) => {
    await page.locator(tab('Menu button')).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(tab('Disclosure nav'))).toBeFocused();
  });

  test('MANUAL activation — arrowing changes focus but not the panel (ADR-0008)', async ({ page }) => {
    // Under automatic activation this walk would render two panels the user
    // never asked for, each announced as they pass.
    const before = await page.getByRole('tabpanel').getAttribute('id');

    await page.locator(tab('Disclosure nav')).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    expect(await page.getByRole('tabpanel').getAttribute('id')).toBe(before);
  });
});

test.describe('Home and End — first and last tab', () => {
  test('End moves to the last tab', async ({ page }) => {
    await page.locator(tab('Disclosure nav')).focus();
    await page.keyboard.press('End');
    await expect(page.locator(tab('Pagination'))).toBeFocused();
  });

  test('Home moves to the first tab', async ({ page }) => {
    await page.locator(tab('Pagination')).focus();
    await page.keyboard.press('Home');
    await expect(page.locator(tab('Disclosure nav'))).toBeFocused();
  });
});

test.describe('Enter and Space — activate the focused tab', () => {
  test('Enter selects and reveals its panel', async ({ page }) => {
    await page.locator(tab('Menu button')).focus();
    await page.keyboard.press('Enter');

    await expect(page.locator(tab('Menu button'))).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: /Row actions/ })).toBeVisible();
  });

  test('Space selects too', async ({ page }) => {
    await page.locator(tab('Pagination')).focus();
    await page.keyboard.press(' ');

    await expect(page.locator(tab('Pagination'))).toHaveAttribute('aria-selected', 'true');
  });

  test('the newly selected panel is reachable by continuing to Tab', async ({ page }) => {
    // The user selected content; they must be able to get into it without a
    // mouse. A panel that is neither a tab stop nor holds one is unreachable.
    await page.locator(tab('Menu button')).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');

    const insidePanel = await page.evaluate(
      () => !!document.activeElement?.closest('[role="tabpanel"]'),
    );
    expect(insidePanel, 'Tab from the tab list did not reach the selected panel').toBe(true);
  });
});

test.describe('panel focusability (PRD §9.7)', () => {
  test('a prose-only panel IS a tab stop', async ({ page }) => {
    // Otherwise a keyboard user cannot scroll the content they just selected.
    await expect(page.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
  });

  test('a panel containing a control is NOT a tab stop', async ({ page }) => {
    // It would be an extra press before every field, forever.
    await page.locator(tab('Menu button')).click();
    await expect(page.getByRole('tabpanel')).not.toHaveAttribute('tabindex', '0');
  });
});
