import { DestroyRef, Injectable, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AAL_CONFIG } from '../config/aal-config';

export type AalPoliteness = 'polite' | 'assertive';

/**
 * U+200B. Built from its code point rather than typed literally: an invisible
 * character in source is unreviewable, and ESLint's no-irregular-whitespace
 * rule rightly rejects it.
 */
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/**
 * Screen-reader announcements (AR-14, AR-25 / SC 4.1.3).
 *
 * Wraps CDK's `LiveAnnouncer` rather than reimplementing live regions — CDK
 * already handles the awkward parts (region creation, the clear-then-set dance
 * some screen readers need). What it does not handle is the three failure modes
 * that actually bite in practice, which is why this facade exists:
 *
 *   1. **Flooding.** A live region updated on every keystroke produces a
 *      stutter of half-spoken phrases and the user hears nothing useful.
 *      Debounced (configurable, 150ms default).
 *   2. **Duplicate suppression.** Screen readers ignore a live region set to
 *      the text it already contains, so a repeated identical message is
 *      silently dropped. Re-announced with a zero-width space appended so it
 *      registers as a change while sounding identical.
 *   3. **Assertive overuse.** `assertive` interrupts whatever the user is
 *      currently reading. It is correct for errors and almost nothing else.
 *      Kept as a separate, deliberate method rather than a parameter.
 */
@Injectable({ providedIn: 'root' })
export class AalLiveAnnouncer {
  private readonly cdk = inject(LiveAnnouncer);
  private readonly config = inject(AAL_CONFIG);

  private pending: ReturnType<typeof setTimeout> | null = null;
  private lastMessage = '';

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  /**
   * Announce without interrupting. The default, and correct for almost
   * everything: selection changes, filter results, loading completion.
   */
  polite(message: string): void {
    this.schedule(message, 'polite');
  }

  /**
   * Announce immediately, interrupting current speech.
   *
   * Reserve for content the user must hear before continuing — validation
   * errors on submit, session expiry. Overusing this makes a screen reader
   * unusable, because the user is cut off mid-sentence every time anything
   * changes.
   */
  assertive(message: string): void {
    this.schedule(message, 'assertive');
  }

  /** Clear the live region and drop any pending announcement. */
  clear(): void {
    this.cancel();
    this.lastMessage = '';
    this.cdk.clear();
  }

  private schedule(message: string, politeness: AalPoliteness): void {
    const text = message.trim();
    if (!text) return;

    this.cancel();

    const emit = () => {
      // Screen readers skip a live region set to the text it already holds.
      // A zero-width space makes it a change without changing what is spoken.
      const payload = text === this.lastMessage ? text + ZERO_WIDTH_SPACE : text;
      this.lastMessage = text;
      this.cdk.announce(payload, politeness);
      this.pending = null;
    };

    // Errors are not debounced — delaying an interruption defeats the point.
    if (politeness === 'assertive' || this.config.announceDebounceMs <= 0) {
      emit();
      return;
    }

    this.pending = setTimeout(emit, this.config.announceDebounceMs);
  }

  private cancel(): void {
    if (this.pending === null) return;
    clearTimeout(this.pending);
    this.pending = null;
  }
}
