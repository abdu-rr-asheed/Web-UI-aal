import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { AriaIdService, TypeaheadService } from '@aal/a11y-core';

export interface AalListboxOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
  /** Optional group heading this option belongs to. */
  readonly group?: string;
}

/** What a keypress asked the listbox to do. */
export type ListboxIntent =
  | { kind: 'none' }
  | { kind: 'open' }
  | { kind: 'close'; commit: boolean; returnFocus: boolean }
  | { kind: 'move'; index: number }
  | { kind: 'select'; index: number }
  | { kind: 'toggle'; index: number }
  | { kind: 'selectRange'; from: number; to: number }
  | { kind: 'selectAll' };

/**
 * Listbox state machine (PRD §9.4, APG Listbox + Select-Only Combobox).
 *
 * A plain injectable rather than a directive: it holds no DOM and renders
 * nothing, so the styled layer can drive it from a component, an overlay, or a
 * test without a host element in between. That is the L3 contract taken
 * literally.
 *
 * ## Why `aria-activedescendant` rather than roving tabindex
 *
 * DOM focus stays on the TRIGGER while the highlighted option moves. Two
 * reasons, both about what the user actually experiences:
 *
 * 1. In a combobox the user may still be typing, and moving real focus into
 *    the popup would take the caret out of the input.
 * 2. Moving real focus into a popup makes browsers announce the option as a
 *    focus change AND as a selection change. Users hear it twice.
 *
 * The cost is that the active option must be scrolled into view manually —
 * the browser will not do it for an element that does not have focus — which
 * `AalActiveDescendant` handles.
 *
 * ## Keyboard model
 *
 * Every branch below is a row of the APG interaction table. The state machine
 * returns an INTENT rather than mutating directly, so the styled layer decides
 * how to realise it (close an overlay, restore focus, announce). That keeps
 * the ARIA logic in one testable place with no DOM dependency.
 */
@Injectable()
export class AalListboxState {
  private readonly ids = inject(AriaIdService);
  private readonly typeahead = inject(TypeaheadService);

  readonly listboxId = this.ids.next('aal-listbox');
  readonly triggerId = this.ids.next('aal-listbox-trigger');

  private readonly openState = signal(false);
  private readonly activeIndexState = signal(-1);
  private readonly selectedState = signal<readonly string[]>([]);
  private readonly optionsState = signal<readonly AalListboxOption[]>([]);
  private readonly multipleState = signal(false);

  readonly isOpen: Signal<boolean> = this.openState.asReadonly();
  readonly activeIndex: Signal<number> = this.activeIndexState.asReadonly();
  readonly selected: Signal<readonly string[]> = this.selectedState.asReadonly();
  readonly options: Signal<readonly AalListboxOption[]> = this.optionsState.asReadonly();
  readonly multiple: Signal<boolean> = this.multipleState.asReadonly();

  /** Indices the user can actually reach. Disabled options are skipped, per APG. */
  private readonly enabledIndices = computed(() =>
    this.optionsState()
      .map((o, i) => (o.disabled ? -1 : i))
      .filter((i) => i !== -1),
  );

  /** ID of the active option, for `aria-activedescendant`. */
  readonly activeDescendantId = computed(() => {
    const i = this.activeIndexState();
    return i >= 0 && i < this.optionsState().length ? this.optionId(i) : null;
  });

  /** Text shown on the trigger. */
  readonly displayValue = computed(() => {
    const selected = this.selectedState();
    if (selected.length === 0) return '';

    const labels = selected
      .map((v) => this.optionsState().find((o) => o.value === v)?.label)
      .filter((l): l is string => !!l);

    // Multi-select shows a count rather than a growing list, which would
    // otherwise make the trigger's accessible name change length on every
    // selection and become tedious to listen to.
    return labels.length === 1 ? labels[0] : `${labels.length} selected`;
  });

  optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  setOptions(options: readonly AalListboxOption[]): void {
    this.optionsState.set(options);
  }

  setMultiple(multiple: boolean): void {
    this.multipleState.set(multiple);
  }

  setSelected(values: readonly string[]): void {
    this.selectedState.set(values);
  }

  isSelected(value: string): boolean {
    return this.selectedState().includes(value);
  }

  open(): void {
    if (this.openState()) return;
    this.openState.set(true);

    // Opening lands on the current selection, not the top of the list — a user
    // reopening a select expects to find where they already are.
    const firstSelected = this.optionsState().findIndex((o) => this.isSelected(o.value));
    this.activeIndexState.set(firstSelected !== -1 ? firstSelected : (this.enabledIndices()[0] ?? -1));
  }

  close(): void {
    this.openState.set(false);
    this.typeahead.reset();
  }

  setActive(index: number): void {
    this.activeIndexState.set(index);
  }

  /** Commit the option at `index`. Toggles in multi-select, replaces otherwise. */
  select(index: number): void {
    const option = this.optionsState()[index];
    if (!option || option.disabled) return;

    if (!this.multipleState()) {
      this.selectedState.set([option.value]);
      return;
    }

    const current = this.selectedState();
    this.selectedState.set(
      current.includes(option.value)
        ? current.filter((v) => v !== option.value)
        : [...current, option.value],
    );
  }

  selectRange(from: number, to: number): void {
    if (!this.multipleState()) return;
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const values = this.optionsState()
      .slice(lo, hi + 1)
      .filter((o) => !o.disabled)
      .map((o) => o.value);
    this.selectedState.set([...new Set([...this.selectedState(), ...values])]);
  }

  selectAll(): void {
    if (!this.multipleState()) return;
    this.selectedState.set(this.optionsState().filter((o) => !o.disabled).map((o) => o.value));
  }

  /**
   * Interpret a keypress. Returns an intent for the styled layer to realise.
   *
   * Split into open/closed handlers because the same key means different
   * things in each state — `ArrowDown` opens a closed listbox and moves within
   * an open one.
   */
  handleKey(event: KeyboardEvent): ListboxIntent {
    return this.openState() ? this.keyWhenOpen(event) : this.keyWhenClosed(event);
  }

  /** APG: Select-Only Combobox, collapsed. */
  private keyWhenClosed(event: KeyboardEvent): ListboxIntent {
    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
      case 'ArrowUp':
        return { kind: 'open' };
      case 'Home':
        return { kind: 'select', index: this.enabledIndices()[0] ?? -1 };
      case 'End':
        return { kind: 'select', index: this.enabledIndices().at(-1) ?? -1 };
      default:
        // Typing while closed selects without opening — APG behaviour, and how
        // a keyboard user sets a familiar value without ever seeing the list.
        return this.typeaheadIntent(event, 'select');
    }
  }

  /**
   * APG: Listbox, expanded.
   *
   * Dispatches to one handler per group of interaction-table rows. The
   * original single switch reached a cyclomatic complexity of 29, which is not
   * a style complaint: a keyboard model nobody can read in one sitting is one
   * where a missing APG row goes unnoticed.
   */
  private keyWhenOpen(event: KeyboardEvent): ListboxIntent {
    const enabled = this.enabledIndices();
    const current = this.activeIndexState();

    /** Clamped step through the ENABLED options — disabled ones are skipped. */
    const step = (by: number): number => {
      const position = enabled.indexOf(current);
      return enabled[Math.min(Math.max(position + by, 0), enabled.length - 1)] ?? current;
    };

    return (
      this.rangeIntent(event, step, current) ??
      this.movementIntent(event, step, enabled, current) ??
      this.commitIntent(event, current) ??
      this.typeaheadIntent(event, 'move')
    );
  }

  /** Shift+Arrow and Ctrl/Cmd+A — multi-select only. */
  private rangeIntent(
    event: KeyboardEvent,
    step: (by: number) => number,
    current: number,
  ): ListboxIntent | null {
    if (!this.multipleState()) return null;

    if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      return { kind: 'selectRange', from: current, to: step(event.key === 'ArrowDown' ? 1 : -1) };
    }

    const selectAll = (event.key === 'a' || event.key === 'A') && (event.ctrlKey || event.metaKey);
    return selectAll ? { kind: 'selectAll' } : null;
  }

  /**
   * Arrows, Home, End, PageUp, PageDown.
   *
   * Page keys move by ten, per APG — a whole-viewport jump would lose the
   * user's place in a long list.
   */
  private movementIntent(
    event: KeyboardEvent,
    step: (by: number) => number,
    enabled: readonly number[],
    current: number,
  ): ListboxIntent | null {
    if (event.key === 'Home') return { kind: 'move', index: enabled[0] ?? current };
    if (event.key === 'End') return { kind: 'move', index: enabled.at(-1) ?? current };

    const by: Record<string, number | undefined> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 10,
      PageUp: -10,
    };

    const delta = by[event.key];
    return delta === undefined ? null : { kind: 'move', index: step(delta) };
  }

  /** Enter, Space, Escape, Tab — the keys that end the interaction. */
  private commitIntent(event: KeyboardEvent, current: number): ListboxIntent | null {
    if (event.key === 'Enter' || event.key === ' ') {
      return { kind: this.multipleState() ? 'toggle' : 'select', index: current };
    }

    // Escape means "undo this interaction" — a user who arrowed past an option
    // must not have it applied on the way out.
    if (event.key === 'Escape') return { kind: 'close', commit: false, returnFocus: true };

    // Tab commits and moves on. Focus is NOT returned: the user asked to leave,
    // and pulling focus back would trap them in the control they are escaping.
    if (event.key === 'Tab') return { kind: 'close', commit: true, returnFocus: false };

    return null;
  }

  private typeaheadIntent(event: KeyboardEvent, kind: 'move' | 'select'): ListboxIntent {
    if (event.ctrlKey || event.metaKey || event.altKey) return { kind: 'none' };

    const labels = this.optionsState().map((o) => (o.disabled ? ' ' : o.label));
    const match = this.typeahead.type(event.key, labels, this.activeIndexState());

    return match === null ? { kind: 'none' } : { kind, index: match };
  }
}
