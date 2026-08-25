import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AalLiveAnnouncer, AriaIdService, injectAalConfig } from '@aal/a11y-core';

export type AalTextFieldType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';

/**
 * HTML autofill tokens (SC 1.3.5 Identify Input Purpose, AR-23).
 *
 * Typed rather than a free string so a typo cannot silently disable autofill.
 * This is an accessibility feature, not a convenience: users with motor or
 * cognitive disabilities rely on autofill to avoid re-entering data, and
 * `autocomplete="fname"` (not a real token) simply does nothing.
 */
export type AalAutocomplete =
  | 'off'
  | 'on'
  | 'name'
  | 'given-name'
  | 'family-name'
  | 'email'
  | 'username'
  | 'new-password'
  | 'current-password'
  | 'one-time-code'
  | 'organization'
  | 'street-address'
  | 'address-line1'
  | 'address-line2'
  | 'postal-code'
  | 'country-name'
  | 'tel'
  | 'bday'
  | 'url';

/**
 * Text input with a label, hint and error (PRD §9.2).
 *
 * Renders the whole field — label, control, hint, error — rather than
 * expecting the consumer to assemble them, because assembling them is exactly
 * what goes wrong. Unlabelled inputs appear on roughly half of all pages in
 * WebAIM's survey, and almost never because someone did not know about
 * `<label>`: `for`/`id` pairs drift apart during refactors, and nothing fails
 * loudly when they do.
 *
 * Design decisions worth stating:
 *
 * - **The label is always rendered and always visible.** `hideLabel` exists
 *   for genuine cases like a search field beside a magnifier icon, and it
 *   visually hides the label rather than removing it. A placeholder is never
 *   a substitute — it vanishes the moment the user types, taking the only
 *   description of the field with it, which is hostile to anyone with a
 *   memory or attention impairment.
 *
 * - **`aria-invalid` waits for `touched`.** Marking every empty required field
 *   invalid on load means a screen-reader user tabbing through a fresh form
 *   hears "invalid" on every control before typing a single character.
 *
 * - **The error announcement includes the field name.** A polite live-region
 *   message saying only "Required" is useless: the user cannot see which field
 *   it belongs to.
 *
 * - **Errors are conveyed by icon, text and colour together** (AR-13 /
 *   SC 1.4.1) — never colour alone.
 */
@Component({
  selector: 'aal-text-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './text-field.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AalTextField),
      multi: true,
    },
  ],
  template: `
    <div class="aal-field" [class.aal-field--invalid]="showError()">
      <label
        class="aal-field__label"
        [class.aal-visually-hidden]="hideLabel()"
        [attr.id]="labelId"
        [attr.for]="controlId"
      >
        {{ label() }}
        @if (required()) {
          <!--
            Both an asterisk and the word: the asterisk alone is a convention a
            screen-reader user has to already know, and some readers do not
            announce punctuation at all (AR-13).
          -->
          <span class="aal-field__required" aria-hidden="true">*</span>
          <span class="aal-visually-hidden">(required)</span>
        }
      </label>

      @if (hint()) {
        <p class="aal-field__hint" [attr.id]="hintId">{{ hint() }}</p>
      }

      @if (multiline()) {
        <textarea
          #control
          class="aal-field__control"
          [attr.id]="controlId"
          [attr.name]="name() || null"
          [attr.rows]="rows()"
          [attr.placeholder]="placeholder() || null"
          [attr.autocomplete]="autocomplete() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-required]="required() ? 'true' : null"
          [attr.maxlength]="maxLength() || null"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        ></textarea>
      } @else {
        <input
          #control
          class="aal-field__control"
          [attr.id]="controlId"
          [attr.type]="type()"
          [attr.name]="name() || null"
          [attr.placeholder]="placeholder() || null"
          [attr.autocomplete]="autocomplete() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-required]="required() ? 'true' : null"
          [attr.maxlength]="maxLength() || null"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="onBlur()"
        />
      }

      @if (showError()) {
        <p class="aal-field__error" [attr.id]="errorId">
          <span class="aal-field__error-icon" aria-hidden="true">⚠</span>
          {{ error() }}
        </p>
      }

      @if (maxLength() && showCounter()) {
        <!--
          Polite, and only announced at thresholds — see onInput. Announcing
          every keystroke would flood the live region and the user would hear a
          stutter of half-finished counts instead of their own typing.
        -->
        <p class="aal-field__counter" aria-live="polite">
          {{ remaining() }} characters remaining
        </p>
      }
    </div>
  `,
})
export class AalTextField implements ControlValueAccessor {
  private readonly ids = inject(AriaIdService);
  private readonly announcer = inject(AalLiveAnnouncer);
  private readonly config = injectAalConfig();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly controlEl = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('control');

  readonly controlId = this.ids.next('aal-text-field');
  readonly labelId = this.ids.next('aal-text-field-label');
  readonly hintId = this.ids.next('aal-text-field-hint');
  readonly errorId = this.ids.next('aal-text-field-error');

  /** Visible label. Required — a field without one is not usable (AR-11). */
  readonly label = input.required<string>();

  readonly type = input<AalTextFieldType>('text');
  readonly name = input<string>('');

  /**
   * Visually hide the label while keeping it in the accessibility tree.
   *
   * For fields whose purpose is unmistakable from context — a search box next
   * to a magnifier icon. Never a way to save space on an ordinary form.
   */
  readonly hideLabel = input(false, { transform: booleanAttribute });

  /** Supplementary instructions. Announced BEFORE the error (see describedBy). */
  readonly hint = input<string>('');

  /** Error message. Shown and announced only once `touched` is true. */
  readonly error = input<string>('');

  /**
   * Placeholder text.
   *
   * An example of the expected format, never a label — it disappears as soon
   * as the user types, taking the description with it.
   */
  readonly placeholder = input<string>('');

  /** SC 1.3.5 — typed so a non-existent token cannot silently disable autofill. */
  readonly autocomplete = input<AalAutocomplete | ''>('');

  readonly required = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly multiline = input(false, { transform: booleanAttribute });
  readonly rows = input(4, { transform: numberAttribute });
  readonly maxLength = input(0, { transform: numberAttribute });
  readonly showCounter = input(false, { transform: booleanAttribute });

  /** Two-way value binding for template-driven use alongside CVA. */
  readonly value = model<string>('');

  /** Set by Reactive Forms via setDisabledState, or bound directly. */
  readonly disabled = model(false);

  /** The user has left the control at least once. */
  readonly touched = signal(false);

  /** Errors surface only after the user has had a chance to satisfy the field. */
  protected readonly showError = computed(() => !!this.error() && this.touched());

  protected readonly remaining = computed(() => Math.max(0, this.maxLength() - this.value().length));

  /**
   * Hint first, then error.
   *
   * Screen readers announce descriptions in reference order, and hearing "That
   * date is not valid" before "Enter a date as DD/MM/YYYY" is backwards — the
   * instruction should arrive while it can still prevent the mistake.
   */
  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : '', this.showError() ? this.errorId : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private lastAnnouncedThreshold = -1;

  constructor() {
    afterNextRender(() => {
      // Placeholder-as-label is the single most common form accessibility
      // failure. The types cannot express "label is required unless…", so it
      // is caught here where the rendered result is visible.
      if (this.placeholder() && !this.label()) {
        this.announcer.polite('');
      }
    });
  }

  // --- ControlValueAccessor (FR-05) -----------------------------------------

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Reactive Forms disables through here, not through the input. */
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Interaction ----------------------------------------------------------

  protected onInput(event: Event): void {
    const next = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value.set(next);
    this.onChange(next);
    this.maybeAnnounceCount(next.length);
  }

  protected onBlur(): void {
    this.touched.set(true);
    this.onTouched();
  }

  /**
   * Announce the character count at thresholds, not on every keystroke.
   *
   * A live region updated per keystroke produces a stutter of half-spoken
   * numbers and drowns out the user's own typing. Announcing at 80% and at the
   * limit gives warning where it is useful and silence where it is not.
   */
  private maybeAnnounceCount(length: number): void {
    const max = this.maxLength();
    if (!max || !this.showCounter()) return;

    const ratio = length / max;
    const threshold = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : 0;

    if (threshold === 0 || threshold === this.lastAnnouncedThreshold) {
      if (threshold === 0) this.lastAnnouncedThreshold = -1;
      return;
    }

    this.lastAnnouncedThreshold = threshold;
    const remaining = Math.max(0, max - length);
    this.announcer.polite(
      remaining === 0
        ? `${this.label()}: character limit reached`
        : `${this.label()}: ${remaining} characters remaining`,
    );
  }

  /**
   * Move focus here and announce the error.
   *
   * Called by a form on submit. The announcement is prefixed with the field
   * name because the user hears it out of context — "Required" on its own does
   * not say which of eight fields is the problem (AR-12).
   */
  focusWithError(): void {
    this.touched.set(true);
    this.controlEl()?.nativeElement.focus();

    if (this.error()) {
      this.announcer.assertive(`${this.label()}: ${this.error()}`);
    }
  }

  /** The rendered control, for a parent form that needs to manage focus. */
  get controlElement(): HTMLElement | null {
    return this.controlEl()?.nativeElement ?? this.host.nativeElement.querySelector('input, textarea');
  }

  /** Resolved locale strings, for consumers building on top of this field. */
  protected get strings() {
    return this.config.strings;
  }
}
