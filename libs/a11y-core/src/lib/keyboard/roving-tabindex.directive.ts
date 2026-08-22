import { Directive, ElementRef, InputSignal, Signal, inject, input, output, signal } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

/**
 * Single-tab-stop composite navigation (AR-04 / SC 2.4.3).
 *
 * A composite widget — tab list, radio group, menu, toolbar, grid — must be
 * ONE tab stop. Ten tabs to cross a tab list is not a style preference; for a
 * switch-access user, where each activation is a deliberate physical effort,
 * it is the difference between usable and not.
 *
 * Implements roving `tabindex`: exactly one item carries `tabindex="0"`, every
 * other carries `-1`, and arrow keys move which one. The alternative technique
 * is `aria-activedescendant` — see ActiveDescendantDirective for when that one
 * is correct instead.
 *
 * RTL is handled (FR-13): in a right-to-left layout, ArrowRight moves to the
 * PREVIOUS item, because "next" is to the left. Forgetting this is one of the
 * most common RTL accessibility bugs, and it is invisible to any LTR test.
 */
@Directive({
  selector: '[aalRovingTabindex]',
  standalone: true,
  exportAs: 'aalRovingTabindex',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusIn($event)',
  },
})
export class AalRovingTabindex {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dir = inject(Directionality, { optional: true });

  /** CSS selector identifying the navigable items within the host. */
  readonly itemSelector: InputSignal<string> = input('[aalRovingItem]', { alias: 'aalRovingTabindex' });

  /** Which arrow keys navigate. `both` is for grids and wrapping menus. */
  readonly orientation: InputSignal<RovingOrientation> = input<RovingOrientation>('horizontal');

  /** Wrap from last to first. APG default for most patterns. */
  readonly wrap: InputSignal<boolean> = input(true);

  /** Emits the newly active index whenever it changes. */
  readonly activeIndexChange = output<number>();

  private readonly activeIndexState = signal(0);
  readonly activeIndex: Signal<number> = this.activeIndexState.asReadonly();

  private get isRtl(): boolean {
    return this.dir?.value === 'rtl';
  }

  /** Enabled items, in DOM order. Disabled items are skipped, per APG. */
  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(this.itemSelector())).filter(
      (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
    );
  }

  /** Apply roving tabindex. Call after the item set changes. */
  syncTabindex(): void {
    const items = this.items();
    const active = Math.min(this.activeIndexState(), Math.max(items.length - 1, 0));
    items.forEach((el, i) => el.setAttribute('tabindex', i === active ? '0' : '-1'));
  }

  /** Move active to `index` and focus it. */
  focusItem(index: number): void {
    const items = this.items();
    if (items.length === 0) return;

    const clamped = this.wrap()
      ? (index + items.length) % items.length
      : Math.max(0, Math.min(index, items.length - 1));

    this.activeIndexState.set(clamped);
    this.syncTabindex();
    items[clamped]?.focus();
    this.activeIndexChange.emit(clamped);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.items();
    if (items.length === 0) return;

    const next = this.resolveTarget(event.key, this.activeIndexState(), items.length);
    if (next === null) return;

    // preventDefault only once we know the key is ours — swallowing Home/End
    // when we are not navigating would break page scrolling.
    event.preventDefault();
    this.focusItem(next);
  }

  /**
   * Map a key to the index it should move to, or null when the key is not ours.
   *
   * RTL inverts the HORIZONTAL arrows only (FR-13). Vertical arrows are
   * unaffected by writing direction; inverting those too is a subtle RTL bug
   * that no LTR test can catch.
   */
  private resolveTarget(key: string, current: number, count: number): number | null {
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;

    const delta = this.arrowDeltas()[key];
    return delta === undefined ? null : current + delta;
  }

  /**
   * Which arrow keys move, and by how much, for the current orientation and
   * writing direction.
   *
   * Built as a map rather than a conditional chain so the RTL rule is visible
   * in one place: only the HORIZONTAL arrows swap. Vertical arrows are
   * unaffected by writing direction, and inverting those too is a subtle RTL
   * bug that no left-to-right test can catch.
   */
  private arrowDeltas(): Record<string, number | undefined> {
    const orientation = this.orientation();
    const deltas: Record<string, number | undefined> = {};

    if (orientation === 'horizontal' || orientation === 'both') {
      deltas[this.isRtl ? 'ArrowLeft' : 'ArrowRight'] = 1;
      deltas[this.isRtl ? 'ArrowRight' : 'ArrowLeft'] = -1;
    }
    if (orientation === 'vertical' || orientation === 'both') {
      deltas['ArrowDown'] = 1;
      deltas['ArrowUp'] = -1;
    }

    return deltas;
  }

  /**
   * Keep the model in step when focus arrives by click or programmatically,
   * otherwise the next arrow press jumps from a stale index.
   */
  protected onFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const index = this.items().indexOf(target);
    if (index === -1 || index === this.activeIndexState()) return;

    this.activeIndexState.set(index);
    this.syncTabindex();
    this.activeIndexChange.emit(index);
  }
}

/** Marks an item navigable by AalRovingTabindex. */
@Directive({
  selector: '[aalRovingItem]',
  standalone: true,
  host: { '[attr.tabindex]': '-1' },
})
export class AalRovingItem {}
