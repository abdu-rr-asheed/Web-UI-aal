import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AriaIdService } from '@aal/a11y-core';
import type { AalListboxOption } from '@aal/primitives/listbox';

/**
 * Native select — **the recommended default** (PRD §9.4).
 *
 * For single-select from a flat list of options, this is the better component
 * and `<aal-select>` is the compromise. A native `<select>`:
 *
 * - opens the platform picker on mobile, which is a wheel on iOS and a
 *   full-screen list on Android, both far easier to operate one-handed than
 *   any popup a web page can draw
 * - carries a keyboard model tuned over decades, including behaviours no
 *   custom widget reliably reproduces (type-ahead that respects the OS repeat
 *   delay, and the platform's own scroll physics)
 * - is understood by every screen reader on every platform without the
 *   library having to test the combination
 * - cannot break: there is no state machine to get wrong
 *
 * The custom `<aal-select>` exists for what native genuinely cannot do —
 * usable multi-select, grouped options with rich content, consistent
 * cross-platform styling. Reaching for it by default trades away real
 * accessibility for visual consistency, which is the wrong way round.
 *
 * Documenting that trade rather than hiding it is deliberate: a component
 * library that quietly steers people onto the custom widget is a library that
 * makes accessibility worse while appearing to help.
 */
@Component({
  selector: 'aal-native-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './select.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AalNativeSelect), multi: true },
  ],
  template: `
    <div class="aal-select" [class.aal-select--invalid]="showError()">
      <label
        class="aal-select__label"
        [class.aal-visually-hidden]="hideLabel()"
        [attr.for]="controlId"
      >
        {{ label() }}
        @if (required()) {
          <span class="aal-visually-hidden">(required)</span>
        }
      </label>

      @if (hint()) {
        <p class="aal-select__hint" [attr.id]="hintId">{{ hint() }}</p>
      }

      <select
        class="aal-select__native"
        [attr.id]="controlId"
        [attr.name]="name() || null"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="showError() ? 'true' : null"
        [attr.aria-required]="required() ? 'true' : null"
        [disabled]="disabled()"
        [value]="value()"
        (change)="onSelect($event)"
        (blur)="onBlur()"
      >
        @if (placeholder()) {
          <!--
            An empty value so a required select genuinely fails validation
            until the user chooses. A placeholder option carrying a real value
            silently satisfies the required constraint and defeats the point.
          -->
          <option value="" [disabled]="required()">{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value" [disabled]="option.disabled ?? false">
            {{ option.label }}
          </option>
        }
      </select>

      @if (showError()) {
        <p class="aal-select__error" [attr.id]="errorId">
          <span aria-hidden="true">⚠</span>
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class AalNativeSelect implements ControlValueAccessor {
  private readonly ids = inject(AriaIdService);

  readonly controlId = this.ids.next('aal-native-select');
  readonly hintId = this.ids.next('aal-native-select-hint');
  readonly errorId = this.ids.next('aal-native-select-error');

  readonly label = input.required<string>();
  readonly options = input.required<readonly AalListboxOption[]>();

  readonly name = input<string>('');
  readonly placeholder = input('Select an option');
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly hideLabel = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });

  readonly value = model<string>('');
  readonly disabled = model(false);
  readonly touched = signal(false);

  protected readonly showError = computed(() => !!this.error() && this.touched());

  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : '', this.showError() ? this.errorId : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private onChange: (v: string) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

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

  protected onSelect(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value.set(next);
    this.onChange(next);
  }

  protected onBlur(): void {
    this.touched.set(true);
    this.onTouchedFn();
  }
}
