import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalNav } from './nav';
import type { AalNavItem } from './nav';
import { AalBreadcrumb } from '../../breadcrumb/src/breadcrumb';
import { AalMenu } from '../../menu/src/menu';
import { AalPagination } from '../../pagination/src/pagination';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Sprint 4 navigation components (PRD §9.6, §9.9).
 *
 * Grouped because they are one sprint's worth of navigation patterns sharing a
 * single axe sweep at the end. Each describe block is named after a row of the
 * relevant APG interaction table (PRD §11.4).
 *
 * The load-bearing assertion in this file is that `AalNav` exposes NO element
 * with role `menu` or `menuitem`, and `AalMenu` exposes both. That contrast is
 * ADR-0005 stated as a test.
 */

const NAV_ITEMS: AalNavItem[] = [
  { label: 'Home', href: '/', current: true },
  {
    label: 'Products',
    children: [
      { label: 'Keyboards', href: '/products/keyboards' },
      { label: 'Switches', href: '/products/switches' },
      { label: 'Keycaps', href: '/products/keycaps' },
    ],
  },
  { label: 'Support', href: '/support' },
];

const setup = (template: string, props: Record<string, unknown> = {}) =>
  render(template, {
    imports: [AalNav, AalMenu, AalBreadcrumb, AalPagination],
    providers: [provideAal({ assertions: 'off' })],
    componentProperties: props,
  });

const nav = () => setup(`<aal-nav label="Primary" [items]="items" />`, { items: NAV_ITEMS });

describe('AalNav (APG Disclosure Navigation Menu)', () => {
  describe('ADR-0005 — site navigation is NOT an application menu', () => {
    it('exposes no role="menu" anywhere', async () => {
      // role="menu" switches a screen reader out of browse mode, so the
      // reading keys the user navigates the rest of the page with stop
      // working inside the site's own navigation.
      await nav();
      expect(screen.queryAllByRole('menu')).toHaveLength(0);
    });

    it('exposes no role="menuitem" — the destinations stay LINKS', async () => {
      // menuitem overrides the link role, so "list all links on this page"
      // stops finding the navigation at all.
      await nav();
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    });

    it('keeps native list semantics, so the length is announced', async () => {
      const { container } = await nav();
      expect(container.querySelectorAll('ul').length).toBeGreaterThan(0);
    });

    it('exposes a named navigation landmark', async () => {
      // Two unnamed <nav> landmarks are indistinguishable in the landmark
      // list, which is how the landmark is most often reached.
      await nav();
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    });
  });

  describe('links and current page (SC 2.4.8)', () => {
    it('renders each top-level destination as a link', async () => {
      await nav();
      expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Support' })).toBeTruthy();
    });

    it('marks the current page with aria-current', async () => {
      await nav();
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    });

    it('does not mark any other link current', async () => {
      await nav();
      expect(screen.getByRole('link', { name: 'Support' }).hasAttribute('aria-current')).toBe(false);
    });
  });

  describe('Enter or Space on a submenu trigger — toggles the submenu', () => {
    it('renders the trigger as a button with aria-expanded', async () => {
      await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens on click and points aria-controls at the real submenu', async () => {
      const user = userEvent.setup();
      const { container } = await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });

      await user.click(trigger);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector(`#${trigger.getAttribute('aria-controls')}`)).not.toBeNull();
    });

    it('REMOVES the submenu from the DOM when closed', async () => {
      // height:0 and visibility:hidden both leave submenu links in the
      // accessibility tree, so a screen-reader user reads links inside a
      // submenu the trigger reports as closed.
      await nav();
      expect(screen.queryByRole('link', { name: 'Keycaps' })).toBeNull();
    });

    it('toggles closed again', async () => {
      const user = userEvent.setup();
      await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });

      await user.click(trigger);
      await user.click(trigger);

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Escape — closes the open submenu and returns focus to its trigger', () => {
    it('closes', async () => {
      const user = userEvent.setup();
      const { fixture } = await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });

      await user.click(trigger);
      await user.keyboard('{Escape}');
      fixture.detectChanges();

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });

    it('returns focus to the trigger, never to body', async () => {
      // The submenu the user is standing in is removed from the DOM. Without
      // an explicit restore, focus falls to <body> and a keyboard user is
      // dropped at the top of the document with no idea what happened.
      const user = userEvent.setup();
      const { fixture } = await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });

      await user.click(trigger);
      fixture.detectChanges();
      screen.getByRole('link', { name: 'Keyboards' }).focus();

      await user.keyboard('{Escape}');
      fixture.detectChanges();

      expect(document.activeElement).toBe(screen.getByRole('button', { name: /Products/ }));
    });
  });

  describe('Down Arrow and Up Arrow — move within an open submenu', () => {
    it('Down from the trigger enters the submenu', async () => {
      const user = userEvent.setup();
      const { fixture } = await nav();
      const trigger = screen.getByRole('button', { name: /Products/ });

      await user.click(trigger);
      fixture.detectChanges();
      trigger.focus();

      await user.keyboard('{ArrowDown}');

      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Keyboards' }));
    });

    it('Down moves to the next submenu link', async () => {
      const user = userEvent.setup();
      const { fixture } = await nav();

      await user.click(screen.getByRole('button', { name: /Products/ }));
      fixture.detectChanges();
      screen.getByRole('link', { name: 'Keyboards' }).focus();

      await user.keyboard('{ArrowDown}');

      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Switches' }));
    });

    it('Up moves back', async () => {
      const user = userEvent.setup();
      const { fixture } = await nav();

      await user.click(screen.getByRole('button', { name: /Products/ }));
      fixture.detectChanges();
      screen.getByRole('link', { name: 'Switches' }).focus();

      await user.keyboard('{ArrowUp}');

      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Keyboards' }));
    });

    it('does NOT bind arrows at the top level', async () => {
      // Arrow navigation between top-level items would make the navigation
      // behave like a menubar, which is the application-menu model this
      // component exists to avoid.
      const user = userEvent.setup();
      await nav();
      const home = screen.getByRole('link', { name: 'Home' });
      home.focus();

      await user.keyboard('{ArrowDown}');

      expect(document.activeElement).toBe(home);
    });
  });

  describe('focus leaving the navigation closes the submenu', () => {
    it('closes when focus moves outside', async () => {
      // Otherwise a sighted keyboard user sees an open panel with nothing
      // focused in it, and a screen-reader user browsing forward walks back
      // into links they have already passed.
      const user = userEvent.setup();
      const { fixture, container } = await setup(
        `<aal-nav label="Primary" [items]="items" /><button type="button">Outside</button>`,
        { items: NAV_ITEMS },
      );

      await user.click(screen.getByRole('button', { name: /Products/ }));
      fixture.detectChanges();
      expect(container.querySelector('.aal-nav__submenu')).not.toBeNull();

      screen.getByRole('button', { name: 'Outside' }).focus();
      fixture.detectChanges();

      expect(container.querySelector('.aal-nav__submenu')).toBeNull();
    });
  });

  /**
   * The collapse itself is driven by a media query, which jsdom does not
   * evaluate, so whether the toggle is actually usable at a narrow viewport is
   * verified in `e2e/keyboard/nav.spec.ts` at 375px. What CAN be asserted here
   * is the property that makes the media query safe: at desktop width the
   * toggle is not exposed to assistive technology at all, so its
   * `aria-expanded` never describes a list that is permanently visible.
   */
  describe('responsive collapse — one implementation, not two', () => {
    it('does not expose the collapsed-viewport toggle at desktop width', async () => {
      // display:none removes it from the accessibility tree as well as the
      // screen, which is why getByRole cannot see it.
      await nav();
      expect(screen.queryByRole('button', { name: /Menu/ })).toBeNull();
    });

    it('serves the SAME links at both viewports — there is no second list', async () => {
      // A parallel mobile implementation is how sites end up accessible at one
      // viewport and not the other, with only one of the two ever tested.
      const { container } = await nav();
      const toggle = container.querySelector('.aal-nav__toggle')!;
      const controlled = container.querySelector(`[id="${toggle.getAttribute('aria-controls')}"]`);

      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(controlled?.tagName, 'the toggle controls something other than the one list').toBe('UL');
      expect(container.querySelectorAll('.aal-nav__list')).toHaveLength(1);
    });
  });
});

describe('AalMenu (APG Menu Button)', () => {
  const MENU_ITEMS = [
    { value: 'rename', label: 'Rename' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'archive', label: 'Archive', disabled: true },
    { value: 'delete', label: 'Delete', separatorBefore: true },
  ];

  const menu = () =>
    setup(`<aal-menu label="Actions" [items]="items" (selected)="onSelect($event)" />`, {
      items: MENU_ITEMS,
      onSelect: () => undefined,
    });

  describe('ADR-0005 — a menu of ACTIONS is where role="menu" is correct', () => {
    it('exposes role="menu" when open', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();

      await user.click(screen.getByRole('button', { name: /Actions/ }));
      fixture.detectChanges();

      expect(screen.getByRole('menu')).toBeTruthy();
    });

    it('exposes each entry as a menuitem, not a link', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();

      await user.click(screen.getByRole('button', { name: /Actions/ }));
      fixture.detectChanges();

      expect(screen.getAllByRole('menuitem')).toHaveLength(4);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });
  });

  describe('trigger semantics (SC 4.1.2)', () => {
    it('declares aria-haspopup="menu"', async () => {
      await menu();
      expect(screen.getByRole('button', { name: /Actions/ }).getAttribute('aria-haspopup')).toBe('menu');
    });

    it('reports aria-expanded', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();
      const trigger = screen.getByRole('button', { name: /Actions/ });

      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      await user.click(trigger);
      fixture.detectChanges();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('does not reference a menu that does not exist', async () => {
      // A dangling aria-controls looks correct in markup and resolves to
      // nothing for assistive technology.
      await menu();
      expect(screen.getByRole('button', { name: /Actions/ }).hasAttribute('aria-controls')).toBe(false);
    });

    it('REMOVES the menu from the DOM when closed', async () => {
      await menu();
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('Down Arrow on the trigger — opens and focuses the first item', () => {
    it('focuses the first item', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();
      screen.getByRole('button', { name: /Actions/ }).focus();

      await user.keyboard('{ArrowDown}');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Rename' }));
    });
  });

  describe('Up Arrow on the trigger — opens and focuses the last item', () => {
    it('focuses the last item', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();
      screen.getByRole('button', { name: /Actions/ }).focus();

      await user.keyboard('{ArrowUp}');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));
    });
  });

  describe('Escape — closes and returns focus to the trigger', () => {
    it('returns focus, never leaving it on a removed element', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();
      const trigger = screen.getByRole('button', { name: /Actions/ });
      trigger.focus();

      await user.keyboard('{ArrowDown}');
      fixture.detectChanges();
      await fixture.whenStable();

      await user.keyboard('{Escape}');
      fixture.detectChanges();

      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  describe('Enter — activates the focused item', () => {
    it('emits its value and closes', async () => {
      const user = userEvent.setup();
      const chosen: string[] = [];
      const { fixture } = await setup(
        `<aal-menu label="Actions" [items]="items" (selected)="onSelect($event)" />`,
        { items: MENU_ITEMS, onSelect: (v: string) => chosen.push(v) },
      );

      screen.getByRole('button', { name: /Actions/ }).focus();
      await user.keyboard('{ArrowDown}');
      fixture.detectChanges();
      await fixture.whenStable();

      await user.keyboard('{Enter}');
      fixture.detectChanges();

      expect(chosen).toEqual(['rename']);
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('a disabled item cannot be activated', async () => {
      const user = userEvent.setup();
      const chosen: string[] = [];
      const { fixture } = await setup(
        `<aal-menu label="Actions" [items]="items" (selected)="onSelect($event)" />`,
        { items: MENU_ITEMS, onSelect: (v: string) => chosen.push(v) },
      );

      await user.click(screen.getByRole('button', { name: /Actions/ }));
      fixture.detectChanges();
      await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
      fixture.detectChanges();

      expect(chosen).toEqual([]);
    });
  });

  describe('roving tabindex — the menu is a single tab stop', () => {
    it('gives exactly one item tabindex="0"', async () => {
      const user = userEvent.setup();
      const { fixture } = await menu();

      await user.click(screen.getByRole('button', { name: /Actions/ }));
      fixture.detectChanges();

      const stops = screen.getAllByRole('menuitem').filter((i) => i.getAttribute('tabindex') === '0');
      expect(stops).toHaveLength(1);
    });
  });
});

describe('AalBreadcrumb (SC 2.4.8)', () => {
  const CRUMBS = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Keyboards' },
  ];

  const crumbs = () => setup(`<aal-breadcrumb [items]="items" />`, { items: CRUMBS });

  it('exposes a navigation landmark named Breadcrumb', async () => {
    await crumbs();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
  });

  it('uses an ORDERED list, so the depth is announced', async () => {
    const { container } = await crumbs();
    expect(container.querySelector('ol')).not.toBeNull();
  });

  it('renders ancestors as links', async () => {
    await crumbs();
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Products' })).toBeTruthy();
  });

  it('the CURRENT page is not a link', async () => {
    // A link to the page you are already on is announced as a link and does
    // nothing.
    await crumbs();
    expect(screen.queryByRole('link', { name: 'Keyboards' })).toBeNull();
  });

  it('marks the current page with aria-current', async () => {
    const { container } = await crumbs();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Keyboards');
  });

  it('never puts a separator in the content', async () => {
    // "/" between crumbs is read aloud as "slash" by a screen reader.
    const { container } = await crumbs();
    expect(container.querySelector('nav')?.textContent).not.toContain('/');
  });
});

describe('AalPagination (SC 2.4.7, 4.1.3)', () => {
  const pages = (props: Record<string, unknown> = {}) =>
    setup(`<aal-pagination [totalPages]="total" [page]="page" (pageChange)="onPage($event)" />`, {
      total: 12,
      page: 4,
      onPage: () => undefined,
      ...props,
    });

  it('exposes a navigation landmark named Pagination', async () => {
    await pages();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  });

  it('marks the current page with aria-current', async () => {
    await pages();
    expect(screen.getByRole('button', { name: 'Page 4' }).getAttribute('aria-current')).toBe('page');
  });

  it('names each page button unambiguously', async () => {
    // "4" alone is not a usable accessible name out of context.
    await pages();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 12' })).toBeTruthy();
  });

  it('always offers the first and last page, so either end is one press away', async () => {
    await pages();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Page 12' })).toBeTruthy();
  });

  it('announces an elision in words, not only as an ellipsis glyph', async () => {
    const { container } = await pages();
    expect(container.textContent).toContain('skipping pages');
  });

  describe('Previous and Next stay FOCUSABLE when unavailable', () => {
    it('uses aria-disabled rather than the native attribute', async () => {
      // Pressing Previous to reach page 1 would otherwise make the button the
      // user is standing on unfocusable at that exact moment, dropping focus
      // to <body>.
      await pages({ page: 1 });
      const previous = screen.getByRole('button', { name: /Previous/ });

      expect(previous.getAttribute('aria-disabled')).toBe('true');
      expect(previous.hasAttribute('disabled')).toBe(false);
    });

    it('refuses to move past the first page', async () => {
      const user = userEvent.setup();
      const seen: number[] = [];
      await pages({ page: 1, onPage: (p: number) => seen.push(p) });

      await user.click(screen.getByRole('button', { name: /Previous/ }));

      expect(seen).toEqual([]);
    });

    it('refuses to move past the last page', async () => {
      const user = userEvent.setup();
      const seen: number[] = [];
      await pages({ page: 12, onPage: (p: number) => seen.push(p) });

      await user.click(screen.getByRole('button', { name: /Next/ }));

      expect(seen).toEqual([]);
    });
  });

  it('reports the new page when one is chosen', async () => {
    const user = userEvent.setup();
    const seen: number[] = [];
    await pages({ onPage: (p: number) => seen.push(p) });

    await user.click(screen.getByRole('button', { name: 'Page 12' }));

    expect(seen).toEqual([12]);
  });

  it('keeps focus on the pressed control (SC 3.2.2)', async () => {
    // Moving focus into the results would take a user stepping through several
    // pages away from the control they are using, every time.
    const user = userEvent.setup();
    const { fixture } = await pages();
    const target = screen.getByRole('button', { name: 'Page 5' });

    await user.click(target);
    fixture.detectChanges();

    expect(document.activeElement).toBe(target);
  });
});

describe('axe — every documented state (TR-01)', () => {
  const states: [string, string, Record<string, unknown>][] = [
    ['nav collapsed', `<aal-nav label="Primary" [items]="items" />`, { items: NAV_ITEMS }],
    [
      'nav single level',
      `<aal-nav label="Utility" [items]="items" />`,
      { items: [{ label: 'Sign in', href: '/sign-in' }] },
    ],
    [
      'menu closed',
      `<aal-menu label="Actions" [items]="items" />`,
      { items: [{ value: 'a', label: 'Rename' }] },
    ],
    [
      'menu disabled',
      `<aal-menu label="Actions" [items]="items" [disabled]="true" />`,
      { items: [{ value: 'a', label: 'Rename' }] },
    ],
    [
      'breadcrumb',
      `<aal-breadcrumb [items]="items" />`,
      { items: [{ label: 'Home', href: '/' }, { label: 'Here' }] },
    ],
    ['pagination', `<aal-pagination [totalPages]="12" [page]="4" />`, {}],
    ['pagination first page', `<aal-pagination [totalPages]="12" [page]="1" />`, {}],
    ['pagination single page', `<aal-pagination [totalPages]="1" [page]="1" />`, {}],
  ];

  it.each(states)('is clean: %s', async (name, template, props) => {
    const { container } = await setup(template, props);
    await expectNoA11yViolations(container, name);
  });

  it('is clean with a nav submenu open', async () => {
    const user = userEvent.setup();
    const { container, fixture } = await setup(`<aal-nav label="Primary" [items]="items" />`, {
      items: NAV_ITEMS,
    });

    await user.click(screen.getByRole('button', { name: /Products/ }));
    fixture.detectChanges();

    await expectNoA11yViolations(container, 'nav submenu open');
  });

  it('is clean with a menu open', async () => {
    const user = userEvent.setup();
    const { container, fixture } = await setup(`<aal-menu label="Actions" [items]="items" />`, {
      items: [
        { value: 'a', label: 'Rename' },
        { value: 'b', label: 'Archive', disabled: true },
        { value: 'c', label: 'Delete', separatorBefore: true },
      ],
    });

    await user.click(screen.getByRole('button', { name: /Actions/ }));
    fixture.detectChanges();

    await expectNoA11yViolations(container, 'menu open');
  });
});
