import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  afterNextRender,
} from '@angular/core';
import { A11yAssertService, AalLiveAnnouncer, injectAalConfig } from '@aal/a11y-core';

/**
 * Visual treatment. A discriminated string union, never three booleans —
 * `[primary]="true" [danger]="true"` is representable and meaningless
 * (PRD §7.11 rule 1).
 */
export type AalButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type AalButtonSize = 'small' | 'medium' | 'large';

/**
 * Native button type. Defaults to `button`, NOT `submit`.
 *
 * The HTML default is `submit`, which means a button dropped into a form
 * submits it unexpectedly — a genuine accessibility problem, because a
 * keyboard user pressing Enter gets an action they did not ask for. Defaulting
 * to `button` makes submission explicit.
 */
export type AalButtonType = 'button' | 'submit' | 'reset';

/**
 * Accessible button (PRD §9.1).
 *
 * A native `<button>`, always — never a `<div>` with a click handler. Native
 * gives keyboard operation, the correct implicit role, form participation and
 * platform accessibility-API integration for free, and no quantity of ARIA
 * reproduces all of it.
 *
 * The interesting behaviour is in the states, which is where real buttons fail:
 *
 * **Loading.** Stays focusable and reports `aria-disabled`, rather than taking
 * the native `disabled` attribute. A natively-disabled element cannot hold
 * focus, so disabling the button the user just activated throws their focus to
 * `<body>` — they lose their place at the exact moment they are waiting to
 * find out whether their action worked.
 *
 * **Icon-only.** No `iconOnly` input exists. The dev-mode assertion checks the
 * RENDERED accessible name, which is the actual requirement: projecting an
 * `aria-hidden` icon and nothing else fails, whether or not anyone remembered
 * to set a flag.
 *
 * **Toggle.** `aria-pressed` only when `pressed` is explicitly bound. An
 * always-present `aria-pressed="false"` would announce every ordinary button
 * as an unpressed toggle.
 */
@Component({
  selector: 'aal-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './button.css',
  template: `
    <button
      class="aal-button"
      [class]="'aal-button--' + variant() + ' aal-button--' + size()"
      [class.aal-button--busy]="loading()"
      [attr.type]="type()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-pressed]="pressed() ?? null"
      [attr.aria-expanded]="expanded() ?? null"
      [attr.aria-controls]="controls() || null"
      [attr.aria-haspopup]="hasPopup() || null"
      [attr.aria-describedby]="describedBy() || null"
      [attr.aria-disabled]="loading() ? 'true' : null"
      [attr.aria-busy]="loading() ? 'true' : null"
      [disabled]="disabled() && !loading()"
      (click)="activate($event)"
    >
      @if (loading()) {
        <!--
          Decorative: the loading STATE is conveyed by aria-busy and announced
          politely. Exposing the spinner to AT as well would say it twice.
        -->
        <span class="aal-button__spinner" aria-hidden="true"></span>
      }
      <span class="aal-button__label"><ng-content /></span>
    </button>
  `,
})
export class AalButton {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly assert = inject(A11yAssertService);
  private readonly announcer = inject(AalLiveAnnouncer);
  private readonly config = injectAalConfig();

  readonly variant = input<AalButtonVariant>('primary');
  readonly size = input<AalButtonSize>('medium');
  readonly type = input<AalButtonType>('button');

  /**
   * Accessible name, for buttons whose content cannot supply one — an icon,
   * typically. Prefer projected text: it is naturally localisable and cannot
   * drift out of step with what is displayed (PRD §7.11 rule 4).
   */
  readonly ariaLabel = input<string>('');

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });

  /** Text announced politely while loading. Defaults to the configured locale string. */
  readonly loadingLabel = input<string>('');

  /** Toggle state. Leave undefined for an ordinary button — see the class docs. */
  readonly pressed = input<boolean | undefined>(undefined);

  /** Disclosure state, when this button controls a collapsible region. */
  readonly expanded = input<boolean | undefined>(undefined);

  /** ID of the region this button controls. */
  readonly controls = input<string>('');

  /** Type of popup this button opens, if any. */
  readonly hasPopup = input<'menu' | 'listbox' | 'dialog' | 'grid' | 'tree' | ''>('');

  /** ID of descriptive text. Consumers may add descriptive ARIA (PRD §7.11 rule 3). */
  readonly describedBy = input<string>('');

  readonly activated = output<MouseEvent>();

  /**
   * Disabled or loading — either way, activation is refused.
   *
   * Note the template exposes `aria-disabled` only while LOADING, not when
   * natively disabled. A natively-disabled element already communicates the
   * state through the platform accessibility API; adding `aria-disabled` on
   * top is redundant and some screen readers announce it twice. The two
   * mechanisms are alternatives, not partners.
   */
  protected readonly inactive = computed(() => this.disabled() || this.loading());

  constructor() {
    afterNextRender(() => {
      // Checks the RENDERED name, not whether an input was supplied: projected
      // content, aria-label and aria-labelledby can each provide it, and only
      // the computed result reveals whether one actually did.
      this.assert.assertAccessibleName(
        this.host.nativeElement.querySelector('button') ?? this.host.nativeElement,
        'aal-button',
        'https://github.com/abdu-rr-asheed/Web-UI-aal/blob/main/docs/patterns/button.md',
      );
    });
  }

  protected activate(event: MouseEvent): void {
    // aria-disabled elements remain clickable in the DOM, so refusal has to be
    // explicit — that is the cost of keeping them focusable, and it is worth
    // paying to avoid throwing focus to <body>.
    if (this.inactive()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.activated.emit(event);
  }

  /**
   * Announce the loading state politely.
   *
   * Called by the consumer when an async action starts. Not automatic on the
   * `loading` input, because the component cannot know whether the change is
   * worth interrupting for — a background refresh should be silent, a
   * user-initiated save should not.
   */
  announceLoading(): void {
    this.announcer.polite(this.loadingLabel() || this.config.strings.loading);
  }
}
