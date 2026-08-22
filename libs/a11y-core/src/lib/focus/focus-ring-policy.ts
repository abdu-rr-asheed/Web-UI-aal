import { Injectable, Signal, computed, inject } from '@angular/core';
import { InputModalityDetector } from '@angular/cdk/a11y';
import { AAL_CONFIG } from '../config/aal-config';

export type AalInputModality = 'keyboard' | 'mouse' | 'touch' | null;

/**
 * When the focus ring should be painted (AR-05 / SC 2.4.7).
 *
 * `:focus-visible` handles this natively and is what AAL's CSS uses. This
 * service exists for the cases CSS cannot reach: a component that must know
 * the modality to decide behaviour, not just appearance — for example a menu
 * that should open focused on its first item for a keyboard user but not for a
 * mouse user.
 *
 * Wraps CDK's `InputModalityDetector`, which already deals with the messy part:
 * screen readers fire synthetic mouse events, so naive "was the last event a
 * click" logic misclassifies a screen-reader user as a mouse user and hides the
 * focus ring from exactly the person who needs it.
 *
 * There is deliberately no way to switch the ring off. `focusRing: 'always'`
 * exists; `'never'` does not (see AalConfig).
 */
@Injectable({ providedIn: 'root' })
export class FocusRingPolicy {
  private readonly detector = inject(InputModalityDetector);
  private readonly config = inject(AAL_CONFIG);

  /** Most recent input modality, or null before any input. */
  get modality(): AalInputModality {
    return this.detector.mostRecentModality;
  }

  /** True when a focus ring should currently be painted. */
  readonly shouldShowRing: Signal<boolean> = computed(() => {
    if (this.config.focusRing === 'always') return true;
    return this.detector.mostRecentModality !== 'mouse';
  });

  /**
   * Should focus be moved programmatically for this interaction?
   *
   * Moving focus on a mouse click is usually wrong — the user is already
   * looking where they clicked and a focus jump can scroll the page out from
   * under them. Moving it for a keyboard user is usually right.
   */
  shouldMoveFocus(): boolean {
    return this.detector.mostRecentModality !== 'mouse';
  }
}
