import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { A11yAssertService, injectAalConfig } from '@aal/a11y-core';
import { AalVisuallyHidden } from '@aal/components/visually-hidden';

export type AalLinkVariant = 'default' | 'subtle' | 'inverse';

/**
 * Accessible link (PRD §9.9).
 *
 * A link navigates; a button performs an action. The distinction is not
 * pedantry — screen-reader users navigate by pulling up a list of links, and
 * an "Add to basket" control that is really a link pollutes that list while
 * being announced with entirely the wrong affordance. If it does not change
 * the URL, it is a `<aal-button>`.
 *
 * What this adds over a bare `<a>`:
 *
 * - **Underlined by default.** SC 1.4.1 forbids colour as the only means of
 *   conveying information, and "this text is a link" is information. Removing
 *   the underline is possible, but it is an opt-in that requires the consumer
 *   to have decided their surrounding design distinguishes links some other
 *   way.
 * - **`aria-current` for the current page**, so a screen-reader user knows
 *   which nav item they are on rather than inferring it from a colour.
 * - **New-tab warning in the accessible name.** SC 3.2.5: opening a new tab
 *   unannounced disorients screen-reader users, and breaks the Back button for
 *   everyone. A visually-hidden "(opens in a new tab)" is appended.
 * - **`rel="noopener noreferrer"`** on `target="_blank"`, automatically — a
 *   security default, not an accessibility one, but it should never be
 *   something a consumer has to remember.
 */
@Component({
  selector: 'aal-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AalVisuallyHidden],
  styleUrl: './link.css',
  template: `
    <a
      class="aal-link"
      [class]="'aal-link--' + variant()"
      [class.aal-link--no-underline]="!underline()"
      [attr.href]="href()"
      [attr.target]="newTab() ? '_blank' : null"
      [attr.rel]="rel()"
      [attr.aria-current]="current() || null"
      [attr.aria-describedby]="describedBy() || null"
      [attr.download]="download() || null"
    >
      <ng-content />
      @if (newTab()) {
        <!--
          SC 3.2.5. Part of the accessible name, so it is announced with the
          link rather than discovered afterwards. Visually hidden because a
          sighted user gets the same information from the icon.
        -->
        <span aalVisuallyHidden>{{ newTabHint() }}</span>
        <span class="aal-link__external-icon" aria-hidden="true">↗</span>
      }
    </a>
  `,
})
export class AalLink {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly assert = inject(A11yAssertService);
  private readonly config = injectAalConfig();

  readonly href = input.required<string>();
  readonly variant = input<AalLinkVariant>('default');

  /**
   * Underline the link. Defaults to true.
   *
   * Turning it off is a deliberate decision that the surrounding design
   * distinguishes links by something other than colour (SC 1.4.1) — position
   * in a nav bar, for instance. It is not a styling preference.
   */
  readonly underline = input(true, { transform: booleanAttribute });

  /** Opens in a new tab, with the SC 3.2.5 warning and rel hardening applied. */
  readonly newTab = input(false, { transform: booleanAttribute });

  /** Text of the new-tab warning. Localisable via `provideAal()`. */
  readonly newTabHint = input('(opens in a new tab)');

  /**
   * Marks this link as representing the user's current location.
   * `page` for navigation; `step`, `location` and the rest for their patterns.
   */
  readonly current = input<'page' | 'step' | 'location' | 'date' | 'time' | 'true' | ''>('');

  readonly describedBy = input<string>('');
  readonly download = input<string>('');

  /** Hardened automatically — a consumer should never have to remember this. */
  protected readonly rel = computed(() => (this.newTab() ? 'noopener noreferrer' : null));

  constructor() {
    afterNextRender(() => {
      const anchor = this.host.nativeElement.querySelector('a');
      if (!anchor) return;

      this.assert.assertAccessibleName(anchor, 'aal-link');

      // SC 2.4.4 Link Purpose. "Click here" and "read more" are meaningless in
      // a screen reader's link list, which is presented out of context — the
      // user gets fifteen entries reading "read more" and no way to choose.
      const text = anchor.textContent?.trim().toLowerCase() ?? '';
      const vague = ['click here', 'here', 'read more', 'more', 'link', 'this'];
      if (vague.includes(text)) {
        this.assert.fail(
          'SC 2.4.4',
          `<aal-link> has the link text "${anchor.textContent?.trim()}". Screen-reader users navigate by a list of links presented out of context, where several entries reading "${text}" are indistinguishable.`,
          'Use text that describes the destination, e.g. "Read the 2026 accessibility report".',
        );
      }
    });
  }

  /** Exposed for tests and for consumers that need the resolved config. */
  protected get strings() {
    return this.config.strings;
  }
}
