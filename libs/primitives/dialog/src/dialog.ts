import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  AriaIdService,
  DismissService,
  FocusTrapFacade,
  ScrollLockService,
  type DismissReason,
  type TrapHandle,
} from '@aal/a11y-core';

export type DialogCloseReason = DismissReason | 'confirm' | 'cancel';

export interface DialogOpenOptions {
  /** Element to restore focus to. Defaults to whatever had focus when opened. */
  readonly restoreTo?: HTMLElement | null;
  /** Explicit initial focus target, overriding the resolution order. */
  readonly initialFocus?: HTMLElement | null;
}

/**
 * Modal dialog state machine (PRD §9.5, §7.12, APG Dialog (Modal)).
 *
 * Implements the sequence in PRD Figure 3 exactly. The dialog is the component
 * that most reliably fails accessibility review in mainstream libraries, and
 * the failures are consistent enough to enumerate:
 *
 * 1. **Focus is never moved into the dialog**, so a screen-reader user has no
 *    idea it opened and keeps reading the page behind it.
 * 2. **Background content stays readable in browse mode.** A focus trap stops
 *    Tab escaping, but without `inert` the virtual cursor walks straight into
 *    content the user cannot reach. `aria-modal` promises this and does not
 *    deliver it.
 * 3. **Focus is lost on close.** Restored to `<body>`, so the keyboard user is
 *    dumped at the top of the document.
 * 4. **Nested dialogs collapse.** One Escape closes both, losing the user's
 *    work with no explanation.
 * 5. **Focus lands on the destructive action**, so Enter deletes something.
 *
 * All five are addressed here, and each has a test named after it.
 *
 * The primitive orchestrates L2 services rather than reimplementing them —
 * FocusTrapFacade, DismissService and ScrollLockService already solve trapping,
 * layer ordering and scroll containment (PRD §6.3.1).
 */
@Injectable()
export class AalDialogState {
  private readonly doc = inject(DOCUMENT);
  private readonly ids = inject(AriaIdService);
  private readonly focusTrap = inject(FocusTrapFacade);
  private readonly dismiss = inject(DismissService);
  private readonly scrollLock = inject(ScrollLockService);

  readonly dialogId = this.ids.next('aal-dialog');
  readonly titleId = this.ids.next('aal-dialog-title');
  readonly descriptionId = this.ids.next('aal-dialog-description');

  private readonly openState = signal(false);
  private readonly hasDescriptionState = signal(false);

  readonly isOpen: Signal<boolean> = this.openState.asReadonly();
  readonly hasDescription: Signal<boolean> = this.hasDescriptionState.asReadonly();

  /**
   * `aria-describedby`, or null.
   *
   * Emitted only when a description actually exists. A dangling reference
   * announces nothing while looking correct in the markup.
   */
  readonly describedBy = computed(() => (this.hasDescriptionState() ? this.descriptionId : null));

  private trap: TrapHandle | null = null;
  private dismissRef: { dismiss(): void; isTop(): boolean } | null = null;
  private restoreTo: HTMLElement | null = null;
  private onCloseCallback: ((reason: DialogCloseReason) => void) | null = null;

  setHasDescription(has: boolean): void {
    this.hasDescriptionState.set(has);
  }

  /**
   * Open the dialog.
   *
   * `container` must already be in the DOM — the caller renders it first, then
   * calls this. Splitting it that way keeps the primitive free of any opinion
   * about how the dialog is rendered (inline, portal, or otherwise).
   */
  open(
    container: HTMLElement,
    onClose: (reason: DialogCloseReason) => void,
    options: DialogOpenOptions = {},
  ): void {
    if (this.openState()) return;

    // Captured BEFORE focus moves, or we would restore to the dialog itself.
    this.restoreTo =
      options.restoreTo ??
      (this.doc.activeElement instanceof HTMLElement ? this.doc.activeElement : null);

    this.onCloseCallback = onClose;
    this.openState.set(true);

    // Order matters. Scroll lock first so the page cannot shift under the user
    // while focus is moving; then the trap, which also applies `inert`.
    this.scrollLock.lock();
    this.trap = this.focusTrap.trap(container, {
      restoreTo: this.restoreTo,
      initialFocus: options.initialFocus ?? null,
      inertBackground: true,
    });

    // Escape and outside-pointer go through the SHARED layer stack, so a
    // confirm dialog opened from inside a dialog closes only itself.
    this.dismissRef = this.dismiss.register(container, {
      onDismiss: (reason) => this.finish(reason),
      escape: true,
      // A modal dialog is not dismissed by clicking the scrim. Accidental
      // dismissal loses work, and users with motor impairments mis-click far
      // more often than the pattern's popularity suggests.
      outsidePointer: false,
    });
  }

  /** Close programmatically — a Cancel button, a completed action. */
  close(reason: DialogCloseReason = 'programmatic'): void {
    if (!this.openState()) return;
    this.dismissRef?.dismiss();
    this.finish(reason);
  }

  /** True when this dialog is the top-most layer, and therefore what Escape targets. */
  isTopLayer(): boolean {
    return this.dismissRef?.isTop() ?? false;
  }

  /**
   * Tear down in the reverse order of setup.
   *
   * Releasing the trap restores focus and removes `inert`; unlocking scroll
   * afterwards means the page cannot shift while focus is still settling.
   */
  private finish(reason: DialogCloseReason): void {
    if (!this.openState()) return;

    this.openState.set(false);
    this.trap?.release();
    this.trap = null;
    this.scrollLock.unlock();
    this.dismissRef = null;

    const callback = this.onCloseCallback;
    this.onCloseCallback = null;
    callback?.(reason);
  }
}
