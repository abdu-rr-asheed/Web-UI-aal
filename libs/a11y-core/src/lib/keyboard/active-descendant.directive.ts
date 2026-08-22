import { Directive, ElementRef, InputSignal, effect, inject, input } from '@angular/core';

/**
 * `aria-activedescendant` composite navigation (AR-04, AR-16).
 *
 * The alternative to roving tabindex. Use this when DOM focus must STAY on one
 * element while a logical selection moves elsewhere. A combobox is the
 * canonical case: focus stays in the text input so the user can keep typing,
 * while the highlighted option moves with the arrow keys.
 *
 * Choosing between the two techniques matters. Roving tabindex moves real
 * focus, which every screen reader announces reliably; `aria-activedescendant`
 * support is good in modern AT but has historically been patchier. AAL's rule
 * (PRD §9.4): roving tabindex by default, `aria-activedescendant` only where
 * moving real focus would break the interaction — in practice, comboboxes and
 * editable grids.
 */
@Directive({
  selector: '[aalActiveDescendant]',
  standalone: true,
  exportAs: 'aalActiveDescendant',
})
export class AalActiveDescendant {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** ID of the active option, or null when nothing is active. */
  readonly activeId: InputSignal<string | null> = input<string | null>(null, {
    alias: 'aalActiveDescendant',
  });

  constructor() {
    effect(() => {
      const id = this.activeId();
      const el = this.host.nativeElement;

      if (!id) {
        // Removed rather than emptied: an empty aria-activedescendant is an
        // invalid reference, not an expression of "nothing is active".
        el.removeAttribute('aria-activedescendant');
        return;
      }

      el.setAttribute('aria-activedescendant', id);

      // The active option has no DOM focus, so the browser will not scroll it
      // into view. Without this a sighted keyboard user arrows into content
      // they cannot see.
      el.ownerDocument?.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
  }
}
