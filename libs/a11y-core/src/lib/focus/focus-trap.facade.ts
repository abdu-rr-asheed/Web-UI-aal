import { DOCUMENT, Injectable, inject } from '@angular/core';
import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { FocusObscuringGuard } from './focus-obscuring-guard';

/** Elements that can hold focus. Ordered by DOM position at query time. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface TrapOptions {
  /**
   * Where focus goes when the trap opens. Resolution order is
   * `[aalFocusInitial]` → first tabbable → the container itself.
   * Never a destructive action (PRD §9.5).
   */
  readonly initialFocus?: HTMLElement | null;
  /** Element to restore focus to on release. Defaults to whatever had focus. */
  readonly restoreTo?: HTMLElement | null;
  /** Mark background content inert. Default true; false only for non-modal layers. */
  readonly inertBackground?: boolean;
}

export interface TrapHandle {
  /** Release the trap, restore focus, and un-inert the background. */
  release(): void;
  /** Re-scan for tabbables after the trap's content changes. */
  refresh(): void;
}

/**
 * Modal focus trapping (AR-15 / SC 2.1.2, 2.4.3).
 *
 * Wraps CDK's `ConfigurableFocusTrapFactory` — the trapping itself is solved
 * and reimplementing it would be exactly the duplication PRD §6.3.1 warns
 * against. What CDK does not do, and what actually causes real dialogs to fail
 * accessibility review, is handled here:
 *
 *   1. **`inert` on background content.** A focus trap stops Tab escaping, but
 *      without `inert` a screen reader in browse mode still reads the page
 *      behind the dialog. The user hears content they cannot reach. `inert`
 *      removes it from the accessibility tree entirely, which is what
 *      `aria-modal` promises but does not by itself deliver.
 *   2. **Focus restoration that cannot lose focus.** If the trigger was removed
 *      while the dialog was open — deleted a row, then closed the confirm —
 *      naive restoration sends focus to `<body>` and the keyboard user is
 *      dumped at the top of the document with no idea where they are. This
 *      falls back deliberately.
 *   3. **Obscuring.** The restored element may sit under a sticky header
 *      (SC 2.4.11), so restoration runs through FocusObscuringGuard.
 */
@Injectable({ providedIn: 'root' })
export class FocusTrapFacade {
  private readonly doc = inject(DOCUMENT);
  private readonly factory = inject(ConfigurableFocusTrapFactory);
  private readonly obscuring = inject(FocusObscuringGuard);

  trap(container: HTMLElement, options: TrapOptions = {}): TrapHandle {
    const restoreTo =
      options.restoreTo ?? (this.doc.activeElement instanceof HTMLElement ? this.doc.activeElement : null);

    const trap = this.factory.create(container);
    const uninert = options.inertBackground === false ? () => undefined : this.inertBackground(container);

    this.moveInitialFocus(container, options.initialFocus ?? null);

    return {
      refresh: () => {
        // CDK caches nothing, but re-anchoring keeps the boundary sentinels at
        // the true edges after dynamic content is added.
        trap.destroy();
      },
      release: () => {
        uninert();
        trap.destroy();
        this.restoreFocus(restoreTo);
      },
    };
  }

  /**
   * Resolution order per PRD §9.5. The container fallback carries
   * `tabindex="-1"` so it can hold focus without becoming a tab stop.
   */
  private moveInitialFocus(container: HTMLElement, requested: HTMLElement | null): void {
    const marked = container.querySelector<HTMLElement>('[aalFocusInitial], [data-aal-focus-initial]');
    const tabbable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    for (const candidate of [requested, marked, ...tabbable]) {
      if (this.tryFocus(candidate)) return;
    }

    // Nothing inside could take focus. The container holds it instead, with
    // tabindex="-1" so it can be focused without becoming a tab stop.
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    container.focus();
  }

  /**
   * Attempt to focus, then VERIFY it landed.
   *
   * Deliberately not `InteractivityChecker.isFocusable()` first. That predicts
   * focusability from layout — correct in a browser, but it returns false for
   * everything in jsdom, where elements have no rendered dimensions. Predicting
   * and then trusting the prediction meant the fallback path fired spuriously
   * in tests and would have masked real regressions.
   *
   * Asking the DOM what actually happened is both simpler and true in every
   * environment: if the element could not take focus, activeElement will not
   * be it, and we move on to the next candidate.
   */
  private tryFocus(el: HTMLElement | null): boolean {
    if (!el || !el.isConnected) return false;
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.closest('[inert]')) return false;

    el.focus();
    return el.ownerDocument.activeElement === el;
  }

  /**
   * Mark everything outside `container` inert, walking up from the container
   * and inerting siblings at each level. Returns a function that restores
   * exactly what was changed — elements already inert are left alone, so a
   * nested dialog closing does not un-inert the page for its parent.
   */
  private inertBackground(container: HTMLElement): () => void {
    const changed: HTMLElement[] = [];

    for (let node: HTMLElement | null = container; node && node !== this.doc.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) {
        if (sibling === node || !this.shouldInert(sibling)) continue;
        sibling.setAttribute('inert', '');
        changed.push(sibling);
      }
    }

    return () => changed.forEach((el) => el.removeAttribute('inert'));
  }

  /**
   * Already-inert elements are skipped, so a nested dialog closing does not
   * un-inert the page for the dialog still open behind it. Live regions are
   * skipped because announcements must keep working while a dialog is open.
   */
  private shouldInert(node: Element): node is HTMLElement {
    if (!(node instanceof HTMLElement)) return false;
    if (node.hasAttribute('inert')) return false;
    return !node.hasAttribute('aria-live') && !node.querySelector('[aria-live]');
  }

  /**
   * Restore focus, with a documented fallback chain so focus can never be lost
   * to `<body>` — which for a keyboard user means silently losing their place.
   */
  private restoreFocus(target: HTMLElement | null): void {
    if (this.tryFocus(target)) {
      // The trigger may sit under a sticky header now that the overlay has
      // gone — restoring focus somewhere invisible is its own SC 2.4.11 failure.
      this.obscuring.ensureVisible(target!);
      return;
    }

    // The trigger is gone — a deleted row, a closed panel. Focus must land
    // somewhere meaningful: dropping it on <body> leaves a keyboard user at the
    // top of the document with no idea what happened.
    const fallback =
      this.doc.querySelector<HTMLElement>('main') ??
      this.doc.querySelector<HTMLElement>('h1') ??
      this.doc.body;

    if (!fallback) return;
    if (!fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1');
    fallback.focus();
  }
}
