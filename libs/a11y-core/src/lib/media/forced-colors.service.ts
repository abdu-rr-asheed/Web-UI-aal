import { DOCUMENT, Injectable, Signal, inject, signal } from '@angular/core';

/**
 * Tracks Windows Contrast Themes / `forced-colors: active` (AR-19).
 *
 * Most components need no TypeScript for this — the token layer already swaps
 * to system colour keywords in CSS (`libs/tokens/src/styles/tokens.css`).
 * This exists for the cases CSS cannot express: an icon drawn on canvas, a
 * decorative element that must be hidden, or a shadow-only affordance that has
 * to grow a real border because shadows are not painted in forced-colors mode.
 *
 * Prefer the CSS layer. Reach for this only when the CSS layer genuinely
 * cannot do it.
 */
@Injectable({ providedIn: 'root' })
export class ForcedColorsService {
  private readonly doc = inject(DOCUMENT);
  private readonly state = signal(false);

  readonly forcedColors: Signal<boolean> = this.state.asReadonly();

  constructor() {
    const win = this.doc.defaultView;
    if (!win?.matchMedia) return;

    const query = win.matchMedia('(forced-colors: active)');
    this.state.set(query.matches);
    query.addEventListener('change', (e) => this.state.set(e.matches));
  }
}
