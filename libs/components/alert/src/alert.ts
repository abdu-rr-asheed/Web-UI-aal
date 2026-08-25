import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { AriaIdService } from '@aal/a11y-core';

/**
 * How urgently the message interrupts.
 *
 * `status` (polite) waits for a pause in speech. `alert` (assertive) cuts the
 * user off mid-sentence.
 *
 * Assertive is correct for a session about to expire or a submission that
 * failed. It is wrong for almost everything else, and overusing it makes a
 * screen reader genuinely unpleasant — every background update severs whatever
 * the user was reading.
 */
export type AalAlertTone = 'info' | 'success' | 'warning' | 'error';

/**
 * Alert and status message (PRD §9.9, APG Alert, SC 4.1.3 Status Messages).
 *
 * The live region is rendered ALWAYS, and only its contents change. This is
 * the single most common way live regions fail in practice: a region added to
 * the DOM at the same moment as its text is frequently not announced at all,
 * because the screen reader has not yet started observing it. Rendering the
 * container up front and filling it later is the difference between a message
 * that is spoken and one that is silently dropped.
 *
 * Focus is never moved. SC 4.1.3 exists precisely so a status message can be
 * announced *without* stealing focus — yanking the user out of the field they
 * were completing to read a "saved" notification is a worse outcome than not
 * announcing it.
 *
 * Auto-dismiss is off by default. A message that disappears on a timer is a
 * race that slow readers, screen-reader users and anyone who looked away all
 * lose.
 */
@Component({
  selector: 'aal-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './alert.css',
  template: `
    <!--
      Rendered unconditionally. A live region inserted at the same instant as
      its text is often missed entirely — the screen reader was not watching
      the node yet. The @if lives INSIDE, on the content, never on the region.
    -->
    <div
      class="aal-alert-region"
      [attr.role]="role()"
      [attr.aria-live]="ariaLive()"
      [attr.aria-atomic]="'true'"
    >
      @if (message()) {
        <div class="aal-alert" [class]="'aal-alert--' + tone()">
          <!-- Decorative: the tone is carried by the text and the role. -->
          <span class="aal-alert__icon" aria-hidden="true">{{ icon() }}</span>

          <div class="aal-alert__content">
            @if (heading()) {
              <p class="aal-alert__heading">{{ heading() }}</p>
            }
            <p class="aal-alert__message">
              <!--
                The tone is stated in words as well as colour and icon: a red
                border says nothing to a screen-reader user, and nothing at all
                to someone with a colour-vision deficiency (AR-13 / SC 1.4.1).
              -->
              <span class="aal-visually-hidden">{{ toneLabel() }}: </span>
              {{ message() }}
            </p>
          </div>

          @if (dismissible()) {
            <button
              type="button"
              class="aal-alert__dismiss"
              [attr.aria-label]="dismissLabel()"
              (click)="dismissed.emit()"
            >
              <span aria-hidden="true">✕</span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class AalAlert {
  private readonly ids = inject(AriaIdService);

  readonly alertId = this.ids.next('aal-alert');

  /** The message. Empty renders nothing, but keeps the live region present. */
  readonly message = input<string>('');

  readonly heading = input<string>('');
  readonly tone = input<AalAlertTone>('info');

  /**
   * Interrupt the user immediately.
   *
   * Reserve for content they must hear before continuing. Defaults to false,
   * because the polite default is right for almost everything.
   */
  readonly assertive = input(false, { transform: booleanAttribute });

  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly dismissLabel = input('Dismiss message');

  readonly dismissed = output<void>();

  /**
   * `alert` is implicitly assertive; `status` is implicitly polite.
   *
   * Both the role and aria-live are set: the role gives semantics that some
   * assistive technology uses for filtering, and the explicit aria-live avoids
   * relying on each reader's implicit mapping being what we expect.
   */
  protected readonly role = computed(() => (this.assertive() ? 'alert' : 'status'));
  protected readonly ariaLive = computed(() => (this.assertive() ? 'assertive' : 'polite'));

  protected readonly icon = computed(
    () => ({ info: 'ℹ', success: '✓', warning: '⚠', error: '⚠' })[this.tone()],
  );

  /** Spoken prefix, so the tone survives without colour or the icon. */
  protected readonly toneLabel = computed(
    () =>
      ({ info: 'Information', success: 'Success', warning: 'Warning', error: 'Error' })[this.tone()],
  );
}
