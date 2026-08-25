import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AriaIdService } from '@aal/a11y-core';

export interface AalRadioOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
  readonly disabled?: boolean;
}

/**
 * Radio group (PRD §9.3, APG Radio Group pattern).
 *
 * Takes its options as data rather than projected content, deliberately. A
 * radio group is not a container of independent controls — it is ONE control
 * with several values, and its accessibility properties (single tab stop,
 * arrow-key selection, group name) are properties of the whole. Letting
 * consumers project arbitrary children invites a group whose members have
 * mismatched `name` attributes, which silently becomes several one-option
 * groups that all appear selectable at once.
 *
 * ## Why native inputs inside a fieldset
 *
 * `<fieldset>` + `<legend>` gives a group of controls a shared accessible name
 * natively. A screen reader announces "Delivery method, radio button, Standard,
 * 1 of 3" — the group name, the role, the option, and the position.
 * Reproducing that with a div, `role="radiogroup"` and `aria-label` loses the
 * position announcement in several readers.
 *
 * The fieldset also carries an explicit `role="radiogroup"`. A bare fieldset
 * maps to role `group`, which does not say what kind of group it is; the
 * Playwright tree assertion caught that the computed role was `group` even
 * though the markup looked correct — which is exactly why TR-04 requires
 * assertions against the tree rather than the DOM.
 *
 * Native radios also give the roving-tabindex behaviour for free: the browser
 * already makes a same-`name` radio group a single tab stop with arrow-key
 * selection that wraps. Re-implementing it with `AalRovingTabindex` would be
 * duplicating platform behaviour that assistive technology already understands
 * — the opposite of what PRD §6.3.1 asks for.
 */
@Component({
  selector: 'aal-radio-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './choice.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AalRadioGroup), multi: true },
  ],
  template: `
    <fieldset
      class="aal-radio-group"
      role="radiogroup"
      [attr.aria-describedby]="describedBy()"
      [attr.aria-required]="required() ? 'true' : null"
      [disabled]="disabled()"
    >
      <!--
        <legend> supplies the group's accessible name natively — an aria-label
        on a div would lose the "1 of 3" position announcement in several
        readers.

        role="radiogroup" is added on top because a bare <fieldset> maps to
        role="group", which does not say WHAT kind of group it is. The native
        radios are still grouped by their shared name, so this is belt and
        braces rather than a replacement: the tree now states the relationship
        explicitly instead of leaving it to be inferred.
      -->
      <legend class="aal-radio-group__legend" [class.aal-visually-hidden]="hideLegend()">
        {{ legend() }}
        @if (required()) {
          <span class="aal-visually-hidden">(required)</span>
        }
      </legend>

      @if (hint()) {
        <p class="aal-choice__hint" [attr.id]="hintId">{{ hint() }}</p>
      }

      @for (option of options(); track option.value) {
        <div class="aal-choice" [class.aal-choice--disabled]="option.disabled || disabled()">
          <input
            type="radio"
            class="aal-choice__input"
            [attr.id]="controlId + '-' + option.value"
            [attr.name]="groupName()"
            [attr.value]="option.value"
            [attr.aria-describedby]="option.hint ? controlId + '-hint-' + option.value : null"
            [checked]="value() === option.value"
            [disabled]="option.disabled || disabled()"
            [required]="required()"
            (change)="select(option.value)"
            (blur)="onTouched()"
          />
          <span class="aal-choice__indicator aal-choice__indicator--radio" aria-hidden="true">
            @if (value() === option.value) {
              <span class="aal-choice__dot"></span>
            }
          </span>
          <label class="aal-choice__label" [attr.for]="controlId + '-' + option.value">
            {{ option.label }}
          </label>
          @if (option.hint) {
            <p class="aal-choice__hint" [attr.id]="controlId + '-hint-' + option.value">{{ option.hint }}</p>
          }
        </div>
      }

      @if (showError()) {
        <p class="aal-field__error" [attr.id]="errorId">
          <span class="aal-field__error-icon" aria-hidden="true">⚠</span>
          {{ error() }}
        </p>
      }
    </fieldset>
  `,
})
export class AalRadioGroup implements ControlValueAccessor {
  private readonly ids = inject(AriaIdService);

  readonly controlId = this.ids.next('aal-radio');
  readonly hintId = this.ids.next('aal-radio-hint');
  readonly errorId = this.ids.next('aal-radio-error');

  /** The group's accessible name, rendered as a `<legend>`. Required. */
  readonly legend = input.required<string>();

  readonly options = input.required<readonly AalRadioOption[]>();

  /**
   * Shared `name` for the native radios. Defaults to a generated ID.
   *
   * Radios only form one group — and therefore one tab stop with arrow-key
   * selection — when they share a name. Getting this wrong silently produces
   * several one-option groups that all appear selectable simultaneously.
   */
  readonly name = input<string>('');

  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly required = input(false, { transform: booleanAttribute });
  readonly touched = model(false);

  /**
   * Visually hide the legend while keeping it in the accessibility tree.
   * For a group whose purpose is already stated by an adjacent heading.
   */
  readonly hideLegend = input(false, { transform: booleanAttribute });

  readonly value = model<string>('');
  readonly disabled = model(false);

  protected readonly groupName = computed(() => this.name() || this.controlId);
  protected readonly showError = computed(() => !!this.error() && this.touched());

  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : '', this.showError() ? this.errorId : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private onChange: (v: string) => void = () => undefined;
  protected onTouchedFn: () => void = () => undefined;

  writeValue(v: string | null): void {
    this.value.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onTouched(): void {
    this.touched.set(true);
    this.onTouchedFn();
  }

  protected select(next: string): void {
    this.value.set(next);
    this.onChange(next);
  }
}
