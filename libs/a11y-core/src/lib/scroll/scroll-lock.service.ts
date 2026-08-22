import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Scroll containment for modal layers (AR-15).
 *
 * Two things most implementations get wrong, both of which this handles:
 *
 *   1. **Layout shift.** Setting `overflow: hidden` removes the scrollbar, the
 *      page widens by its width, and everything jumps sideways. Disorienting
 *      for everyone and actively harmful for users with vestibular or
 *      attention-related conditions. Compensated with padding.
 *   2. **Scroll position.** Naive implementations restore to the top on close,
 *      which for a keyboard user means losing their place entirely after
 *      dismissing a dialog.
 *
 * Reference-counted, because nested dialogs must not unlock the page when only
 * the inner one closes.
 */
@Injectable({ providedIn: 'root' })
export class ScrollLockService {
  private readonly doc = inject(DOCUMENT);

  private depth = 0;
  private saved: { overflow: string; paddingInlineEnd: string; scrollY: number } | null = null;

  /** Whether the page is currently locked. */
  get locked(): boolean {
    return this.depth > 0;
  }

  lock(): void {
    if (this.depth++ > 0) return; // already locked by an outer layer

    const win = this.doc.defaultView;
    const body = this.doc.body;
    if (!win || !body) return;

    const style = win.getComputedStyle(body);
    this.saved = {
      overflow: body.style.overflow,
      paddingInlineEnd: body.style.paddingInlineEnd,
      scrollY: win.scrollY,
    };

    // Width of the scrollbar we are about to remove.
    const gap = win.innerWidth - this.doc.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (gap > 0) {
      const existing = parseFloat(style.paddingInlineEnd) || 0;
      body.style.paddingInlineEnd = `${existing + gap}px`;
    }
  }

  unlock(): void {
    if (this.depth === 0) return;
    if (--this.depth > 0) return; // an outer layer still holds the lock

    const win = this.doc.defaultView;
    const body = this.doc.body;
    if (!win || !body || !this.saved) return;

    body.style.overflow = this.saved.overflow;
    body.style.paddingInlineEnd = this.saved.paddingInlineEnd;
    win.scrollTo({ top: this.saved.scrollY, behavior: 'instant' as ScrollBehavior });
    this.saved = null;
  }

  /** Test-only: drop all locks. */
  resetForTesting(): void {
    this.depth = 0;
    this.saved = null;
  }
}
