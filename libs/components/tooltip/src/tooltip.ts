import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  inject,
  input,
  signal,
} from '@angular/core';
import { A11yAssertService, AriaIdService } from '@aal/a11y-core';

/**
 * Tooltip (PRD §9.9, APG Tooltip, SC 1.4.13 Content on Hover or Focus).
 *
 * ## Read this first: a tooltip is almost always the wrong control
 *
 * Tooltips are invisible until hovered, unavailable to touch users in any
 * discoverable way, and easy to miss entirely. If the information matters, put
 * it on the page. If it labels a control, use an accessible name. This exists
 * for genuinely supplementary detail — the keyboard shortcut for a button
 * whose purpose is already clear from its label.
 *
 * **It is never the sole source of an accessible name.** A tooltip supplies
 * `aria-describedby`, not `aria-labelledby`. A control whose only name lives
 * in a tooltip has no name for a touch user at all, and the dev-mode assertion
 * catches that.
 *
 * ## SC 1.4.13 has three requirements, and all three are easy to fail
 *
 * 1. **Dismissible** — `Escape` hides it without moving focus. A tooltip
 *    covering the content underneath, with no way to dismiss it, traps a
 *    magnifier user who cannot see around it.
 * 2. **Hoverable** — the pointer can move onto the tooltip itself without it
 *    vanishing. A magnifier user often needs to pan across the tooltip to read
 *    it; one that disappears the moment the pointer leaves the trigger is
 *    unreadable at high zoom.
 * 3. **Persistent** — it stays until dismissed, focus moves, or the pointer
 *    leaves. Never on a timer: an auto-hiding tooltip is a race a slow reader
 *    loses.
 *
 * It also shows on FOCUS, not only hover. A keyboard user who cannot hover
 * would otherwise never see it.
 */
@Component({
  selector: 'aal-tooltip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tooltip.css',
  host: {
    class: 'aal-tooltip-host',
    '(mouseenter)': 'show()',
    '(mouseleave)': 'scheduleHide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'dismiss($event)',
  },
  template: `
    <ng-content />

    @if (visible()) {
      <!--
        role="tooltip" and aria-describedby, never aria-labelledby: a tooltip
        supplements a name, it does not supply one.

        mouseenter/mouseleave are bound on the tooltip itself so the pointer can
        travel onto it without dismissal (SC 1.4.13 "hoverable") — a magnifier
        user frequently needs to pan across it to read it.
      -->
      <div
        class="aal-tooltip"
        role="tooltip"
        [attr.id]="tooltipId"
        (mouseenter)="cancelHide()"
        (mouseleave)="scheduleHide()"
      >
        {{ text() }}
      </div>
    }
  `,
})
export class AalTooltip {
  private readonly ids = inject(AriaIdService);
  private readonly assert = inject(A11yAssertService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tooltipId = this.ids.next('aal-tooltip');

  /** Supplementary text. Never the control's only description of itself. */
  readonly text = input.required<string>();

  /** Disable entirely — for a trigger whose tooltip is contextually redundant. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly visibleState = signal(false);
  readonly visible = this.visibleState.asReadonly();

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  protected show(): void {
    if (this.disabled()) return;
    this.cancelHide();
    this.visibleState.set(true);
    this.wireDescription();
  }

  protected hide(): void {
    this.cancelHide();
    this.visibleState.set(false);
  }

  /**
   * Delay hiding so the pointer can cross the gap between trigger and tooltip.
   *
   * SC 1.4.13 "hoverable". Without the grace period the tooltip vanishes in the
   * few pixels between the two, which makes it unreadable for anyone whose
   * pointer control is less than precise.
   */
  protected scheduleHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.visibleState.set(false), 150);
  }

  protected cancelHide(): void {
    if (this.hideTimer === null) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  /**
   * Escape hides the tooltip WITHOUT moving focus (SC 1.4.13 "dismissible").
   *
   * Not routed through DismissService: that stack is for layers that own the
   * Escape key. A tooltip must not swallow Escape from a dialog it sits inside,
   * so it handles the key locally and lets it continue to propagate.
   */
  protected dismiss(event: Event): void {
    if (!this.visibleState()) return;
    this.hide();
    // Deliberately not stopPropagation: an enclosing dialog should still close.
    event.preventDefault();
  }

  /**
   * Point the trigger's `aria-describedby` at the tooltip.
   *
   * Done here rather than by the consumer so the relationship cannot be
   * forgotten — an unreferenced tooltip is invisible to a screen reader no
   * matter how correct its markup is.
   */
  private wireDescription(): void {
    const trigger = this.host.nativeElement.querySelector<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]',
    );

    if (!trigger) {
      this.assert.fail(
        'SC 1.4.13 / AR-21',
        '<aal-tooltip> contains no focusable trigger. A tooltip that only appears on hover is invisible to keyboard and screen-reader users entirely.',
        'Wrap a focusable control — a button or a link — inside the tooltip.',
      );
      return;
    }

    const existing = trigger.getAttribute('aria-describedby');
    if (existing?.includes(this.tooltipId)) return;
    trigger.setAttribute('aria-describedby', existing ? `${existing} ${this.tooltipId}` : this.tooltipId);
  }
}
