import { test, expect, type Page } from '@playwright/test';

/**
 * Select — APG keyboard conformance in a real browser (PRD TR-02, §9.4).
 *
 * The state machine is unit-tested in libs/primitives/listbox, which verifies
 * what the widget DECIDES. This verifies what actually happens: real focus
 * staying on the trigger, aria-activedescendant resolving to a real element,
 * and the popup never covering the focused control (SC 2.4.11).
 *
 * None of those are observable in jsdom, which has no layout engine.
 */

const trigger = (page: Page) => page.getByRole('combobox', { name: /Delivery add-ons/ });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('collapsed — Enter, Space and arrows open the listbox', () => {
  test('ArrowDown opens', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await expect(t).toHaveAttribute('aria-expanded', 'false');

    await page.keyboard.press('ArrowDown');

    await expect(t).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('Enter opens', async ({ page }) => {
    await trigger(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
  });
});

test.describe('expanded — focus stays on the trigger', () => {
  test('DOM focus never enters the popup', async ({ page }) => {
    // Moving real focus into the popup makes browsers announce the option both
    // as a focus change and as a selection change — the user hears it twice.
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await expect(t).toBeFocused();
  });

  test('aria-activedescendant resolves to a real option element', async ({ page }) => {
    // A dangling activedescendant announces nothing and is indistinguishable
    // from a correct one in the markup.
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');

    const activeId = await t.getAttribute('aria-activedescendant');
    expect(activeId, 'no active descendant while open').toBeTruthy();

    const active = page.locator(`#${activeId}`);
    await expect(active).toBeAttached();
    await expect(active).toHaveAttribute('role', 'option');
  });

  test('the active option moves with the arrow keys', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');
    const first = await t.getAttribute('aria-activedescendant');

    await page.keyboard.press('ArrowDown');
    const second = await t.getAttribute('aria-activedescendant');

    expect(second).not.toBe(first);
  });
});

test.describe('SC 2.4.11 — the popup must not obscure the focused trigger', () => {
  test('the listbox is positioned entirely below the trigger', async ({ page }) => {
    // Focus stays on the trigger while the list is open, so a popup overlapping
    // it would hide the focused element. This is the reason the list is
    // positioned inline rather than free-floated by an overlay.
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');

    const triggerBox = await t.boundingBox();
    const listBox = await page.getByRole('listbox').boundingBox();

    expect(triggerBox, 'trigger has no layout box').not.toBeNull();
    expect(listBox, 'listbox has no layout box').not.toBeNull();
    expect(
      listBox!.y,
      'the listbox overlaps its own trigger, hiding the focused element',
    ).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height - 1);
  });
});

test.describe('expanded — Escape closes without committing', () => {
  test('closes and returns focus to the trigger', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(t).toBeFocused();
    await expect(t).toHaveAttribute('aria-expanded', 'false');
  });

  test('does not apply the option the user merely arrowed past', async ({ page }) => {
    // Escape means "undo this interaction".
    const t = trigger(page);
    const before = await t.textContent();

    await t.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');

    await expect(t).toHaveText(before!.trim());
  });
});

test.describe('multi-select', () => {
  test('declares aria-multiselectable and keeps the list open after a choice', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');

    const list = page.getByRole('listbox');
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');

    await page.keyboard.press('Enter');
    await expect(list, 'multi-select closed after one choice').toBeVisible();
  });

  test('aria-selected follows the selection', async ({ page }) => {
    const t = trigger(page);
    await t.focus();
    await page.keyboard.press('ArrowDown');

    // Scoped to the custom listbox: the native <select> on the same page also
    // exposes role="option", so an unscoped query matches its placeholder
    // first. Worth noting — an unscoped role query is a common way for a test
    // to silently assert against the wrong widget.
    const first = page.getByRole('listbox').getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('native select — the recommended default', () => {
  test('is a real select with an associated label', async ({ page }) => {
    const native = page.getByRole('combobox', { name: /Country/ });
    await expect(native).toBeVisible();
    expect(await native.evaluate((el) => el.tagName)).toBe('SELECT');
  });

  test('exposes its options to the accessibility tree', async ({ page }) => {
    const native = page.getByRole('combobox', { name: /Country/ });
    await native.selectOption('fr');
    await expect(native).toHaveValue('fr');
  });

  test('marks the unavailable option disabled rather than hiding it', async ({ page }) => {
    // Removing it would hide the fact that the choice exists but is
    // unavailable, and shift every position announcement.
    const disabled = page.locator('select option[value="ru"]');
    await expect(disabled).toHaveAttribute('disabled', '');
  });
});
