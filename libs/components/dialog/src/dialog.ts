import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { A11yAssertService, AalLiveAnnouncer, injectAalConfig } from '@aal/a11y-core';
import { AalDialogState, type DialogCloseReason } from '@aal/primitives/dialog';

/**
 * `dialog` vs `alertdialog`.
 *
 * `alertdialog` is for an urgent interruption the user must respond to before
 * continuing — a destructive confirmation, a session about to expire. Screen
 * readers treat it more assertively and announce the description immediately.
 *
 * Using it for an ordinary form dialog is the accessibility equivalent of
 * crying wolf: the extra urgency stops meaning anything.
 */
export type AalDialogVariant = 'dialog' | 'alertdialog';

export type AalDialogSize = 'small' | 'medium' | 'large';

/**
 * Modal dialog (PRD §9.5, APG Dialog (Modal)).
 *
 * Composes `AalDialogState`, which implements the focus sequence in PRD
 * Figure 3. Everything interesting about a dialog's accessibility lives in
 * that sequence; this component supplies the markup, the styling, and one
 * additional guarantee the primitive cannot make.
 *
 * ## Initial focus is never a destructive action
 *
 * The resolution order is `[aalFocusInitial]` → first tabbable → the container
 * itself. A confirmation dialog whose Delete button happens to be first in the
 * DOM would otherwise put focus on Delete, so a screen-reader user pressing
 * Enter to acknowledge the dialog destroys something instead.
 *
 * This component therefore checks for a `data-aal-destructive` control at the
 * head of the tab order and reports it in dev mode rather than silently
 * focusing it. Ordering the buttons Cancel-then-Delete is the fix, which is
 * also the platform convention on every OS.
 */
@Component({
  selector: 'aal-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dialog.css',
  providers: [AalDialogState],
  template: `
    @if (open()) {
      <!--
        Decorative dimming only. The dialog's modality is carried by inert and
        aria-modal, never by the scrim's appearance — and clicking the scrim
        does NOT dismiss, because accidental dismissal loses work.
      -->
      <div class="aal-dialog__scrim" aria-hidden="true"></div>

      <div
        #container
        class="aal-dialog"
        [class]="'aal-dialog--' + size()"
        [attr.role]="variant()"
        [attr.id]="state.dialogId"
        aria-modal="true"
        [attr.aria-labelledby]="state.titleId"
        [attr.aria-describedby]="state.describedBy()"
      >
        <div class="aal-dialog__header">
          <!--
            The title is a heading so screen-reader users can navigate to it,
            and it is the dialog's accessible name via aria-labelledby.
          -->
          <h2 class="aal-dialog__title" [attr.id]="state.titleId">{{ heading() }}</h2>

          @if (dismissible()) {
            <button
              type="button"
              class="aal-dialog__close"
              [attr.aria-label]="closeLabel()"
              (click)="requestClose('cancel')"
            >
              <span aria-hidden="true">✕</span>
            </button>
          }
        </div>

        @if (description()) {
          <p class="aal-dialog__description" [attr.id]="state.descriptionId">{{ description() }}</p>
        }

        <div class="aal-dialog__body">
          <ng-content />
        </div>

        <div class="aal-dialog__actions">
          <ng-content select="[aalDialogActions]" />
        </div>
      </div>
    }
  `,
})
export class AalDialog {
  protected readonly state = inject(AalDialogState);
  private readonly assert = inject(A11yAssertService);
  private readonly announcer = inject(AalLiveAnnouncer);
  private readonly config = injectAalConfig();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly containerEl = viewChild<ElementRef<HTMLElement>>('container');

  /** Dialog title. Becomes the accessible name — required, never optional. */
  readonly heading = input.required<string>();

  /** Supporting text, referenced by `aria-describedby`. */
  readonly description = input<string>('');

  /**
   * Which dialog role to render.
   *
   * Named `variant`, NOT `role`. An input called `role` shadows the global
   * HTML attribute: Angular set the input AND left role="alertdialog" on the
   * host element, so the accessibility tree contained two alertdialogs — an
   * empty host and the real container. getByRole found the empty one first.
   * An input must never share a name with a global ARIA attribute.
   */
  readonly variant = input<AalDialogVariant>('dialog');
  readonly size = input<AalDialogSize>('medium');

  /** Render a close button. False for a dialog the user must answer. */
  readonly dismissible = input(true, { transform: booleanAttribute });

  readonly closeLabel = input('Close dialog');

  /** Announce on close. Off by default — most closes are self-evident. */
  readonly announceClose = input(false, { transform: booleanAttribute });

  readonly open = model(false);
  readonly closed = output<DialogCloseReason>();

  protected readonly isAlert = computed(() => this.variant() === 'alertdialog');

  constructor() {
    /**
     * Bridge the declarative `open` model to the primitive's imperative
     * lifecycle, in BOTH directions.
     *
     * The first implementation ran this once in a constructor microtask, so
     * setting open=false hid the markup via @if but never told the primitive.
     * inert stayed on the background and focus was never restored — the dialog
     * looked closed and left the page unusable behind it. An effect re-runs on
     * every change, which is the whole point of binding it to a model.
     */
    effect(() => {
      const shouldBeOpen = this.open();

      if (shouldBeOpen && !this.state.isOpen()) {
        // The container is rendered by @if in this same change-detection pass,
        // so activation waits for it to exist.
        queueMicrotask(() => this.activate());
      } else if (!shouldBeOpen && this.state.isOpen()) {
        this.state.close('programmatic');
      }
    });
  }

  /** Open the dialog. Public so a consumer can open it imperatively. */
  show(): void {
    this.open.set(true);
  }

  private activate(): void {
    const container = this.containerEl()?.nativeElement;
    if (!container || this.state.isOpen()) return;

    this.state.setHasDescription(!!this.description());
    this.state.open(container, (reason) => {
      this.open.set(false);
      this.closed.emit(reason);
      if (this.announceClose()) this.announcer.polite(this.config.strings.dialogClosed);
    });

    this.warnIfDestructiveFocused(container);
  }

  protected requestClose(reason: DialogCloseReason): void {
    this.state.close(reason);
  }

  /**
   * Report a destructive control sitting first in the tab order.
   *
   * Not auto-corrected: silently moving focus somewhere the author did not
   * expect is its own surprise, and the real fix is button order, which the
   * author has to make. Reported loudly in dev instead.
   */
  private warnIfDestructiveFocused(container: HTMLElement): void {
    const focused = container.ownerDocument.activeElement;
    if (!focused?.hasAttribute('data-aal-destructive')) return;

    this.assert.fail(
      'AR-15 / §9.5',
      `<aal-dialog "${this.heading()}"> opened with focus on a destructive action. A screen-reader user pressing Enter to acknowledge the dialog would trigger it.`,
      'Put the safe action first in the DOM (Cancel before Delete — the platform convention on every OS), or mark the safe one with data-aal-focus-initial.',
    );
  }

  /** The dialog element, for tests and for a consumer managing focus. */
  get dialogElement(): HTMLElement | null {
    return this.containerEl()?.nativeElement ?? this.host.nativeElement.querySelector('[role]');
  }
}
