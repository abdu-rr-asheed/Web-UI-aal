import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { AriaIdService } from '@aal/a11y-core';

/**
 * A single show/hide relationship (PRD §9.9, APG Disclosure).
 *
 * The smallest state machine in the library, and worth having as a primitive
 * anyway: it is the origin of the `aria-expanded`/`aria-controls` pair for
 * every AAL pattern built on showing and hiding a region — Disclosure today,
 * Accordion next. "Every ARIA attribute originates in exactly one place" is a
 * checkable property only if the cheap patterns obey it too; a second
 * hand-rolled `aria-expanded` in L4 would be a counter-example shipped
 * alongside the claim.
 *
 * What the pattern requires, and what implementations get wrong:
 *
 * 1. **`aria-expanded` belongs on the trigger**, not on the panel. On the
 *    panel it is announced only once the user has already found their way in,
 *    by which point they know.
 * 2. **`aria-controls` must point at an element that exists.** A reference to
 *    a panel that is removed while collapsed is a dangling reference, so the
 *    id relationship is generated here and the panel's presence is the
 *    styled layer's responsibility to keep honest.
 * 3. **Collapsed must mean gone from the accessibility tree.**
 *    `visibility: hidden` and `height: 0; overflow: hidden` both leave the
 *    content readable in browse mode, so a screen-reader user reads a panel
 *    the trigger calls collapsed.
 */
@Injectable()
export class AalDisclosureState {
  private readonly ids = inject(AriaIdService);

  readonly triggerId = this.ids.next('aal-disclosure-trigger');
  readonly panelId = this.ids.next('aal-disclosure-panel');

  private readonly expandedState = signal(false);
  private readonly disabledState = signal(false);

  readonly expanded: Signal<boolean> = this.expandedState.asReadonly();
  readonly disabled: Signal<boolean> = this.disabledState.asReadonly();

  setDisabled(disabled: boolean): void {
    this.disabledState.set(disabled);
  }

  setExpanded(expanded: boolean): void {
    if (this.disabledState()) return;
    this.expandedState.set(expanded);
  }

  /** Returns the new state, so a caller can emit it without re-reading. */
  toggle(): boolean {
    if (this.disabledState()) return this.expandedState();
    this.expandedState.update((v) => !v);
    return this.expandedState();
  }
}

/**
 * An indexed set of disclosures with a shared open policy (PRD §9.6).
 *
 * Site navigation with submenus, and the Accordion, are both "several
 * disclosures that know about each other". The policy question — may two be
 * open at once? — is the only thing that differs between them, so it is an
 * input rather than two implementations.
 *
 * ## Why this is not `role="menu"` (ADR-0005)
 *
 * This is the state behind the APG **Disclosure Navigation Menu**, and the
 * choice is deliberate. A `role="menu"` containing links is one of the most
 * widespread ARIA misuses on the web: it tells the screen reader "this is an
 * application menu", which switches the user out of browse mode into
 * application mode. In application mode the reading keys they navigate the
 * rest of the page with stop working, links stop being announced as links,
 * and the list stops being announced as a list — every navigational affordance
 * a screen-reader user relies on is replaced by a keyboard model borrowed from
 * desktop menu bars, in exchange for nothing.
 *
 * Site navigation is a list of links. Native list and link semantics, plus
 * `aria-expanded` on the submenu triggers, describe it exactly.
 */
@Injectable()
export class AalDisclosureSet {
  private readonly ids = inject(AriaIdService);

  readonly baseId = this.ids.next('aal-disclosure-set');

  private readonly openState = signal<ReadonlySet<number>>(new Set());
  private readonly multipleState = signal(false);

  /** Indices currently expanded. */
  readonly openIndices: Signal<ReadonlySet<number>> = this.openState.asReadonly();

  /** True when any disclosure in the set is open — the responsive trigger reads this. */
  readonly anyOpen = computed(() => this.openState().size > 0);

  triggerId(index: number): string {
    return `${this.baseId}-trigger-${index}`;
  }

  panelId(index: number): string {
    return `${this.baseId}-panel-${index}`;
  }

  isOpen(index: number): boolean {
    return this.openState().has(index);
  }

  /** `false` (the default) closes any other open disclosure when one opens. */
  setMultiple(multiple: boolean): void {
    this.multipleState.set(multiple);
    if (!multiple && this.openState().size > 1) {
      const first = [...this.openState()][0];
      this.openState.set(first === undefined ? new Set() : new Set([first]));
    }
  }

  open(index: number): void {
    this.openState.set(this.multipleState() ? new Set([...this.openState(), index]) : new Set([index]));
  }

  close(index: number): void {
    const next = new Set(this.openState());
    next.delete(index);
    this.openState.set(next);
  }

  /** Returns the new state of `index`. */
  toggle(index: number): boolean {
    const willOpen = !this.isOpen(index);
    if (willOpen) this.open(index);
    else this.close(index);
    return willOpen;
  }

  closeAll(): void {
    if (this.openState().size === 0) return;
    this.openState.set(new Set());
  }
}
