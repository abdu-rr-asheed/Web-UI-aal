import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AriaIdService } from '@aal/a11y-core';
import { AalDisclosureSet } from '@aal/primitives/disclosure';

export interface AalNavItem {
  readonly label: string;
  /** Omit for an item that only opens a submenu. */
  readonly href?: string;
  /** Marks this item as the page currently being viewed (SC 2.4.8). */
  readonly current?: boolean;
  readonly children?: readonly AalNavItem[];
}

/**
 * Site navigation (PRD §9.6, APG **Disclosure Navigation Menu**).
 *
 * ## This is deliberately NOT `role="menu"` — ADR-0005
 *
 * The most consequential decision in this component is the one it does not
 * make. Site navigation built with `role="menu"`/`role="menuitem"` is one of
 * the most widespread ARIA misuses on the web, and it is actively harmful:
 *
 *   - `role="menu"` tells the screen reader "this is an application menu", so
 *     it switches out of browse mode into application mode. The reading keys
 *     the user navigates the rest of the page with stop working inside it.
 *   - `role="menuitem"` **overrides** the link role. The user is no longer told
 *     these are links, so nothing suggests activating one will navigate — and
 *     "list all links on this page", one of the primary ways screen-reader
 *     users orient themselves, stops finding the site's own navigation.
 *   - The list stops being announced as a list, so its length is lost.
 *
 * What is given up in exchange is a keyboard model borrowed from desktop menu
 * bars that nobody asked navigation to have. Site navigation is a list of
 * links; native list and link semantics plus `aria-expanded` on the submenu
 * triggers describe it exactly, and every screen-reader convention keeps
 * working.
 *
 * `role="menu"` IS correct for a menu of actions, and AAL uses it there — see
 * `AalMenu` in `@aal/components/menu`. The two patterns look alike on screen
 * and are entirely different to a screen-reader user.
 *
 * ## Focus model
 *
 * Standard document tab order, not roving `tabindex`. That is the right answer
 * for navigation specifically: a screen-reader user expects to reach every
 * link by the same means as every other link on the page, and a composite
 * widget with one tab stop would hide them from exactly that. `AalTabs` makes
 * the opposite choice because a tab list is a single control, not a set of
 * destinations.
 *
 * ## Responsive behaviour: one implementation
 *
 * Below the breakpoint the same list collapses behind a disclosure trigger.
 * There is no separate mobile markup — the same `<ul>`, the same links, the
 * same `aria-current`. A parallel mobile implementation is how sites end up
 * with navigation that is accessible at one viewport and not the other, and
 * with only one of the two ever tested.
 */
@Component({
  selector: 'aal-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AalDisclosureSet],
  styleUrl: './nav.css',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <nav class="aal-nav" [attr.aria-label]="label()">
      <!--
        Visible only below the breakpoint, via display:none — which removes it
        from the accessibility tree as well as the screen, so its
        aria-expanded is never announced at a viewport where it means nothing.
      -->
      <button
        type="button"
        class="aal-nav__toggle"
        [attr.aria-expanded]="collapsedOpen()"
        [attr.aria-controls]="listId"
        (click)="collapsedOpen.set(!collapsedOpen())"
      >
        <span class="aal-nav__toggle-icon" aria-hidden="true">☰</span>
        Menu
      </button>

      <ul
        class="aal-nav__list"
        [attr.id]="listId"
        [class.aal-nav__list--open]="collapsedOpen()"
      >
        @for (item of items(); track item.label; let i = $index) {
          <li class="aal-nav__item">
            @if (item.children && item.children.length > 0) {
              <button
                type="button"
                class="aal-nav__trigger"
                [attr.id]="set.triggerId(i)"
                [attr.aria-expanded]="set.isOpen(i)"
                [attr.aria-controls]="set.panelId(i)"
                (click)="set.toggle(i)"
              >
                {{ item.label }}
                <span class="aal-nav__marker" aria-hidden="true">{{ set.isOpen(i) ? '▴' : '▾' }}</span>
              </button>

              @if (set.isOpen(i)) {
                <!--
                  Removed from the DOM when collapsed rather than hidden with
                  CSS. height:0 and visibility:hidden both leave submenu links
                  in the accessibility tree, so a screen-reader user reads
                  links inside a submenu the trigger reports as closed.
                -->
                <ul
                  class="aal-nav__submenu"
                  [attr.id]="set.panelId(i)"
                  [attr.aria-labelledby]="set.triggerId(i)"
                >
                  @for (child of item.children; track child.label) {
                    <li>
                      <a
                        class="aal-nav__link"
                        [attr.href]="child.href"
                        [attr.aria-current]="child.current ? 'page' : null"
                        >{{ child.label }}</a
                      >
                    </li>
                  }
                </ul>
              }
            } @else {
              <a
                class="aal-nav__link"
                [attr.href]="item.href"
                [attr.aria-current]="item.current ? 'page' : null"
                >{{ item.label }}</a
              >
            }
          </li>
        }
      </ul>
    </nav>
  `,
})
export class AalNav {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ids = inject(AriaIdService);

  protected readonly set = inject(AalDisclosureSet);
  protected readonly listId = this.ids.next('aal-nav-list');

  /**
   * Accessible name for the landmark. Required, and required to be unique on
   * the page: two unnamed `<nav>` landmarks are indistinguishable in a screen
   * reader's landmark list, which is how the landmark is most often reached.
   */
  readonly label = input.required<string>();

  readonly items = input.required<readonly AalNavItem[]>();

  /** Collapsed-viewport disclosure state. */
  protected readonly collapsedOpen = signal(false);

  constructor() {
    // One submenu open at a time. Two open submenus at a narrow viewport push
    // the rest of the navigation off-screen, and there is no reading benefit
    // to the second one being open.
    effect(() => this.set.setMultiple(false));
  }

  /**
   * `Escape` and the submenu arrow keys (PRD §9.6 keyboard row).
   *
   * `Enter` and `Space` are not handled: every trigger is a real `<button>`,
   * so the platform already fires `click` for both. `Tab` is not handled
   * either — moving through navigation with `Tab` is exactly the behaviour
   * this pattern exists to preserve.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeOpenSubmenu();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      this.moveWithinSubmenu(event);
    }
  }

  /**
   * Close the open submenu and put focus back on its trigger.
   *
   * Returning focus matters more than closing does. The submenu the user is
   * standing in is about to be removed from the DOM; without an explicit
   * restore, focus falls to `<body>` and a keyboard user is dropped at the top
   * of the document with no indication of what happened.
   */
  private closeOpenSubmenu(): void {
    const open = [...this.set.openIndices()][0];
    if (open === undefined) {
      // No submenu open — Escape closes the collapsed-viewport panel instead,
      // so there is always a way out of an expanded navigation.
      if (this.collapsedOpen()) {
        this.collapsedOpen.set(false);
        this.focusById(this.host.nativeElement.querySelector('.aal-nav__toggle'));
      }
      return;
    }

    this.set.close(open);
    // An attribute selector rather than `#id`: CSS.escape is not available in
    // every DOM implementation the test and SSR environments use, and an
    // AriaIdService id needs no escaping in the first place.
    this.focusById(this.host.nativeElement.querySelector(`[id="${this.set.triggerId(open)}"]`));
  }

  /**
   * `↓`/`↑` inside an open submenu, and `↓` from a trigger into its submenu.
   *
   * Optional in the APG pattern and implemented because the PRD's keyboard
   * table lists it: without it, reaching the fourth item of an open submenu
   * needs four `Tab` presses that also pass through the trigger of the next
   * top-level item.
   *
   * Arrows are NOT bound at the top level. Doing so would make navigation
   * behave like a menubar, which is the application-menu model this component
   * exists to avoid.
   */
  private moveWithinSubmenu(event: KeyboardEvent): void {
    const active = event.target as HTMLElement | null;
    const submenu = active && this.submenuInPlay(active, event.key);
    if (!active || !submenu) return;

    const links = Array.from(submenu.querySelectorAll<HTMLElement>('a[href]'));
    const current = links.indexOf(active);

    // From the trigger (current === -1) ArrowDown lands on the first link.
    const next = current === -1 ? 0 : current + (event.key === 'ArrowDown' ? 1 : -1);
    const target = links[next];
    if (!target) return;

    event.preventDefault();
    target.focus();
  }

  /**
   * Which submenu the arrow key applies to.
   *
   * Two cases: focus is already inside a submenu, or focus is on a trigger and
   * ArrowDown is being used to enter its submenu. ArrowUp on a trigger does
   * nothing — moving up out of a trigger would land in the previous top-level
   * item, which is menubar behaviour rather than navigation behaviour.
   */
  private submenuInPlay(active: HTMLElement, key: string): HTMLElement | null {
    const inside = active.closest<HTMLElement>('.aal-nav__submenu');
    if (inside) return inside;
    if (key !== 'ArrowDown') return null;

    return active.closest('.aal-nav__item')?.querySelector<HTMLElement>('.aal-nav__submenu') ?? null;
  }

  /**
   * Focus leaving the navigation closes any open submenu.
   *
   * Without this, tabbing out of a submenu leaves it open behind the user:
   * a sighted keyboard user sees a panel with nothing in it focused, and a
   * screen-reader user browsing forward walks back into links they have
   * already passed.
   *
   * `relatedTarget` is null when focus leaves the document entirely, which
   * counts as leaving.
   */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.nativeElement.contains(next)) return;
    this.set.closeAll();
  }

  private focusById(el: Element | null): void {
    if (el instanceof HTMLElement) el.focus();
  }
}
