import { test, expect } from '@playwright/test';

/**
 * Radio Group — APG keyboard conformance (PRD TR-02, §9.3).
 *
 * Lives here rather than in the unit suite because native radio arrow
 * behaviour is implemented by the BROWSER, and jsdom does not implement it
 * (D-006). A jsdom test would verify nothing — and worse, it would stay green
 * if AalRadioGroup ever stopped using native radios and started hand-rolling
 * the keys, which is precisely the regression that matters most: relying on
 * the platform for this behaviour is the component's central design decision.
 *
 * One describe per APG Radio Group interaction-table row.
 */

const OPTIONS = ['Standard delivery', 'Express delivery', 'Click and collect'];

const radios = (page: import('@playwright/test').Page) =>
  page.getByRole('radiogroup', { name: /Delivery method/ }).getByRole('radio');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('group semantics', () => {
  test('is exposed as a named radiogroup', async ({ page }) => {
    // The <legend> is the group's accessible name — this asserts the computed
    // tree, not the markup that produced it.
    await expect(page.getByRole('radiogroup', { name: /Delivery method/ })).toBeVisible();
  });

  test('contains one radio per option, each with its label as accessible name', async ({ page }) => {
    await expect(radios(page)).toHaveCount(OPTIONS.length);
    for (const label of OPTIONS) {
      await expect(page.getByRole('radio', { name: new RegExp(label) })).toBeAttached();
    }
  });
});

test.describe('Tab — moves focus into the group, then out of it', () => {
  test('the whole group is a SINGLE tab stop', async ({ page }) => {
    // Ten tabs to cross a group is not a style preference: for a switch-access
    // user, where each activation is a deliberate physical effort, it is the
    // difference between usable and unusable.
    const all = radios(page);
    await all.first().focus();

    await page.keyboard.press('Tab');

    // Focus left the group entirely rather than stepping to radio 2.
    for (let i = 0; i < OPTIONS.length; i++) {
      await expect(all.nth(i)).not.toBeFocused();
    }
  });
});

test.describe('Down Arrow — moves focus to and SELECTS the next radio', () => {
  test('moves focus and selects in one step', async ({ page }) => {
    // In a radio group, moving focus selects. That is what makes it one
    // control with several values rather than several independent controls.
    const all = radios(page);
    await all.nth(0).focus();

    await page.keyboard.press('ArrowDown');

    await expect(all.nth(1)).toBeFocused();
    await expect(all.nth(1)).toBeChecked();
  });

  test('wraps from the last radio to the first — where the engine wraps', async ({ page, browserName }) => {
    /**
     * ENGINE DIVERGENCE D-009. Arrow-key wrapping in a native radio group is
     * provided by the BROWSER, and the browsers disagree: Chromium and Firefox
     * wrap, WebKit clamps at the ends. Verified against plain
     * `<input type="radio">` markup with no AAL involved, so this is platform
     * behaviour rather than a defect in the component.
     *
     * The assertion is therefore split rather than skipped. Both branches
     * verify the same underlying requirement — arrow keys move focus AND
     * selection together, which is what makes a radio group one control — and
     * each states what its engine actually does at the boundary.
     *
     * This is the measurable cost of the decision recorded in D-006: delegating
     * to the platform buys correct assistive-technology integration and gives
     * up cross-engine consistency. Both halves of that trade are real, and the
     * dissertation should report both.
     */
    const all = radios(page);
    await all.nth(2).focus();

    await page.keyboard.press('ArrowDown');

    if (browserName === 'webkit') {
      // Clamping means the press moved nothing, so it also selected nothing —
      // focus and selection stay coupled, which is the property under test.
      await expect(all.nth(2), 'WebKit is expected to clamp, not wrap (D-009)').toBeFocused();
      await expect(all.nth(2)).not.toBeChecked();
      await expect(all.nth(0)).not.toBeChecked();
      return;
    }

    await expect(all.nth(0)).toBeFocused();
    await expect(all.nth(0)).toBeChecked();
  });
});

test.describe('Up Arrow — moves focus to and selects the previous radio', () => {
  test('moves backwards and selects', async ({ page }) => {
    const all = radios(page);
    await all.nth(1).focus();

    await page.keyboard.press('ArrowUp');

    await expect(all.nth(0)).toBeFocused();
    await expect(all.nth(0)).toBeChecked();
  });

  test('wraps from the first radio to the last — where the engine wraps', async ({ page, browserName }) => {
    // ENGINE DIVERGENCE D-009, the backwards case. See the note above.
    const all = radios(page);
    await all.nth(0).focus();

    await page.keyboard.press('ArrowUp');

    await expect(browserName === 'webkit' ? all.nth(0) : all.nth(2)).toBeFocused();
  });
});

test.describe('Right / Left Arrow — behave as Down / Up', () => {
  test('Right advances', async ({ page }) => {
    const all = radios(page);
    await all.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(all.nth(1)).toBeFocused();
  });

  test('Left retreats', async ({ page }) => {
    const all = radios(page);
    await all.nth(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(all.nth(0)).toBeFocused();
  });
});

test.describe('re-entering the group', () => {
  test('Tab returns to the CHECKED radio, not the first one', async ({ page }) => {
    // Otherwise a user who selected "Click and collect", tabbed away, and
    // tabbed back would find focus on "Standard delivery" — implying their
    // choice was lost.
    const all = radios(page);
    await all.nth(2).focus();
    await page.keyboard.press('Space');
    await expect(all.nth(2)).toBeChecked();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');

    await expect(all.nth(2)).toBeFocused();
  });
});

test.describe('checkbox and switch keyboard behaviour', () => {
  test('Space toggles the checkbox', async ({ page }) => {
    const box = page.getByRole('checkbox', { name: /Email me about order updates/ });
    await box.focus();
    await page.keyboard.press('Space');
    await expect(box).toBeChecked();
    await page.keyboard.press('Space');
    await expect(box).not.toBeChecked();
  });

  test('Space toggles the switch, and aria-checked follows', async ({ page }) => {
    const sw = page.getByRole('switch', { name: /Save these details/ });
    await sw.focus();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('text field error association', () => {
  test('aria-describedby resolves to the visible error text once touched', async ({ page }) => {
    const email = page.getByRole('textbox', { name: /Email address/ });
    await email.focus();
    await page.keyboard.press('Tab'); // blur -> touched

    await expect(email).toHaveAttribute('aria-invalid', 'true');

    const describedBy = await email.getAttribute('aria-describedby');
    expect(describedBy, 'error is not associated with the control').toBeTruthy();

    // Every referenced id must resolve — a dangling aria-describedby announces
    // nothing, and looks identical to a correct one in the markup.
    for (const id of describedBy!.split(' ')) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator(`#${describedBy!.split(' ').pop()}`)).toContainText('name@example.com');
  });
});
