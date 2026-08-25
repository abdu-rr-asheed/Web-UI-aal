import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { AalDisclosureState } from '@aal/primitives/disclosure';

/**
 * Disclosure (PRD §9.9, APG Disclosure).
 *
 * The simplest interactive pattern there is, and worth having as a component
 * precisely because it is simple enough that people hand-roll it and get it
 * subtly wrong. Three things go wrong reliably:
 *
 * 1. **The trigger is a `<div>` or an `<a href="#">`.** A link that navigates
 *    nowhere is announced as a link, so a screen-reader user expects a page
 *    change; a div needs `tabindex`, `role`, and `Enter`/`Space` handlers all
 *    added by hand. A `<button>` needs none of that.
 *
 * 2. **`aria-expanded` is missing or on the wrong element.** It belongs on the
 *    thing the user activates, not on the panel. On the panel it is announced
 *    only after the user has already found their way in — by which point they
 *    know.
 *
 * 3. **The panel is hidden with CSS alone.** `visibility: hidden` and
 *    `height: 0; overflow: hidden` both leave the content in the accessibility
 *    tree, so a screen-reader user reads a "collapsed" panel perfectly well
 *    and cannot understand why the button says collapsed. `@if` removes it
 *    from the DOM entirely, which is unambiguous.
 *
 * Content is projected rather than passed as a string, so the panel can hold
 * anything — which is the usual reason to reach for a disclosure at all.
 *
 * ## Where the state lives
 *
 * The expanded/collapsed state and the trigger-to-panel id relationship come
 * from `AalDisclosureState` in L3, not from here. This component is markup and
 * styling over it. That matters for the library's central claim: if L4 kept
 * its own `aria-expanded`, the attribute would originate in two places and
 * "exactly one origin per ARIA attribute" would stop being checkable.
 */
@Component({
  selector: 'aal-disclosure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AalDisclosureState],
  styleUrl: './disclosure.css',
  template: `
    <div class="aal-disclosure">
      <!--
        A real <button>. Enter and Space activation, the correct role, and
        platform accessibility-API integration all come free.
      -->
      <button
        type="button"
        class="aal-disclosure__trigger"
        [attr.id]="state.triggerId"
        [attr.aria-expanded]="state.expanded()"
        [attr.aria-controls]="state.panelId"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        <!-- Decorative: aria-expanded already conveys the state. -->
        <span class="aal-disclosure__marker" aria-hidden="true">{{ state.expanded() ? '▾' : '▸' }}</span>
        {{ summary() }}
      </button>

      @if (state.expanded()) {
        <!--
          Removed from the DOM when collapsed, not merely hidden with CSS.
          visibility:hidden and height:0 both leave the content in the
          accessibility tree, so a screen-reader user reads a panel the button
          claims is collapsed.
        -->
        <div
          class="aal-disclosure__panel"
          role="region"
          [attr.id]="state.panelId"
          [attr.aria-labelledby]="state.triggerId"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class AalDisclosure {
  protected readonly state = inject(AalDisclosureState);

  /** Trigger label. Becomes the button's accessible name. */
  readonly summary = input.required<string>();

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly expanded = model(false);

  constructor() {
    effect(() => this.state.setDisabled(this.disabled()));
    effect(() => this.state.setExpanded(this.expanded()));

    // The primitive refuses to change while disabled, so the model has to
    // follow what actually happened rather than what was requested.
    effect(() => {
      const actual = this.state.expanded();
      if (actual !== this.expanded()) this.expanded.set(actual);
    });
  }

  protected toggle(): void {
    this.expanded.set(this.state.toggle());
  }
}
