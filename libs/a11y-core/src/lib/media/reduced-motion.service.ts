import { DOCUMENT, Injectable, Signal, computed, inject, signal } from '@angular/core';

/**
 * Tracks `prefers-reduced-motion` (AR-20 / SC 2.3.1).
 *
 * Exposed as a signal so components gate animation declaratively rather than
 * each re-implementing a matchMedia listener — and so the preference is
 * honoured when the user changes it mid-session, not only at load.
 *
 * SSR-safe: `matchMedia` does not exist on the server, so the server assumes
 * reduced motion. That is the safe default — rendering without animation and
 * then enabling it after hydration is harmless, whereas the reverse would play
 * an animation at a user who asked for none.
 */
@Injectable({ providedIn: 'root' })
export class ReducedMotionService {
  private readonly doc = inject(DOCUMENT);
  private readonly state = signal(true);

  readonly prefersReducedMotion: Signal<boolean> = this.state.asReadonly();
  /** Convenience inverse, for `[class.animated]` style bindings. */
  readonly motionAllowed: Signal<boolean> = computed(() => !this.state());

  constructor() {
    const win = this.doc.defaultView;
    if (!win?.matchMedia) return; // server, or a very old browser

    const query = win.matchMedia('(prefers-reduced-motion: reduce)');
    this.state.set(query.matches);
    query.addEventListener('change', (e) => this.state.set(e.matches));
  }
}
