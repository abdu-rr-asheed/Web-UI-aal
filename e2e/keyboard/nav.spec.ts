import { test, expect } from '@playwright/test';

/**
 * Site navigation and Menu Button — keyboard conformance (PRD TR-02, §9.6).
 *
 * The claim this file exists to check is ADR-0005: site navigation must NOT be
 * an application menu, and a menu of actions must be. Both halves are asserted
 * against the **computed accessibility tree**, not against DOM attributes — a
 * `<fieldset>` in Sprint 2 passed a DOM assertion while the browser mapped it
 * to `group` rather than `radiogroup`, and only the computed tree caught it.
 *
 * The responsive collapse is verified here too. jsdom does not evaluate media
 * queries, so the mobile disclosure has no meaningful unit test at all — its
 * only real verification is a browser at 375px.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('ADR-0005 — site navigation is not an application menu', () => {
  test('the primary navigation exposes NO menu role', async ({ page }) => {
    // role="menu" would switch a screen reader into application mode, so the
    // reading keys the user navigates the rest of the page with stop working.
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('menu')).toHaveCount(0);
    await expect(nav.getByRole('menuitem')).toHaveCount(0);
  });

  test('the computed tree reports LINKS inside a list', async ({ page }) => {
    // menuitem would override the link role, so "list all links on this page"
    // — a primary way screen-reader users orient themselves — would stop
    // finding the site's own navigation.
    const snapshot = await page.getByRole('navigation', { name: 'Primary' }).ariaSnapshot();
    expect(snapshot).toContain('link');
    expect(snapshot).toContain('list');
  });

  test('the navigation landmark is named, so it is distinguishable', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });

  test('the current page is marked with aria-current', async ({ page }) => {
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Enter or Space on a submenu trigger — toggles the submenu', () => {
  test('opens on Enter, and the links become reachable', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /Components/ });
    await trigger.focus();
    await page.keyboard.press('Enter');

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Form controls' })).toBeVisible();
  });

  test('the submenu is absent from the DOM while closed', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Form controls' })).toHaveCount(0);
  });
});

test.describe('Escape — closes the submenu and returns focus to its trigger', () => {
  test('returns focus, never dropping it on body', async ({ page }) => {
    // The submenu the user is standing in is removed from the DOM. Without an
    // explicit restore, focus falls to <body> and a keyboard user is dumped at
    // the top of the document.
    const trigger = page.getByRole('button', { name: /Components/ });
    await trigger.click();
    await page.getByRole('link', { name: 'Form controls' }).focus();

    await page.keyboard.press('Escape');

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });
});

test.describe('Down and Up Arrow — move within an open submenu', () => {
  test('Down from the trigger enters the submenu', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /Components/ });
    await trigger.click();
    await trigger.focus();

    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('link', { name: 'Buttons and links' })).toBeFocused();
  });

  test('Down moves to the next link', async ({ page }) => {
    await page.getByRole('button', { name: /Components/ }).click();
    await page.getByRole('link', { name: 'Buttons and links' }).focus();

    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('link', { name: 'Form controls' })).toBeFocused();
  });

  test('arrows are NOT bound between top-level items', async ({ page }) => {
    // Arrow navigation across the top level would make the navigation behave
    // like a menubar, which is the application-menu model this pattern avoids.
    const home = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' });
    await home.focus();

    await page.keyboard.press('ArrowDown');

    await expect(home).toBeFocused();
  });
});

test.describe('Tab moves through the navigation normally (SC 2.4.3)', () => {
  test('every top-level item is its own tab stop', async ({ page }) => {
    // The opposite of Tabs, deliberately. A screen-reader user expects to
    // reach navigation links the same way as every other link on the page,
    // and a single-tab-stop composite would hide them from exactly that.
    const home = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' });
    await home.focus();

    await page.keyboard.press('Tab');

    await expect(page.getByRole('button', { name: /Components/ })).toBeFocused();
  });
});

test.describe('responsive collapse — one implementation (PRD §9.6)', () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test('the toggle appears, and the list is hidden until it is pressed', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /Menu/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // display:none removes the list from the accessibility tree as well as the
    // screen, so a screen-reader user does not read navigation the toggle
    // reports as closed.
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }),
    ).toBeHidden();
  });

  test('opens on Enter and exposes THE SAME links', async ({ page }) => {
    // Not a second implementation: the same <ul>, the same links, the same
    // aria-current. A parallel mobile nav is how sites end up accessible at
    // one viewport and not the other.
    const toggle = page.getByRole('button', { name: /Menu/ });
    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const home = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('aria-current', 'page');
  });

  test('submenus still work inside the collapsed panel', async ({ page }) => {
    await page.getByRole('button', { name: /Menu/ }).click();
    await page.getByRole('button', { name: /Components/ }).click();

    await expect(page.getByRole('link', { name: 'Form controls' })).toBeVisible();
  });

  test('Escape closes the collapsed panel and returns focus to the toggle', async ({ page }) => {
    // There must always be a way out of an expanded navigation that does not
    // require finding the toggle again by hand.
    const toggle = page.getByRole('button', { name: /Menu/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Home' }).focus();
    await page.keyboard.press('Escape');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });
});

test.describe('ADR-0005 — a menu of ACTIONS is where role="menu" belongs', () => {
  const openMenuTab = async (page: import('@playwright/test').Page) => {
    await page.locator('[role="tab"]:has-text("Menu button")').click();
  };

  test('the computed tree reports a menu with menuitems', async ({ page }) => {
    await openMenuTab(page);
    await page.getByRole('button', { name: /Row actions/ }).click();

    const snapshot = await page.getByRole('menu').ariaSnapshot();
    expect(snapshot).toContain('menuitem');
  });

  test('Down Arrow on the trigger opens on the FIRST item', async ({ page }) => {
    await openMenuTab(page);
    await page.getByRole('button', { name: /Row actions/ }).focus();

    await page.keyboard.press('ArrowDown');

    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  });

  test('Up Arrow on the trigger opens on the LAST item', async ({ page }) => {
    // How a keyboard user reaches "Delete" in one keystroke rather than
    // arrowing past everything above it.
    await openMenuTab(page);
    await page.getByRole('button', { name: /Row actions/ }).focus();

    await page.keyboard.press('ArrowUp');

    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  });

  test('arrows wrap, and skip the disabled item', async ({ page }) => {
    await openMenuTab(page);
    await page.getByRole('button', { name: /Row actions/ }).focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused();

    // "Export as CSV" is disabled, so Down skips it.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
  });

  test('typeahead jumps to a matching item (AR-03)', async ({ page }) => {
    await openMenuTab(page);
    await page.getByRole('button', { name: /Row actions/ }).focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('d');

    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused();
  });

  test('Escape closes and returns focus to the trigger', async ({ page }) => {
    await openMenuTab(page);
    const trigger = page.getByRole('button', { name: /Row actions/ });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Escape');

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Enter activates the focused item and returns focus to the trigger', async ({ page }) => {
    // The item is removed from the DOM on activation, so leaving focus on it
    // would drop the keyboard user onto <body> exactly as their action lands.
    await openMenuTab(page);
    const trigger = page.getByRole('button', { name: /Row actions/ });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Enter');

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByText('Last action chosen: rename')).toBeVisible();
  });

  test('Tab closes the menu WITHOUT pulling focus back', async ({ page }) => {
    // The user asked to leave; returning focus would trap them in the control
    // they are escaping.
    await openMenuTab(page);
    const trigger = page.getByRole('button', { name: /Row actions/ });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Tab');

    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).not.toBeFocused();
  });
});

test.describe('Breadcrumb (SC 2.4.8)', () => {
  test('exposes a named landmark whose last entry is not a link', async ({ page }) => {
    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumb).toBeVisible();
    await expect(crumb.getByRole('link', { name: 'Navigation' })).toHaveCount(0);
  });

  test('the computed tree reports a list, so the depth is announced', async ({ page }) => {
    const snapshot = await page.getByRole('navigation', { name: 'Breadcrumb' }).ariaSnapshot();
    expect(snapshot).toContain('list');
  });
});

test.describe('Pagination (SC 2.4.7, 4.1.3)', () => {
  const openPaginationTab = async (page: import('@playwright/test').Page) => {
    await page.locator('[role="tab"]:has-text("Pagination")').click();
  };

  test('keeps focus on the pressed control across a page change', async ({ page }) => {
    // Moving focus into the results would take a user stepping through several
    // pages away from the control they are using, every time.
    //
    // Activated by KEYBOARD rather than by click, and not to dodge a failure:
    // WebKit does not focus a button on click at all (D-008), so a click-driven
    // version of this test would be asserting the engine's pointer behaviour
    // rather than AAL's focus management. SC 3.2.2 is about what happens on
    // activation, and keyboard activation is the case where losing focus
    // actually strands someone.
    await openPaginationTab(page);
    const target = page.getByRole('button', { name: 'Page 5' });
    await target.focus();
    await page.keyboard.press('Enter');

    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('aria-current', 'page');
  });

  test('Previous stays FOCUSABLE on the first page', async ({ page }) => {
    // Native `disabled` would make the button the user is standing on
    // unfocusable at the moment it becomes unavailable, dropping focus to body.
    await openPaginationTab(page);
    await page.getByRole('button', { name: 'Page 1', exact: true }).click();

    const previous = page.getByRole('button', { name: /Previous/ });
    await previous.focus();

    await expect(previous).toBeFocused();
    await expect(previous).toHaveAttribute('aria-disabled', 'true');
  });
});
