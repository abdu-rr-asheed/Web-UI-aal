import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DismissService } from '@aal/a11y-core';
import { AalMenuState } from '@aal/primitives/menu';
import type { AalMenuItem } from '@aal/primitives/menu';

export type { AalMenuItem };

/**
 * Menu Button (PRD §9.9, APG Menu Button).
 *
 * A button that opens a list of **actions**. This is the one AAL pattern where
 * `role="menu"` is correct, and the contrast with `AalNav` is the point:
 *
 * | | `AalMenu` | `AalNav` |
 * |---|---|---|
 * | Contains | actions on the current page | links to other pages |
 * | Role | `menu` / `menuitem` | native list and link |
 * | Screen-reader mode | application | browse |
 * | Focus | roving, moves into the menu | standard document tab order |
 *
 * They look nearly identical on screen and are entirely different to a
 * screen-reader user. Using this component for site navigation would strip the
 * link role from every destination and remove the site's own navigation from
 * "list all links". ADR-0005 records the decision.
 *
 * ## Why the keyboard model is hand-wired rather than roving-tabindex
 *
 * `AalRovingTabindex` moves focus with arrows and clamps or wraps at the ends,
 * which is right for a tab list. A menu additionally needs typeahead, needs
 * `Escape` to close and restore focus, and needs `↑` on the CLOSED trigger to
 * open on the LAST item — none of which is composite-navigation behaviour.
 * `AalMenuState` owns that model as a testable state machine, and this layer
 * only realises its intents.
 */
@Component({
  selector: 'aal-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AalMenuState],
  styleUrl: './menu.css',
  template: `
    <div class="aal-menu">
      <button
        #trigger
        type="button"
        class="aal-menu__trigger"
        [attr.id]="state.triggerId"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-expanded]="state.isOpen()"
        [attr.aria-controls]="state.isOpen() ? state.menuId : null"
        [disabled]="disabled()"
        (click)="onTriggerClick()"
        (keydown)="onKeydown($event)"
      >
        {{ label() }}
        <span class="aal-menu__marker" aria-hidden="true">▾</span>
      </button>

      @if (state.isOpen()) {
        <!--
          Removed from the DOM when closed, not hidden with CSS: a closed menu
          must be gone from the accessibility tree, and aria-controls is only
          bound while the menu it names actually exists, so the reference can
          never dangle.

          No keydown handler on the container either. The menu never holds
          focus — the focused element is always a menuitem — so a handler here
          would be an interaction handler on something unfocusable, which is
          both an angular-eslint error and a real smell: it would fire for keys
          pressed anywhere inside, including in content a future variant might
          project. The handler lives on each item, where the focus actually is.
        -->
        <div
          #menu
          class="aal-menu__list"
          role="menu"
          [attr.id]="state.menuId"
          [attr.aria-labelledby]="state.triggerId"
        >
          @for (item of items(); track item.value; let i = $index) {
            @if (item.separatorBefore) {
              <!-- Announced as a group boundary; not focusable, and never the
                   only thing conveying that a group ended. -->
              <div class="aal-menu__separator" role="separator"></div>
            }

            <button
              type="button"
              role="menuitem"
              class="aal-menu__item"
              [attr.id]="state.itemId(i)"
              [attr.tabindex]="state.activeIndex() === i ? 0 : -1"
              [attr.aria-disabled]="item.disabled ? 'true' : null"
              (click)="activate(i)"
              (keydown)="onKeydown($event)"
            >
              {{ item.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class AalMenu {
  protected readonly state = inject(AalMenuState);
  private readonly dismiss = inject(DismissService);

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');

  /** Trigger label. Becomes the button's accessible name. */
  readonly label = input.required<string>();

  readonly items = input.required<readonly AalMenuItem[]>();

  readonly disabled = input(false, { transform: booleanAttribute });

  /** Emits the `value` of the chosen item. */
  readonly selected = output<string>();

  private layer: { dismiss(): void } | null = null;

  constructor() {
    effect(() => this.state.setItems(this.items()));

    /**
     * Focus follows the active index into the rendered menu.
     *
     * Real DOM focus, not `aria-activedescendant`: the APG menu model expects
     * the item itself to be focused, and there is no text input here whose
     * caret would be disturbed by moving focus — which is the reason
     * `AalListboxState` makes the opposite choice.
     *
     * `afterRenderEffect`, because the item to focus is created by the same
     * change that opened the menu and does not exist until it has rendered.
     */
    afterRenderEffect(() => {
      const index = this.state.activeIndex();
      if (!this.state.isOpen() || index === -1) return;

      const menu = this.menuRef()?.nativeElement;
      menu?.querySelectorAll<HTMLElement>('[role="menuitem"]')[index]?.focus();
    });

    /**
     * A pointer press outside the menu closes it, through the shared dismiss
     * stack rather than a private document listener. Escape is handled on the
     * component instead — see `onKeydown`.
     */
    effect((onCleanup) => {
      if (!this.state.isOpen()) return;

      const menu = this.menuRef()?.nativeElement;
      if (!menu) return;

      this.layer = this.dismiss.register(menu, {
        escape: false,
        onDismiss: () => this.close(false),
      });
      onCleanup(() => this.releaseLayer());
    });
  }

  protected onTriggerClick(): void {
    if (this.state.isOpen()) this.close(true);
    else this.state.open(this.state.firstIndex());
  }

  /**
   * Realise the state machine's intent. Every branch is a row of the APG Menu
   * Button interaction table; none of the decisions are made here.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const intent = this.state.handleKey(event);
    if (intent.kind === 'none') return;

    // Tab must keep moving focus onward — swallowing it would strand the user
    // in a control they asked to leave.
    if (event.key !== 'Tab') event.preventDefault();

    switch (intent.kind) {
      case 'open':
        this.state.open(intent.index);
        break;
      case 'focus':
        this.state.setActive(intent.index);
        break;
      case 'activate':
        this.activate(intent.index);
        break;
      case 'close':
        this.close(intent.returnFocus);
        break;
    }
  }

  protected activate(index: number): void {
    const item = this.items()[index];
    if (!item || item.disabled) return;

    this.selected.emit(item.value);

    // Focus returns to the trigger, always. The item the user activated is
    // about to be removed from the DOM, so leaving focus on it drops the
    // keyboard user onto <body> at the exact moment their action takes effect.
    this.close(true);
  }

  private close(returnFocus: boolean): void {
    this.releaseLayer();
    this.state.close();
    if (returnFocus) this.triggerRef().nativeElement.focus();
  }

  private releaseLayer(): void {
    this.layer?.dismiss();
    this.layer = null;
  }
}
