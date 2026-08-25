import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AalLiveAnnouncer, AriaIdService, DismissService, injectAalConfig } from '@aal/a11y-core';
import { AalListboxState, type AalListboxOption, type ListboxIntent } from '@aal/primitives/listbox';

export type { AalListboxOption as AalSelectOption };

/**
 * Select — a listbox popup with a combobox trigger (PRD §9.4).
 *
 * ## Read this before using it
 *
 * **A native `<select>` is usually the better choice.** It gets the mobile
 * picker, the platform's own keyboard model, and screen-reader behaviour that
 * has been tuned for decades — none of which a custom widget fully reproduces.
 * `<aal-native-select>` is shipped alongside this for that reason and is the
 * documented default.
 *
 * This component exists for what native cannot do: multi-select that is
 * actually usable, option grouping with rich content, and consistent styling
 * across platforms. If none of those apply, use the native one.
 *
 * ## Design
 *
 * DOM focus never leaves the trigger. The highlighted option is tracked with
 * `aria-activedescendant`, so a screen reader announces the option as a
 * selection change rather than as a focus change — moving real focus into the
 * popup makes browsers announce it twice.
 *
 * The overlay is positioned so it can never cover its own trigger, which is
 * SC 2.4.11 Focus Not Obscured: focus stays on the trigger while the list is
 * open, so a popup that overlapped it would hide the focused element.
 */
@Component({
  selector: 'aal-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './select.css',
  providers: [
    AalListboxState,
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AalSelect), multi: true },
  ],
  template: `
    <div class="aal-select" [class.aal-select--invalid]="showError()">
      <!--
        A <span>, not a <label>. The trigger is a <button>, and the for attribute cannot
        point at a button — so a <label> here would label nothing and clicking
        it would do nothing. The trigger's aria-labelledby references this
        element instead, which is the combobox-button pattern.
      -->
      <span class="aal-select__label" [class.aal-visually-hidden]="hideLabel()" [attr.id]="labelId">
        {{ label() }}
        @if (required()) {
          <span class="aal-visually-hidden">(required)</span>
        }
      </span>

      @if (hint()) {
        <p class="aal-select__hint" [attr.id]="hintId">{{ hint() }}</p>
      }

      <button
        #trigger
        type="button"
        class="aal-select__trigger"
        role="combobox"
        [attr.id]="state.triggerId"
        [attr.aria-controls]="state.listboxId"
        [attr.aria-expanded]="state.isOpen()"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-labelledby]="labelId + ' ' + state.triggerId"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-activedescendant]="state.isOpen() ? state.activeDescendantId() : null"
        [attr.aria-required]="required() ? 'true' : null"
        [attr.aria-invalid]="showError() ? 'true' : null"
        [disabled]="disabled()"
        (click)="toggle()"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
      >
        <span class="aal-select__value">{{ state.displayValue() || placeholder() }}</span>
        <span class="aal-select__arrow" aria-hidden="true">▾</span>
      </button>

      @if (state.isOpen()) {
        <!--
          Rendered inline rather than in a CDK overlay: an overlay portal moves
          the list out of the trigger's DOM subtree, which breaks the implicit
          relationship browsers use to keep aria-activedescendant working
          reliably, and it makes SC 2.4.11 harder to guarantee. Inline
          positioning below the trigger cannot cover it.
        -->
        <ul
          #listbox
          class="aal-select__listbox"
          role="listbox"
          [attr.id]="state.listboxId"
          [attr.aria-labelledby]="labelId"
          [attr.aria-multiselectable]="multiple() ? 'true' : null"
        >
          @for (option of options(); track option.value; let i = $index) {
            <!--
              Options are intentionally NOT focusable and carry no key handlers.
              Keyboard interaction lives on the trigger and the active option is
              tracked with aria-activedescendant (see the class docs). Making
              each option focusable would break that pattern outright.
              e2e/keyboard/select.spec.ts verifies the real keyboard model.
            -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              class="aal-select__option"
              role="option"
              [attr.id]="state.optionId(i)"
              [attr.aria-selected]="state.isSelected(option.value)"
              [attr.aria-disabled]="option.disabled ? 'true' : null"
              [class.aal-select__option--active]="state.activeIndex() === i"
              [class.aal-select__option--selected]="state.isSelected(option.value)"
              (click)="chooseByPointer(i)"
            >
              <!-- Decorative: aria-selected already carries the state. -->
              <span class="aal-select__check" aria-hidden="true">
                {{ state.isSelected(option.value) ? '✓' : '' }}
              </span>
              {{ option.label }}
            </li>
          }
        </ul>
      }

      @if (showError()) {
        <p class="aal-select__error" [attr.id]="errorId">
          <span aria-hidden="true">⚠</span>
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class AalSelect implements ControlValueAccessor {
  protected readonly state = inject(AalListboxState);
  private readonly ids = inject(AriaIdService);
  private readonly announcer = inject(AalLiveAnnouncer);
  private readonly dismiss = inject(DismissService);
  private readonly config = injectAalConfig();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly triggerEl = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  readonly labelId = this.ids.next('aal-select-label');
  readonly hintId = this.ids.next('aal-select-hint');
  readonly errorId = this.ids.next('aal-select-error');

  readonly label = input.required<string>();
  readonly options = input.required<readonly AalListboxOption[]>();

  readonly placeholder = input('Select an option');
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly hideLabel = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly multiple = input(false, { transform: booleanAttribute });

  readonly value = model<string | readonly string[]>('');
  readonly disabled = model(false);
  readonly touched = signal(false);

  protected readonly showError = computed(() => !!this.error() && this.touched());

  protected readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : '', this.showError() ? this.errorId : ''].filter(Boolean);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  private dismissRef: { dismiss(): void } | null = null;
  private onChange: (v: string | readonly string[]) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  constructor() {
    // An effect, not queueMicrotask: Reactive Forms calls writeValue during
    // initialisation, BEFORE a microtask would run. With the option list still
    // empty at that point the value-to-label lookup found nothing and the
    // trigger rendered "0 selected" for a perfectly valid value.
    effect(() => {
      this.state.setOptions(this.options());
      this.state.setMultiple(this.multiple());
      this.state.setSelected(this.toArray(this.value()));
    });
  }

  // --- ControlValueAccessor (FR-05) -----------------------------------------

  writeValue(v: string | readonly string[] | null): void {
    this.value.set(v ?? '');
    this.state.setSelected(this.toArray(v ?? ''));
  }
  registerOnChange(fn: (v: string | readonly string[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Interaction ----------------------------------------------------------

  protected toggle(): void {
    if (this.state.isOpen()) {
      this.closeList(false);
    } else {
      this.openList();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    this.state.setOptions(this.options());
    const intent = this.state.handleKey(event);
    if (intent.kind === 'none') return;

    // Only swallow keys we are actually handling — consuming Tab or an
    // unmatched character would break normal navigation and typing.
    if (intent.kind !== 'close' || event.key !== 'Tab') event.preventDefault();

    this.realise(intent);
  }

  /** Turn a state-machine intent into DOM and announcements. */
  private realise(intent: ListboxIntent): void {
    switch (intent.kind) {
      case 'open':
        this.openList();
        break;

      case 'close':
        this.closeList(intent.commit, intent.returnFocus);
        break;

      case 'move':
        this.state.setActive(intent.index);
        this.scrollActiveIntoView();
        break;

      case 'select':
        this.state.setActive(intent.index);
        this.commit(intent.index);
        if (!this.multiple()) this.closeList(true);
        break;

      case 'toggle':
        this.commit(intent.index);
        break;

      case 'selectRange':
        this.state.setActive(intent.to);
        this.state.selectRange(intent.from, intent.to);
        this.emit();
        this.announceCount();
        break;

      case 'selectAll':
        this.state.selectAll();
        this.emit();
        this.announceCount();
        break;
    }
  }

  protected chooseByPointer(index: number): void {
    this.state.setActive(index);
    this.commit(index);
    // commit:false — the selection is already made. Passing true would make
    // closeList commit the ACTIVE index a second time, which before this fix
    // was still option 0 from opening, silently overwriting the user's click.
    if (!this.multiple()) this.closeList(false);
  }

  private commit(index: number): void {
    const option = this.options()[index];
    if (!option || option.disabled) return;

    const wasSelected = this.state.isSelected(option.value);
    this.state.select(index);
    this.emit();

    if (this.multiple()) {
      // Announce what changed AND the running total: a count alone does not
      // say which option moved, and a name alone does not say where you are.
      this.announcer.polite(
        `${wasSelected ? this.config.strings.deselected(option.label) : this.config.strings.selected(option.label)}. ` +
          this.config.strings.selectionCount(this.state.selected().length, this.options().length),
      );
    } else {
      this.announcer.polite(this.config.strings.selected(option.label));
    }
  }

  private announceCount(): void {
    this.announcer.polite(
      this.config.strings.selectionCount(this.state.selected().length, this.options().length),
    );
  }

  private emit(): void {
    const selected = this.state.selected();
    const next = this.multiple() ? selected : (selected[0] ?? '');
    this.value.set(next);
    this.onChange(next);
  }

  private openList(): void {
    this.state.setOptions(this.options());
    this.state.setMultiple(this.multiple());
    this.state.open();

    // Escape and outside-pointer dismissal go through the shared layer stack,
    // so a select inside a dialog closes only the select on the first Escape
    // (AR-15).
    this.dismissRef = this.dismiss.register(this.host.nativeElement, {
      onDismiss: () => {
        this.state.close();
        this.triggerEl()?.nativeElement.focus();
      },
    });

    queueMicrotask(() => this.scrollActiveIntoView());
  }

  private closeList(commit: boolean, returnFocus = true): void {
    if (commit && !this.multiple() && this.state.activeIndex() >= 0) {
      this.commit(this.state.activeIndex());
    }
    this.dismissRef?.dismiss();
    this.dismissRef = null;
    this.state.close();
    if (returnFocus) this.triggerEl()?.nativeElement.focus();
  }

  protected onBlur(): void {
    this.touched.set(true);
    this.onTouchedFn();
  }

  /**
   * The active option has no DOM focus, so the browser will not scroll it into
   * view — a sighted keyboard user would otherwise arrow into content they
   * cannot see.
   */
  private scrollActiveIntoView(): void {
    const id = this.state.activeDescendantId();
    if (!id) return;
    this.host.nativeElement.ownerDocument
      ?.getElementById(id)
      ?.scrollIntoView?.({ block: 'nearest' });
  }

  private toArray(v: string | readonly string[]): readonly string[] {
    if (Array.isArray(v)) return v;
    return v ? [v as string] : [];
  }
}
