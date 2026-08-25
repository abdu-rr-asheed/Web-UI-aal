import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { AriaIdService } from '@aal/a11y-core';

/** When moving focus between tabs also changes which panel is shown. */
export type AalTabsActivation = 'manual' | 'automatic';

/** What a tab-specific keypress asked the tab list to do. */
export type TabsIntent =
  | { kind: 'none' }
  | { kind: 'select'; index: number }
  | { kind: 'close'; index: number; focusIndex: number };

/**
 * Tabs state machine (PRD §9.7, APG Tabs).
 *
 * A plain injectable holding no DOM, for the same reason as
 * `AalListboxState`: the styled layer, an overlay, or a test can drive it
 * without a host element in between.
 *
 * ## What this owns, and what it deliberately does not
 *
 * Arrow keys, `Home`/`End`, RTL inversion and the roving `tabindex` itself are
 * NOT here. They belong to `AalRovingTabindex` in L2, which every composite
 * widget in the library already shares — a tab list is not special in how it
 * moves focus, only in what moving focus MEANS. Re-implementing the arrow
 * model here would put "which key moves focus in a composite" in two places,
 * which is exactly the duplication the layer split exists to prevent.
 *
 * Likewise `Enter` and `Space`: each tab is a real `<button>`, so the platform
 * fires `click` for both. Intercepting them would replace working platform
 * behaviour with a hand-written imitation of it.
 *
 * What is genuinely tab-specific, and therefore lives here:
 *
 *   - the **activation policy** — whether moving focus also selects
 *   - the **id relationship** between each tab and its panel
 *   - **closing** a tab, and where focus goes afterwards
 *
 * ## Why manual activation is the default (ADR-0008)
 *
 * Under automatic activation, arrowing from the first tab to the fourth
 * renders three panels the user never asked for. A screen-reader user hears
 * each panel announced as they pass through it, so reaching the tab they want
 * means listening to three interruptions first; if a panel loads data, it also
 * means three requests. Manual activation makes arrowing a pure navigation
 * act, and `Enter` the commitment.
 *
 * The APG permits automatic activation only when "it is possible for panel
 * content to be displayed instantly", so this is opt-in with the condition
 * stated rather than a default with the condition ignored.
 */
@Injectable()
export class AalTabsState {
  private readonly ids = inject(AriaIdService);

  /** Base for tab and panel ids, so a page may hold several tab lists. */
  readonly baseId = this.ids.next('aal-tabs');

  private readonly countState = signal(0);
  private readonly disabledState = signal<ReadonlySet<number>>(new Set());
  private readonly selectedState = signal(0);
  private readonly activationState = signal<AalTabsActivation>('manual');

  readonly count: Signal<number> = this.countState.asReadonly();
  readonly selectedIndex: Signal<number> = this.selectedState.asReadonly();
  readonly activation: Signal<AalTabsActivation> = this.activationState.asReadonly();

  /** Indices the user can actually reach. Disabled tabs are skipped, per APG. */
  readonly enabledIndices = computed(() =>
    Array.from({ length: this.countState() }, (_, i) => i).filter((i) => !this.disabledState().has(i)),
  );

  tabId(index: number): string {
    return `${this.baseId}-tab-${index}`;
  }

  panelId(index: number): string {
    return `${this.baseId}-panel-${index}`;
  }

  isSelected(index: number): boolean {
    return this.selectedState() === index;
  }

  isDisabled(index: number): boolean {
    return this.disabledState().has(index);
  }

  setActivation(activation: AalTabsActivation): void {
    this.activationState.set(activation);
  }

  /**
   * Declare the tab set.
   *
   * Selection is re-resolved rather than preserved blindly: a tab list whose
   * tabs changed underneath it must not be left pointing at an index that no
   * longer exists, or at one that has since become disabled — in either case
   * `aria-selected` would be true on nothing, and the panel region would have
   * no labelling tab.
   */
  setTabs(count: number, disabled: readonly number[] = []): void {
    this.countState.set(count);
    this.disabledState.set(new Set(disabled));
    this.selectedState.set(this.resolveSelectable(this.selectedState()));
  }

  /** Select `index`, if it can be selected. Disabled tabs are refused. */
  select(index: number): void {
    if (index < 0 || index >= this.countState() || this.disabledState().has(index)) return;
    this.selectedState.set(index);
  }

  /**
   * Focus moved to `index` — usually by an arrow key.
   *
   * Under manual activation this changes nothing, which is the whole point:
   * the user is looking, not choosing.
   */
  focusMoved(index: number): void {
    if (this.activationState() === 'automatic') this.select(index);
  }

  /**
   * `Delete` on a closeable tab (PRD §9.7 keyboard row).
   *
   * The only key this state machine claims, because it is the only one with no
   * platform or L2 equivalent. It returns an intent rather than mutating: the
   * tab set belongs to whoever supplied it, so removal is the caller's to
   * perform.
   */
  handleKey(event: KeyboardEvent, index: number, closeable: boolean): TabsIntent {
    if (event.key !== 'Delete' || !closeable || this.disabledState().has(index)) return { kind: 'none' };
    return { kind: 'close', index, focusIndex: this.focusAfterClose(index) };
  }

  /**
   * Where focus goes after tab `index` is closed.
   *
   * Deleting the tab that currently has focus destroys the focused element. If
   * nothing claims focus afterwards it falls to `<body>`, and a keyboard user
   * is silently dumped at the top of the document — the same failure the
   * dialog's restore chain exists to prevent, arriving by a different route.
   *
   * The neighbour rule is the APG's: prefer the following tab, fall back to
   * the preceding one, because closing the last tab in a list must not leave
   * focus pointing past the end of it.
   */
  focusAfterClose(index: number): number {
    const remaining = this.enabledIndices().filter((i) => i !== index);
    if (remaining.length === 0) return -1;

    const next = remaining.find((i) => i > index);
    const target = next ?? remaining.at(-1)!;

    // Indices above the closed one shift down by one once it is gone.
    return target > index ? target - 1 : target;
  }

  /** Nearest selectable index at or after `preferred`, else the first enabled one. */
  private resolveSelectable(preferred: number): number {
    const enabled = this.enabledIndices();
    if (enabled.length === 0) return -1;
    if (enabled.includes(preferred)) return preferred;
    return enabled.find((i) => i > preferred) ?? enabled[0]!;
  }
}
