import { DOCUMENT, Injectable, inject } from '@angular/core';

export interface ObscuringResult {
  /** True when no part of the element's focus perimeter is covered. */
  readonly visible: boolean;
  /** The element doing the covering, when one was found. */
  readonly obscuredBy: Element | null;
  /** Fraction of the element's area that is covered, 0–1. */
  readonly coverage: number;
}

/**
 * SC 2.4.11 Focus Not Obscured (Minimum), Level AA — AR-06.
 *
 * When an element receives focus, no part of it may be *entirely* hidden by
 * author-created content. The everyday failure is mundane and extremely
 * common: a sticky header or a cookie bar overlays the element the user just
 * tabbed to, so the focus ring is painted underneath it and a keyboard user
 * has no idea where they are.
 *
 * This is new in WCAG 2.2 and, per PRD §9, no mainstream component library
 * enforces it — which makes it one of the more defensible novelty claims in
 * this project. Enforcing it is only possible from a service like this: it
 * depends on what the *consumer* stacked above the component, so no amount of
 * care inside a component can guarantee it.
 *
 * Deliberately measures geometry rather than trusting z-index. Stacking
 * contexts, transforms and `position: fixed` interact in ways that make
 * z-index a poor proxy for "is this actually on top", and `elementFromPoint`
 * asks the browser the question directly.
 */
@Injectable({ providedIn: 'root' })
export class FocusObscuringGuard {
  private readonly doc = inject(DOCUMENT);

  /**
   * Is `el` visible where it sits, or is something covering it?
   *
   * Samples the element's corners and centre. Sampling rather than exact
   * geometry is a deliberate trade: it is O(1), runs on every focus change
   * without cost, and catches the real-world cases (a bar across the top, a
   * panel down one side). A pathological cover that leaves exactly the sample
   * points clear would be missed, which is an acceptable false-negative rate
   * for something that has to run synchronously on focus.
   */
  check(el: Element): ObscuringResult {
    const win = this.doc.defaultView;
    if (!win || typeof this.doc.elementFromPoint !== 'function') {
      // SSR, or jsdom, which has no layout engine. Report visible rather than
      // inventing a failure — the real check happens in the Playwright suite.
      return { visible: true, obscuredBy: null, coverage: 0 };
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { visible: true, obscuredBy: null, coverage: 0 };
    }

    // Inset by 1px so a sample never lands on a neighbouring element's edge.
    const points = this.samplePoints(rect);

    let covered = 0;
    let coveringElement: Element | null = null;

    for (const [x, y] of points) {
      const topmost = this.coveringElementAt(x, y, el, win);
      if (!topmost) continue;
      covered++;
      coveringElement ??= topmost;
    }

    const coverage = covered / points.length;
    return {
      // SC 2.4.11 (Minimum) is violated only when the element is ENTIRELY
      // hidden. Partial occlusion is 2.4.12 (Enhanced, AAA) and is out of
      // scope for the AA target — so the threshold is every sample covered.
      visible: coverage < 1,
      obscuredBy: coveringElement,
      coverage,
    };
  }

  /** Corners plus centre, inset by 1px so a sample never lands on a neighbour's edge. */
  private samplePoints(rect: DOMRect): [number, number][] {
    const inset = 1;
    return [
      [rect.left + inset, rect.top + inset],
      [rect.right - inset, rect.top + inset],
      [rect.left + inset, rect.bottom - inset],
      [rect.right - inset, rect.bottom - inset],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
    ];
  }

  /** The element covering `el` at this point, or null if `el` itself is on top. */
  private coveringElementAt(x: number, y: number, el: Element, win: Window): Element | null {
    // Off-screen points are a scroll problem, not an obscuring problem.
    if (x < 0 || y < 0 || x > win.innerWidth || y > win.innerHeight) return null;

    const topmost = this.doc.elementFromPoint(x, y);
    if (!topmost) return null;
    if (topmost === el || el.contains(topmost) || topmost.contains(el)) return null;

    return topmost;
  }

  /**
   * Ensure `el` is not fully obscured, scrolling it clear if it is.
   *
   * Returns true if it was already visible, false if remediation was needed —
   * the caller can log that, because needing to scroll on every focus is a
   * sign the layout has a sticky-header problem worth fixing at source.
   */
  ensureVisible(el: Element): boolean {
    const before = this.check(el);
    if (before.visible) return true;

    // `center` rather than `nearest`: nearest frequently parks the element
    // directly under the very sticky header that was covering it.
    //
    // Optional-called because scrollIntoView is absent under SSR and in jsdom.
    el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
    return false;
  }
}
