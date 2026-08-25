import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  afterRenderEffect,
  booleanAttribute,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AalRovingItem, AalRovingTabindex } from '@aal/a11y-core';
import { AalTabsState } from '@aal/primitives/tabs';
import type { AalTabsActivation } from '@aal/primitives/tabs';

/** Everything the browser will let hold focus. Ordered by DOM position. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * One tab and its panel.
 *
 * Declared as a child of `<aal-tabs>`, which reads the label to build the tab
 * list and hands back the ARIA wiring. Panel markup lives here so that
 * projected content stays in its author's template — a tabs component that
 * takes panel content as a string input cannot hold a form, which is most of
 * what tab panels are for (PRD §7.11 rule 4).
 */
@Component({
  selector: 'aal-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      The hidden ATTRIBUTE, not a CSS class. An unselected panel must be gone
      from the accessibility tree, not merely invisible: visibility:hidden and
      height:0 both leave the content readable in browse mode, so a
      screen-reader user reads panels the tab list says are not selected.
      It is also what the APG's own tabs example uses.

      The panel stays in the DOM rather than being removed, so scroll position
      and any component state inside it survive a round trip through another
      tab. Losing a half-completed form because the user glanced at a
      neighbouring tab is a real failure, and a far less obvious one than a
      panel that is merely hidden.
    -->
    <div
      #panel
      class="aal-tabs__panel"
      role="tabpanel"
      [attr.id]="panelId()"
      [attr.aria-labelledby]="tabId()"
      [attr.tabindex]="panelTabIndex()"
      [hidden]="!selected()"
    >
      <ng-content />
    </div>
  `,
})
export class AalTab {
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  /** Tab label. Becomes the tab's accessible name. */
  readonly label = input.required<string>();

  readonly disabled = input(false, { transform: booleanAttribute });

  /** Adds a close affordance and binds `Delete` (PRD §9.7). */
  readonly closeable = input(false, { transform: booleanAttribute });

  /** Emitted when the user closes this tab. */
  readonly closed = output<void>();

  /**
   * Wiring assigned by the parent `<aal-tabs>`.
   *
   * Plain signals rather than inputs: these are projected children, so the
   * parent has no template in which to bind them, and exposing them as inputs
   * would invite a consumer to set ids by hand — the exact thing
   * `AriaIdService` exists to prevent (PRD §7.11).
   */
  readonly tabId = signal('');
  readonly panelId = signal('');
  readonly selected = signal(false);

  private readonly needsTabStop = signal(false);

  /**
   * `tabindex="0"` on the panel ONLY when it holds nothing focusable.
   *
   * A panel of prose is not reachable by keyboard at all unless it is a tab
   * stop: the user tabs out of the tab list and straight past the content they
   * just selected, with no way to scroll it without a mouse. A panel
   * containing a form must NOT be a tab stop, or it becomes an extra press
   * before every field, forever.
   *
   * Measured from the rendered panel rather than declared by the author,
   * because whether the content is focusable is a property of the content —
   * asking authors to declare it is asking them to get it wrong, and to keep
   * getting it wrong as the content changes.
   */
  protected readonly panelTabIndex = computed(() => (this.needsTabStop() ? 0 : null));

  constructor() {
    // afterRenderEffect, not effect: the answer depends on rendered DOM, and
    // it must be re-measured whenever selection changes because projected
    // content can differ per panel. Does not run during SSR, so the server
    // renders no tabindex and the client adds it on hydration — an attribute
    // difference, not a structural one, so hydration is unaffected.
    afterRenderEffect(() => {
      const isSelected = this.selected();
      const panel = this.panel().nativeElement;
      this.needsTabStop.set(isSelected && panel.querySelector(FOCUSABLE_SELECTOR) === null);
    });
  }
}

/**
 * Tabs (PRD §9.7, APG Tabs).
 *
 * Composes `AalTabsState` for selection and activation policy, and
 * `AalRovingTabindex` for the single tab stop, arrow keys, `Home`/`End` and
 * RTL inversion. Neither is re-implemented here: this layer is markup and
 * styling over logic that already exists one layer down.
 *
 * ## Manual activation is the default (ADR-0008)
 *
 * `activation="automatic"` exists, and the docs state the condition the APG
 * attaches to it — only when panel content displays instantly. Under automatic
 * activation, arrowing from the first tab to the fourth renders three panels
 * the user never asked for, and a screen-reader user hears each announced on
 * the way past.
 *
 * ## Overflow at 320px (AR-17)
 *
 * The tab list wraps rather than scrolling horizontally. A horizontal
 * scroller is operable with a mouse and a trackpad and with nothing else: the
 * overflowed tabs are still reachable by arrow key, but a sighted keyboard
 * user cannot see where focus has gone. Wrapping costs vertical space and
 * keeps every tab visible, which is the better trade.
 */
@Component({
  selector: 'aal-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AalTabsState],
  imports: [AalRovingTabindex, AalRovingItem],
  styleUrl: './tabs.css',
  template: `
    <div class="aal-tabs" [class.aal-tabs--vertical]="orientation() === 'vertical'">
      <!--
        aria-orientation is announced, so the user learns which arrows to reach
        for before trying them rather than by trial and error.
      -->
      <div
        class="aal-tabs__list"
        role="tablist"
        [attr.aria-label]="label()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-orientation]="orientation()"
        [aalRovingTabindex]="TAB_SELECTOR"
        [orientation]="orientation()"
        (activeIndexChange)="onFocusMoved($event)"
      >
        @for (tab of tabs(); track tab; let i = $index) {
          <button
            type="button"
            role="tab"
            aalRovingItem
            class="aal-tabs__tab"
            [attr.id]="state.tabId(i)"
            [attr.aria-controls]="state.panelId(i)"
            [attr.aria-selected]="state.isSelected(i)"
            [attr.aria-disabled]="tab.disabled() ? 'true' : null"
            [class.aal-tabs__tab--selected]="state.isSelected(i)"
            (click)="onTabClick(i)"
            (keydown)="onTabKeydown($event, i)"
          >
            {{ tab.label() }}

            @if (tab.closeable()) {
              <!--
                Not a nested <button>: that would be a second tab stop inside a
                composite that must have exactly one. Closing is driven by the
                Delete key on the tab itself, and the instruction is announced
                rather than only drawn — an icon alone tells a screen-reader
                user nothing about which key to press.
              -->
              <span class="aal-tabs__close" aria-hidden="true">✕</span>
              <span class="aal-visually-hidden">, press Delete to close</span>
            }
          </button>
        }
      </div>

      <ng-content />
    </div>
  `,
})
export class AalTabs {
  protected readonly state = inject(AalTabsState);
  protected readonly TAB_SELECTOR = '[role="tab"]:not([aria-disabled="true"])';

  private readonly list = viewChild(AalRovingTabindex);
  protected readonly tabs = contentChildren(AalTab);

  /** Accessible name for the tab list. Required unless `labelledBy` is given. */
  readonly label = input<string | null>(null);
  readonly labelledBy = input<string | null>(null);

  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');

  /** `manual` (default) or `automatic`. Read ADR-0008 before changing it. */
  readonly activation = input<AalTabsActivation>('manual');

  /** Two-way bindable index of the selected tab. */
  readonly selectedIndex = model(0);

  private readonly disabledIndices: Signal<number[]> = computed(() =>
    this.tabs()
      .map((tab, i) => (tab.disabled() ? i : -1))
      .filter((i) => i !== -1),
  );

  constructor() {
    // The tab set is content-projected, so it is known only once content has
    // been resolved, and may change at any point afterwards.
    effect(() => {
      this.state.setTabs(this.tabs().length, this.disabledIndices());
      this.state.setActivation(this.activation());
    });

    // Consumer -> state.
    effect(() => this.state.select(this.selectedIndex()));

    /**
     * State -> consumer, and state -> projected children.
     *
     * The state machine may refuse or re-resolve a selection — a disabled
     * index, or one that no longer exists — so the consumer's binding must
     * reflect what actually happened rather than what was asked for.
     * Otherwise `aria-selected` is true on nothing and the panel region has
     * no labelling tab.
     */
    effect(() => {
      const resolved = this.state.selectedIndex();
      if (resolved !== -1 && resolved !== this.selectedIndex()) this.selectedIndex.set(resolved);

      this.tabs().forEach((tab, i) => {
        tab.tabId.set(this.state.tabId(i));
        tab.panelId.set(this.state.panelId(i));
        tab.selected.set(resolved === i);
      });
    });

    // Roving tabindex is a DOM property of elements the @for block renders, so
    // it can only be applied once they exist.
    afterRenderEffect(() => {
      this.tabs();
      this.state.selectedIndex();
      this.list()?.syncTabindex();
    });
  }

  protected onTabClick(index: number): void {
    this.state.select(index);
    this.selectedIndex.set(this.state.selectedIndex());
  }

  /**
   * `Delete` on a closeable tab. Every other key belongs to someone else:
   * arrows and `Home`/`End` to `AalRovingTabindex`, `Enter` and `Space` to the
   * native button, which fires `click` for both.
   */
  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    const tab = this.tabs()[index];
    const intent = this.state.handleKey(event, index, tab?.closeable() ?? false);
    if (intent.kind !== 'close') return;

    event.preventDefault();
    tab?.closed.emit();

    // The element the user is standing on is about to be removed. Focus has to
    // land somewhere deliberate, or it falls to <body> and a keyboard user
    // silently loses their place.
    if (intent.focusIndex !== -1) this.list()?.focusItem(intent.focusIndex);
  }

  /** Arrow keys moved focus. Under manual activation this selects nothing. */
  protected onFocusMoved(index: number): void {
    this.state.focusMoved(index);
    this.selectedIndex.set(this.state.selectedIndex());
  }
}
