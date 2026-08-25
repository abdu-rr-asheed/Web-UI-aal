import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { AriaIdService, TypeaheadService } from '@aal/a11y-core';

export interface AalMenuItem {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  /** Renders a separator BEFORE this item. Separators are not focusable. */
  readonly separatorBefore?: boolean;
}

/** What a keypress asked the menu to do. */
export type MenuIntent =
  | { kind: 'none' }
  /** Open and put focus on `index` — `↓` lands on the first item, `↑` on the last. */
  | { kind: 'open'; index: number }
  | { kind: 'close'; returnFocus: boolean }
  | { kind: 'focus'; index: number }
  | { kind: 'activate'; index: number };

/**
 * Menu Button state machine (PRD §9.9, APG Menu Button).
 *
 * ## Why `role="menu"` is correct HERE and wrong for site navigation
 *
 * This is the one pattern in AAL that genuinely is an application menu: a
 * button that opens a list of *actions*, each of which does something to the
 * current page rather than navigating away from it. That is what
 * `role="menu"` describes, and a screen reader switching into application mode
 * for it is the right outcome — the user is operating a control, not reading
 * a document.
 *
 * Site navigation is the opposite case and uses `AalDisclosureSet` instead.
 * The two patterns look similar on screen and are completely different to a
 * screen-reader user; conflating them is the single most common ARIA misuse in
 * navigation code. ADR-0005 records the distinction.
 *
 * ## Focus model: real DOM focus, not `aria-activedescendant`
 *
 * The opposite choice from `AalListboxState`, deliberately. A menu has no text
 * input to keep the caret in, and the APG menu model expects focus to move
 * onto the item so that `Enter` activates whatever the user is standing on.
 * Roving `tabindex` via `AalRovingTabindex` realises that; this state machine
 * only decides where focus should go.
 *
 * Every branch below is a row of the APG Menu Button interaction table.
 */
@Injectable()
export class AalMenuState {
  private readonly ids = inject(AriaIdService);
  private readonly typeahead = inject(TypeaheadService);

  readonly menuId = this.ids.next('aal-menu');
  readonly triggerId = this.ids.next('aal-menu-trigger');

  private readonly openState = signal(false);
  private readonly itemsState = signal<readonly AalMenuItem[]>([]);
  private readonly activeIndexState = signal(-1);

  readonly isOpen: Signal<boolean> = this.openState.asReadonly();
  readonly items: Signal<readonly AalMenuItem[]> = this.itemsState.asReadonly();
  readonly activeIndex: Signal<number> = this.activeIndexState.asReadonly();

  /** Indices the user can actually reach. Disabled items are skipped, per APG. */
  readonly enabledIndices = computed(() =>
    this.itemsState()
      .map((item, i) => (item.disabled ? -1 : i))
      .filter((i) => i !== -1),
  );

  itemId(index: number): string {
    return `${this.menuId}-item-${index}`;
  }

  setItems(items: readonly AalMenuItem[]): void {
    this.itemsState.set(items);
  }

  setActive(index: number): void {
    this.activeIndexState.set(index);
  }

  open(index: number): void {
    this.openState.set(true);
    this.activeIndexState.set(index);
  }

  close(): void {
    this.openState.set(false);
    this.activeIndexState.set(-1);
    this.typeahead.reset();
  }

  /** First and last ENABLED item, for `↓`/`↑` on the trigger and `Home`/`End`. */
  firstIndex(): number {
    return this.enabledIndices()[0] ?? -1;
  }

  lastIndex(): number {
    return this.enabledIndices().at(-1) ?? -1;
  }

  handleKey(event: KeyboardEvent): MenuIntent {
    return this.openState() ? this.keyWhenOpen(event) : this.keyWhenClosed(event);
  }

  /**
   * APG Menu Button, collapsed.
   *
   * `↓` opens on the FIRST item and `↑` on the LAST. That asymmetry is not
   * decoration: it is how a keyboard user reaches "Delete", conventionally the
   * last entry, in one keystroke instead of arrowing past everything above it.
   */
  private keyWhenClosed(event: KeyboardEvent): MenuIntent {
    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        return { kind: 'open', index: this.firstIndex() };
      case 'ArrowUp':
        return { kind: 'open', index: this.lastIndex() };
      default:
        return { kind: 'none' };
    }
  }

  /** APG Menu Button, expanded. */
  private keyWhenOpen(event: KeyboardEvent): MenuIntent {
    return (
      this.movementIntent(event) ?? this.commitIntent(event) ?? this.typeaheadIntent(event)
    );
  }

  /**
   * `↑`/`↓`/`Home`/`End`.
   *
   * Arrows WRAP, per the APG: a menu is a closed set of choices, and wrapping
   * means the last item is always one keystroke from the first. `Home`/`End`
   * are handled here rather than left to `AalRovingTabindex` because the
   * enabled-item set is this state machine's to know.
   */
  private movementIntent(event: KeyboardEvent): MenuIntent | null {
    const enabled = this.enabledIndices();
    if (enabled.length === 0) return null;

    if (event.key === 'Home') return { kind: 'focus', index: enabled[0]! };
    if (event.key === 'End') return { kind: 'focus', index: enabled.at(-1)! };

    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return null;

    const position = enabled.indexOf(this.activeIndexState());
    const next = (position + delta + enabled.length) % enabled.length;
    return { kind: 'focus', index: enabled[next]! };
  }

  /** `Enter`, `Space`, `Escape`, `Tab` — the keys that end the interaction. */
  private commitIntent(event: KeyboardEvent): MenuIntent | null {
    if (event.key === 'Enter' || event.key === ' ') {
      const active = this.activeIndexState();
      return active === -1 ? { kind: 'none' } : { kind: 'activate', index: active };
    }

    // Escape closes and hands focus back to the trigger, so the user resumes
    // exactly where they opened from rather than at the top of the document.
    if (event.key === 'Escape') return { kind: 'close', returnFocus: true };

    // Tab closes and moves on. Focus is NOT returned: the user asked to leave,
    // and pulling focus back to the trigger would trap them in the control
    // they are escaping.
    if (event.key === 'Tab') return { kind: 'close', returnFocus: false };

    return null;
  }

  private typeaheadIntent(event: KeyboardEvent): MenuIntent {
    if (event.ctrlKey || event.metaKey || event.altKey) return { kind: 'none' };

    // Disabled items are given an unmatchable label rather than removed, so a
    // match still reports the index of the item at that position.
    const labels = this.itemsState().map((item) => (item.disabled ? ' ' : item.label));
    const match = this.typeahead.type(event.key, labels, this.activeIndexState());

    return match === null ? { kind: 'none' } : { kind: 'focus', index: match };
  }
}
