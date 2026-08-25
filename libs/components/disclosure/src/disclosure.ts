import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  inject,
  input,
  model,
} from '@angular/core';
import { AriaIdService } from '@aal/a11y-core';

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
 */
@Component({
  selector: 'aal-disclosure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
        [attr.id]="triggerId"
        [attr.aria-expanded]="expanded()"
        [attr.aria-controls]="panelId"
        [disabled]="disabled()"
        (click)="toggle()"
      >
        <!-- Decorative: aria-expanded already conveys the state. -->
        <span class="aal-disclosure__marker" aria-hidden="true">{{ expanded() ? '▾' : '▸' }}</span>
        {{ summary() }}
      </button>

      @if (expanded()) {
        <!--
          Removed from the DOM when collapsed, not merely hidden with CSS.
          visibility:hidden and height:0 both leave the content in the
          accessibility tree, so a screen-reader user reads a panel the button
          claims is collapsed.
        -->
        <div
          class="aal-disclosure__panel"
          role="region"
          [attr.id]="panelId"
          [attr.aria-labelledby]="triggerId"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class AalDisclosure {
  private readonly ids = inject(AriaIdService);

  readonly triggerId = this.ids.next('aal-disclosure-trigger');
  readonly panelId = this.ids.next('aal-disclosure-panel');

  /** Trigger label. Becomes the button's accessible name. */
  readonly summary = input.required<string>();

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly expanded = model(false);

  protected toggle(): void {
    if (this.disabled()) return;
    this.expanded.update((v) => !v);
  }
}
