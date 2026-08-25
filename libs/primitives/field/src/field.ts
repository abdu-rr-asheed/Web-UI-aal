import {
  Directive,
  ElementRef,
  Signal,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { A11yAssertService, AriaIdService } from '@aal/a11y-core';

/** Everything a field's children need to wire themselves up correctly. */
export interface AalFieldState {
  readonly controlId: string;
  readonly labelId: string;
  readonly hintId: string;
  readonly errorId: string;
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
  readonly disabled: Signal<boolean>;
  readonly labelText: Signal<string>;
}

/**
 * Form field primitive (PRD §9.2, §7.5.1).
 *
 * Owns the ARIA relationships that bind a label, a control, a hint and an
 * error into one accessible unit. Every AAL form control composes this rather
 * than re-deriving the wiring, because the wiring is where form accessibility
 * actually fails: WebAIM's Million report finds unlabelled inputs on roughly
 * half of all pages, and the cause is almost never ignorance of `<label>` — it
 * is `for`/`id` pairs drifting apart as components get refactored.
 *
 * Children discover this directive through hierarchical DI and read their own
 * IDs from it. Nothing is passed down as an input, so nothing can be passed
 * down wrongly.
 *
 * ## What it guarantees
 *
 * - **A label is always associated.** IDs come from `AriaIdService`, never
 *   hand-rolled, so two fields on one page cannot collide (FR-07).
 * - **`aria-describedby` lists hint then error, in that order.** Screen
 *   readers announce descriptions in DOM-reference order; hearing the error
 *   before the instruction that would have prevented it is backwards.
 * - **`aria-invalid` appears only when invalid AND touched.** Marking a field
 *   invalid before the user has typed anything means a screen-reader user
 *   tabbing through a fresh form hears "invalid" on every control (AR-12).
 * - **The label's text is exposed** so the styled layer can prefix error
 *   announcements with it — a live-region message saying only "Required" is
 *   useless when the user cannot see which field it belongs to.
 */
@Directive({
  selector: '[aalField]',
  standalone: true,
  exportAs: 'aalField',
})
export class AalField implements AalFieldState {
  private readonly ids = inject(AriaIdService);
  private readonly assert = inject(A11yAssertService);

  readonly controlId = this.ids.next('aal-field-control');
  readonly labelId = this.ids.next('aal-field-label');
  readonly hintId = this.ids.next('aal-field-hint');
  readonly errorId = this.ids.next('aal-field-error');

  /**
   * The field is in an error state.
   *
   * Whether that surfaces as `aria-invalid` also depends on `touched` — see
   * `showError`.
   */
  readonly invalid = input(false, { transform: booleanAttribute });

  /**
   * The user has interacted with and left the control.
   *
   * Reactive Forms owns this in practice; it is an input so the primitive
   * stays usable without Angular forms at all.
   */
  readonly touched = input(false, { transform: booleanAttribute });

  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Whether a hint is present. Set by AalFieldHint when it registers. */
  readonly hasHint = signal(false);
  /** Whether an error message is present. Set by AalFieldError when it registers. */
  readonly hasError = signal(false);

  private readonly label = contentChild(AalFieldLabel);

  /**
   * Error state is REPORTED only once the user has been given a chance to
   * satisfy it. Announcing "invalid" on an untouched field turns a fresh form
   * into a wall of errors for a screen-reader user (AR-12).
   */
  readonly showError = computed(() => this.invalid() && this.touched());

  /** Label text, for prefixing announcements that will be heard out of context. */
  readonly labelText = computed(() => this.label()?.text() ?? '');

  /**
   * `aria-describedby` value: hint first, then error.
   *
   * Order matters. Screen readers read descriptions in the order referenced,
   * and hearing "Enter a date as DD/MM/YYYY" after "That date is not valid" is
   * the wrong way round — the instruction should arrive while it can still
   * help.
   */
  readonly describedBy = computed(() => {
    const ids = [this.hasHint() ? this.hintId : '', this.showError() ? this.errorId : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  /** Dev-mode check that this field actually got a label. */
  assertLabelled(): void {
    if (this.label()) return;
    this.assert.fail(
      'AR-11 / SC 3.3.2',
      'A field has no <label>. A screen-reader user reaching this control hears only its type — "edit text" — with no indication of what to enter. Unlabelled inputs are found on roughly half of all pages surveyed by WebAIM.',
      'Project an element carrying aalFieldLabel into the field. A placeholder is NOT a label: it disappears as soon as the user types.',
    );
  }
}

/**
 * The field's visible label.
 *
 * Rendered on a real `<label>` element so the native `for`/`id` association
 * does the work — clicking the label focuses the control, which
 * `aria-labelledby` alone would not provide.
 */
@Directive({
  selector: '[aalFieldLabel]',
  standalone: true,
  exportAs: 'aalFieldLabel',
  host: {
    '[attr.id]': 'field.labelId',
    '[attr.for]': 'field.controlId',
  },
})
export class AalFieldLabel {
  protected readonly field = inject(AalField);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The label's rendered text, used to prefix out-of-context announcements. */
  readonly text = signal('');

  constructor() {
    // Read once after projection. A MutationObserver would track later changes
    // but costs more than it is worth for a label, which rarely changes.
    queueMicrotask(() => this.text.set(this.host.nativeElement.textContent?.trim() ?? ''));
  }
}

/**
 * The control itself — `<input>`, `<textarea>` or `<select>`.
 *
 * Every ARIA relationship it needs is derived here from the parent field, so a
 * consuming component never writes `aria-describedby` or `aria-invalid` by
 * hand. That single origin is the property PRD §7.5 is claiming.
 */
@Directive({
  selector: '[aalFieldControl]',
  standalone: true,
  exportAs: 'aalFieldControl',
  host: {
    '[attr.id]': 'field.controlId',
    '[attr.aria-describedby]': 'field.describedBy()',
    '[attr.aria-invalid]': 'field.showError() ? "true" : null',
    '[attr.aria-required]': 'field.required() ? "true" : null',
    '[attr.disabled]': 'field.disabled() ? "" : null',
  },
})
export class AalFieldControl {
  protected readonly field = inject(AalField);
}

/**
 * Supplementary instructions — format requirements, constraints, examples.
 *
 * Referenced by `aria-describedby` BEFORE the error, so the user hears how to
 * satisfy the field before hearing that they have not.
 */
@Directive({
  selector: '[aalFieldHint]',
  standalone: true,
  host: { '[attr.id]': 'field.hintId' },
})
export class AalFieldHint {
  protected readonly field = inject(AalField);

  constructor() {
    this.field.hasHint.set(true);
  }
}

/**
 * The validation error message.
 *
 * Not `role="alert"`. Alert is assertive: it interrupts whatever the user is
 * currently reading, which is right for a session timeout and wrong for a
 * field-level validation message the user is about to reach anyway. The error
 * is associated through `aria-describedby`, so it is announced when focus
 * arrives — and the styled layer announces it politely on submit, where the
 * user is not already there.
 */
@Directive({
  selector: '[aalFieldError]',
  standalone: true,
  host: { '[attr.id]': 'field.errorId' },
})
export class AalFieldError {
  protected readonly field = inject(AalField);

  constructor() {
    this.field.hasError.set(true);
  }
}
