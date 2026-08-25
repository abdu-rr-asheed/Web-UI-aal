import { test, expect, type Page } from '@playwright/test';

/**
 * Modal dialog — focus management in a real browser (PRD TR-02, TR-04, §7.12).
 *
 * The unit suite verifies what the component DOES; this verifies what a
 * keyboard user EXPERIENCES. Tab cycling in particular cannot be tested in
 * jsdom at all: it has no layout engine and no notion of tab order, so the
 * single most important property of a modal dialog — that Tab cannot escape it
 * — is only observable here.
 *
 * Assertions follow the sequence diagram in PRD Figure 3.
 */

const openDialog = async (page: Page) => {
  // A distinct name on purpose. The demo page has several "Delete account"
  // buttons, and an ambiguous accessible name means the test silently drives
  // the wrong control — the same class of mistake as an unscoped role query.
  await page.getByRole('button', { name: 'Open confirmation dialog' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('opening', () => {
  test('exposes an alertdialog named by its heading', async ({ page }) => {
    await openDialog(page);
    await expect(page.getByRole('alertdialog', { name: /Delete this account/ })).toBeVisible();
  });

  test('moves focus inside the dialog', async ({ page }) => {
    // Failure mode 1: without this a screen-reader user has no idea the dialog
    // opened and keeps reading the page behind it.
    await openDialog(page);

    const focusedInside = await page.evaluate(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      return !!dialog && dialog.contains(document.activeElement);
    });
    expect(focusedInside).toBe(true);
  });

  test('does not put focus on the destructive action', async ({ page }) => {
    // Failure mode 5: a screen-reader user pressing Enter to acknowledge the
    // dialog would otherwise delete the account.
    await openDialog(page);
    const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(focusedText).not.toMatch(/^Delete account$/);
  });
});

test.describe('background is inert (failure mode 2)', () => {
  test('content behind the dialog is marked inert', async ({ page }) => {
    // A focus trap stops Tab escaping, but without inert the virtual cursor
    // walks into content the user cannot reach. aria-modal promises this and
    // does not deliver it.
    await openDialog(page);

    const backgroundInert = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      return !!heading?.closest('[inert]');
    });
    expect(backgroundInert).toBe(true);
  });

  test('background controls are inert, so they cannot be activated', async ({ page }) => {
    await openDialog(page);

    // inert DISABLES interaction and removes the element from the
    // accessibility tree — it does not hide it. Asserting invisibility was
    // testing the wrong property; an inert element is still painted.
    const skipLinkInert = await page.evaluate(() => {
      const link = [...document.querySelectorAll('a')].find((a) =>
        a.textContent?.includes('Skip to main content'),
      );
      return !!link?.closest('[inert]');
    });
    expect(skipLinkInert).toBe(true);
  });
});

test.describe('Tab is trapped inside the dialog (SC 2.1.2)', () => {
  test('cycling with Tab never leaves the dialog', async ({ page }) => {
    // Not observable in jsdom at all — it has no tab order. This is the single
    // most important property of a modal dialog.
    await openDialog(page);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');

      const stillInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(stillInside, `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
    }
  });

  test('Shift+Tab is trapped in the same way', async ({ page }) => {
    await openDialog(page);

    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');

      const stillInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(stillInside, `focus escaped backwards after ${i + 1} presses`).toBe(true);
    }
  });
});

test.describe('Escape closes and restores focus (failure mode 3)', () => {
  test('closes on Escape', async ({ page }) => {
    await openDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toBeHidden();
  });

  test('returns focus to the trigger, never to body', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Open confirmation dialog' });
    await openDialog(page);
    await page.keyboard.press('Escape');

    await expect(trigger).toBeFocused();
  });

  test('removes inert from the background on close', async ({ page }) => {
    await openDialog(page);
    await page.keyboard.press('Escape');

    const stillInert = await page.evaluate(() => !!document.querySelector('h1')?.closest('[inert]'));
    expect(stillInert, 'the page stayed inert after the dialog closed').toBe(false);
  });
});

test.describe('accessibility tree (TR-04)', () => {
  test('the computed tree reports a named alertdialog with its description', async ({ page }) => {
    await openDialog(page);

    const snapshot = await page.getByRole('alertdialog').ariaSnapshot();
    expect(snapshot).toContain('Delete this account?');
    expect(snapshot).toMatch(/heading/);
  });

  test('aria-describedby resolves to a real element', async ({ page }) => {
    await openDialog(page);

    const describedBy = await page.getByRole('alertdialog').getAttribute('aria-describedby');
    expect(describedBy, 'dialog has no description reference').toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toContainText('cannot be undone');
  });
});

test.describe('scroll containment (AR-15)', () => {
  test('locks page scroll while open and restores it after', async ({ page }) => {
    const before = await page.evaluate(() => document.body.style.overflow);

    await openDialog(page);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(before);
  });
});
