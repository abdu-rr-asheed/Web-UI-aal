import { Injectable } from '@angular/core';

/**
 * Deterministic, collision-free element IDs for ARIA relationships (FR-07).
 *
 * Every `aria-labelledby`, `aria-describedby`, `aria-controls` and
 * `aria-activedescendant` in AAL resolves through here. Hand-rolled IDs are
 * banned (CLAUDE.md) for two reasons:
 *
 *   1. Two instances of the same component on one page would emit duplicate
 *      IDs, and a duplicate ID silently repoints an ARIA relationship at the
 *      wrong element — a defect that renders correctly and reads wrongly.
 *   2. SSR (FR-09). Server and client must generate identical IDs or hydration
 *      mismatches, and the relationship breaks after hydration only. Because
 *      this service is `providedIn: 'root'`, the server creates a fresh
 *      instance per request and the counter restarts from the same point on
 *      both sides.
 */
@Injectable({ providedIn: 'root' })
export class AriaIdService {
  private counter = 0;

  /**
   * Next unique ID for `prefix`.
   *
   * @example ids.next('aal-dialog-title') // 'aal-dialog-title-0'
   */
  next(prefix: string): string {
    return `${prefix}-${this.counter++}`;
  }

  /** Reset the counter. Test-only; calling it in application code will cause collisions. */
  reset(): void {
    this.counter = 0;
  }
}
