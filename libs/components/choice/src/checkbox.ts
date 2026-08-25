import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  forwardRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AriaIdService } from '@aal/a11y-core';

/**
 * Checkbox (PRD §9.3, APG Checkbox pattern).
 *
 * A **real** `<input type="checkbox">`, visually restyled rather than replaced.
 * The native input is kept in the DOM and merely made transparent — never
 * `display: none`, never `visibility: hidden`, never `appearance: none` on a
 * `<div>` pretending to be a control.
 *
 * That distinction is the whole component. A hidden native input keeps:
 *
 * - `Space` toggling, without a keydown handler that has to re-implement it
 * - the correct role, state and change events for free
 * - form participation, including `name`/`value` submission
 * - **Windows High Contrast rendering** — the OS draws real checkboxes itself,
 *   so a CSS-only "checkbox" made of borders and a pseudo-element simply
 *   vanishes in forced-colors mode, taking the checked state with it
 *
 * The indeterminate state uses `aria-checked="mixed"`, which is the only way to
 * express "some but not all" — a common tri-state parent checkbox otherwise
 * announces as plainly unchecked, telling the user the opposite of the truth.
 */
@Component({
  selector: 'aal-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './choice.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AalCheckbox), multi: true },
  ],
  template: `
    <div class="aal-choice" [class.aal-choice--disabled]="disabled()">
      <input
        #control
        type="checkbox"
        class="aal-choice__input"
        [attr.id]="controlId"
        [attr.name]="name() || null"
        [attr.value]="value() || null"
        [attr.aria-describedby]="hint() ? hintId : null"
        [attr.aria-checked]="indeterminate() ? 'mixed' : null"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [required]="required()"
        (change)="toggle($event)"
        (blur)="onTouched()"
      />
      <!--
        Decorative. The native input above is the control; this only draws it.
        aria-hidden so the tree describes one checkbox, not two.
      -->
      <span class="aal-choice__indicator" aria-hidden="true">
        @if (indeterminate()) {
          <span class="aal-choice__dash"></span>
        } @else if (checked()) {
          <span class="aal-choice__tick"></span>
        }
      </span>
      <label class="aal-choice__label" [attr.for]="controlId">
        <ng-content />
        @if (required()) {
          <span class="aal-visually-hidden">(required)</span>
        }
      </label>
    </div>
    @if (hint()) {
      <p class="aal-choice__hint" [attr.id]="hintId">{{ hint() }}</p>
    }
  `,
})
export class AalCheckbox implements ControlValueAccessor {
  private readonly ids = inject(AriaIdService);
  private readonly controlEl = viewChild<ElementRef<HTMLInputElement>>('control');

  readonly controlId = this.ids.next('aal-checkbox');
  readonly hintId = this.ids.next('aal-checkbox-hint');

  readonly name = input<string>('');
  readonly value = input<string>('');
  readonly hint = input<string>('');
  readonly required = input(false, { transform: booleanAttribute });

  readonly checked = model(false);
  readonly disabled = model(false);

  /**
   * Tri-state: "some but not all" for a parent controlling a group.
   *
   * Renders `aria-checked="mixed"`. Without it a partially-selected parent
   * announces as unchecked, which tells the user the opposite of the truth.
   */
  readonly indeterminate = input(false, { transform: booleanAttribute });

  private onChange: (v: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(v: boolean | null): void {
    this.checked.set(!!v);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected toggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.checked.set(next);
    this.onChange(next);
  }

  /** The native input, for a parent form managing focus. */
  get controlElement(): HTMLInputElement | null {
    return this.controlEl()?.nativeElement ?? null;
  }
}

/**
 * Switch (APG Switch pattern).
 *
 * A checkbox with `role="switch"`. The difference is semantic, not cosmetic:
 * a checkbox is "include this", a switch is "this is on or off, and it takes
 * effect immediately". Screen readers announce them differently, and a
 * settings toggle announced as a checkbox implies a Save button that is not
 * coming.
 *
 * Still a native `<input type="checkbox">` underneath, for the same reasons as
 * the checkbox above.
 */
@Component({
  selector: 'aal-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './choice.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AalSwitch), multi: true }],
  template: `
    <div class="aal-choice aal-choice--switch" [class.aal-choice--disabled]="disabled()">
      <input
        #control
        type="checkbox"
        role="switch"
        class="aal-choice__input"
        [attr.id]="controlId"
        [attr.name]="name() || null"
        [attr.aria-describedby]="hint() ? hintId : null"
        [attr.aria-checked]="ariaChecked()"
        [checked]="checked()"
        [disabled]="disabled()"
        (change)="toggle($event)"
        (blur)="onTouched()"
      />
      <span class="aal-switch__track" aria-hidden="true">
        <span class="aal-switch__thumb"></span>
      </span>
      <label class="aal-choice__label" [attr.for]="controlId"><ng-content /></label>
    </div>
    @if (hint()) {
      <p class="aal-choice__hint" [attr.id]="hintId">{{ hint() }}</p>
    }
  `,
})
export class AalSwitch implements ControlValueAccessor {
  private readonly ids = inject(AriaIdService);
  private readonly controlEl = viewChild<ElementRef<HTMLInputElement>>('control');

  readonly controlId = this.ids.next('aal-switch');
  readonly hintId = this.ids.next('aal-switch-hint');

  readonly name = input<string>('');
  readonly hint = input<string>('');
  readonly checked = model(false);
  readonly disabled = model(false);

  /**
   * ARIA requires aria-checked on role="switch".
   *
   * Set explicitly rather than relying on the native checkbox's implicit
   * checked -> aria-checked mapping: once the role is overridden to "switch",
   * that mapping is no longer guaranteed across assistive technologies, and a
   * switch reporting no state is worse than no switch.
   */
  protected readonly ariaChecked = computed(() => (this.checked() ? 'true' : 'false'));

  private onChange: (v: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(v: boolean | null): void {
    this.checked.set(!!v);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected toggle(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.checked.set(next);
    this.onChange(next);
  }

  get controlElement(): HTMLInputElement | null {
    return this.controlEl()?.nativeElement ?? null;
  }
}
