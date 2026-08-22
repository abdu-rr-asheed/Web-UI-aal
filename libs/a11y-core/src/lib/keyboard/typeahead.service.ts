import { Injectable } from '@angular/core';

/**
 * APG printable-character typeahead (AR-03).
 *
 * Used by Listbox, Menu, Tabs and the grid: type "de" and land on "Denmark".
 * Shared rather than reimplemented per component so the reset window and
 * matching rules cannot drift — inconsistent typeahead between two widgets in
 * the same app is a usability defect a screen-reader user notices immediately.
 *
 * Behaviour follows the APG:
 *   - buffer resets after ~500ms of inactivity
 *   - matching is case-insensitive, from the start of the label
 *   - the SAME character repeated cycles through items starting with it, which
 *     is how a user reaches the third "Sales…" entry without typing it out
 *   - search wraps, starting after the currently-active item
 */
@Injectable({ providedIn: 'root' })
export class TypeaheadService {
  /** APG-conventional reset window. */
  static readonly RESET_MS = 500;

  private buffer = '';
  private lastKeyAt = 0;

  /**
   * Feed a keystroke and get the index to move to, or null for no match.
   *
   * @param char       the printable character typed
   * @param labels     item labels, in DOM order
   * @param activeIndex currently active index, or -1
   * @param now        injectable clock, for deterministic tests
   */
  type(char: string, labels: readonly string[], activeIndex: number, now = Date.now()): number | null {
    if (!this.isPrintable(char)) return null;

    if (now - this.lastKeyAt > TypeaheadService.RESET_MS) this.buffer = '';
    this.lastKeyAt = now;
    this.buffer += char.toLowerCase();

    const { needle, start } = this.searchFrom(activeIndex);

    for (let i = 0; i < labels.length; i++) {
      const index = (start + i + labels.length) % labels.length;
      if (labels[index]?.trim().toLowerCase().startsWith(needle)) return index;
    }

    return null;
  }

  /**
   * What to search for, and where to start searching from.
   *
   * Repeating a single character cycles through items beginning with it rather
   * than searching for "aaa" — APG behaviour, and how a user reaches the third
   * "Sales…" entry without typing the whole label. A cycling search, or the
   * first keystroke of a new one, starts AFTER the active item so that
   * repeated presses advance instead of re-matching the current item.
   */
  private searchFrom(activeIndex: number): { needle: string; start: number } {
    const isRepeat = this.buffer.length > 1 && new Set(this.buffer).size === 1;
    return {
      needle: isRepeat ? this.buffer[0] : this.buffer,
      start: isRepeat || this.buffer.length === 1 ? activeIndex + 1 : activeIndex,
    };
  }

  /** Clear the buffer — call when the widget closes or loses focus. */
  reset(): void {
    this.buffer = '';
    this.lastKeyAt = 0;
  }

  /** Current buffer, for tests and debugging. */
  get current(): string {
    return this.buffer;
  }

  /**
   * A single printable character. Excludes named keys ("Enter", "ArrowDown")
   * and, deliberately, the space character: Space activates the focused item in
   * most APG patterns, so consuming it for typeahead would break activation.
   */
  private isPrintable(char: string): boolean {
    return char.length === 1 && char !== ' ' && !/^\s$/.test(char);
  }
}
