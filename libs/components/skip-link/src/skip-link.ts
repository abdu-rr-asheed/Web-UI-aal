import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { A11yAssertService, FocusObscuringGuard } from '@aal/a11y-core';

/**
 * Skip link — SC 2.4.1 Bypass Blocks (PRD §9.9).
 *
 * Lets a keyboard user jump past navigation that repeats on every page.
 * Without it, reaching the main content of a page with a 30-item nav costs 30
 * key presses — on every single page. For a switch-access user, where each
 * activation is a deliberate physical effort, that is the difference between a
 * usable site and an unusable one.
 *
 * Three things implementations routinely get wrong, all handled here:
 *
 * 1. **Hidden with `display: none`.** Removes it from the tab order, so the
 *    one control that exists to help keyboard users is unreachable by
 *    keyboard. Uses the clip technique instead (see `@aal/components/visually-hidden`).
 *
 * 2. **Visually skips but does not move focus.** `href="#main"` scrolls the
 *    viewport, but focus stays on the link, so the next Tab returns the user
 *    to the second nav item — they scrolled past nothing. Focus is moved
 *    explicitly to the target.
 *
 * 3. **Target cannot hold focus.** `<main>` is not focusable by default, so
 *    `.focus()` silently does nothing. `tabindex="-1"` is applied to the
 *    target on activation: focusable programmatically, still not a tab stop.
 *
 * Must be the FIRST focusable element in the document. The dev-mode assertion
 * checks that, because a skip link placed third is a skip link that skips
 * nothing.
 */
@Component({
  selector: 'aal-skip-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './skip-link.css',
  template: `
    <a class="aal-skip-link" [attr.href]="'#' + targetId()" (click)="skip($event)">
      <ng-content>Skip to main content</ng-content>
    </a>
  `,
})
export class AalSkipLink {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly assert = inject(A11yAssertService);
  private readonly obscuring = inject(FocusObscuringGuard);

  /** ID of the element to skip to. Conventionally the `<main>` landmark. */
  readonly targetId = input<string>('main');

  protected skip(event: MouseEvent): void {
    const target = this.doc.getElementById(this.targetId());

    if (!target) {
      // Left to the browser rather than swallowed: a broken fragment link that
      // does nothing is harder to notice than one that visibly fails.
      this.assert.fail(
        'SC 2.4.1',
        `<aal-skip-link> points at #${this.targetId()}, which does not exist. The link will not move focus, so keyboard users cannot bypass the navigation.`,
        `Add id="${this.targetId()}" to the main content landmark.`,
      );
      return;
    }

    event.preventDefault();

    // The target is not focusable by default, so .focus() would silently do
    // nothing. tabindex="-1" makes it programmatically focusable without
    // adding a tab stop.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');

    target.focus();

    // Moving focus is the point, but the target may now sit under a sticky
    // header — landing somewhere invisible is its own SC 2.4.11 failure.
    this.obscuring.ensureVisible(target);

    // Scroll too: focus() alone does not always scroll when the element is
    // only partly off-screen, and the two must agree or the sighted keyboard
    // user sees one thing while focus is somewhere else.
    //
    // Guarded because scrollIntoView does not exist under SSR or in jsdom.
    // Focus has already moved by this point, which is the accessibility
    // requirement — scrolling only makes the result visible, so its absence
    // degrades appearance rather than conformance.
    target.scrollIntoView?.({ block: 'start', behavior: 'instant' as ScrollBehavior });
  }

  /**
   * Is this the first focusable element in the document?
   *
   * Exposed for the docs-site test rather than asserted on every render:
   * checking the whole document on construction is too expensive to do
   * routinely, and the answer is a property of the page, not the component.
   */
  isFirstFocusable(): boolean {
    const focusables = this.doc.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    return focusables[0] === this.host.nativeElement.querySelector('a');
  }
}
