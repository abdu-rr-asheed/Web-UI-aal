import { TestBed } from '@angular/core/testing';
import { provideAal } from '@aal/a11y-core';
import { AalListboxState, type AalListboxOption } from './listbox';

/**
 * Listbox state machine (PRD §9.4, §7.5).
 *
 * Every describe below is a row of the APG interaction table (PRD §11.4), so
 * the report reads as a conformance document.
 *
 * The state machine is deliberately DOM-free, which is what makes the keyboard
 * model testable in isolation. jsdom cannot tell us whether focus moved
 * correctly (D-006 territory) but it can tell us exactly what the widget
 * decided to do, which is where the ARIA logic actually lives.
 */

const OPTIONS: AalListboxOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
  { value: 'blackcurrant', label: 'Blackcurrant', disabled: true },
  { value: 'cherry', label: 'Cherry' },
];

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  new KeyboardEvent('keydown', { key: k, ...mods });

describe('AalListboxState', () => {
  let state: AalListboxState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAal({ assertions: 'off' }), AalListboxState],
    });
    state = TestBed.inject(AalListboxState);
    state.setOptions(OPTIONS);
  });

  describe('collapsed — Enter, Space, Down Arrow, Up Arrow open the listbox', () => {
    it.each(['Enter', ' ', 'ArrowDown', 'ArrowUp'])('%s opens', (k) => {
      expect(state.handleKey(key(k))).toEqual({ kind: 'open' });
    });

    it('opening lands on the current selection, not the top of the list', async () => {
      // A user reopening a select expects to find where they already are.
      state.setSelected(['banana']);
      state.open();
      expect(state.activeIndex()).toBe(2);
    });

    it('opening with nothing selected lands on the first ENABLED option', () => {
      state.open();
      expect(state.activeIndex()).toBe(0);
    });
  });

  describe('collapsed — printable characters select without opening', () => {
    it('selects a match directly', () => {
      // APG behaviour, and how a keyboard user sets a familiar value without
      // ever seeing the list.
      expect(state.handleKey(key('c'))).toEqual({ kind: 'select', index: 4 });
    });

    it('ignores modified keypresses, which belong to the browser', () => {
      expect(state.handleKey(key('c', { ctrlKey: true }))).toEqual({ kind: 'none' });
    });
  });

  describe('expanded — Down Arrow moves the active option', () => {
    beforeEach(() => state.open());

    it('advances', () => {
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'move', index: 1 });
    });

    it('SKIPS disabled options', () => {
      state.setActive(2); // Banana; Blackcurrant (3) is disabled
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'move', index: 4 });
    });

    it('stops at the last option rather than wrapping', () => {
      // APG does not wrap a listbox, unlike a radio group. Wrapping here would
      // silently take the user back to the top when they expected the end.
      state.setActive(4);
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'move', index: 4 });
    });
  });

  describe('expanded — Up Arrow moves the active option backwards', () => {
    beforeEach(() => state.open());

    it('retreats', () => {
      state.setActive(2);
      expect(state.handleKey(key('ArrowUp'))).toEqual({ kind: 'move', index: 1 });
    });

    it('stops at the first option', () => {
      state.setActive(0);
      expect(state.handleKey(key('ArrowUp'))).toEqual({ kind: 'move', index: 0 });
    });
  });

  describe('expanded — Home and End jump to the first and last option', () => {
    beforeEach(() => state.open());

    it('Home goes to the first', () => {
      state.setActive(4);
      expect(state.handleKey(key('Home'))).toEqual({ kind: 'move', index: 0 });
    });

    it('End goes to the last ENABLED option', () => {
      expect(state.handleKey(key('End'))).toEqual({ kind: 'move', index: 4 });
    });
  });

  describe('expanded — Page Up and Page Down move by ten', () => {
    beforeEach(() => state.open());

    it('PageDown moves ten, clamped to the end', () => {
      // APG specifies ten. A whole-viewport jump would lose the user's place.
      expect(state.handleKey(key('PageDown'))).toEqual({ kind: 'move', index: 4 });
    });

    it('PageUp moves ten back, clamped to the start', () => {
      state.setActive(4);
      expect(state.handleKey(key('PageUp'))).toEqual({ kind: 'move', index: 0 });
    });
  });

  describe('expanded — Enter and Space select the active option', () => {
    beforeEach(() => state.open());

    it('Enter selects in single-select', () => {
      state.setActive(2);
      expect(state.handleKey(key('Enter'))).toEqual({ kind: 'select', index: 2 });
    });

    it('Space TOGGLES in multi-select', () => {
      state.setMultiple(true);
      state.setActive(2);
      expect(state.handleKey(key(' '))).toEqual({ kind: 'toggle', index: 2 });
    });
  });

  describe('expanded — Escape closes WITHOUT committing', () => {
    it('discards the interaction and returns focus', () => {
      // Escape means "undo this". A user who arrowed past an option must not
      // have it applied on the way out.
      state.open();
      expect(state.handleKey(key('Escape'))).toEqual({
        kind: 'close',
        commit: false,
        returnFocus: true,
      });
    });
  });

  describe('expanded — Tab commits and moves on', () => {
    it('commits but does NOT return focus', () => {
      // The user asked to leave. Yanking focus back to the trigger would trap
      // them in the control they were trying to escape.
      state.open();
      expect(state.handleKey(key('Tab'))).toEqual({
        kind: 'close',
        commit: true,
        returnFocus: false,
      });
    });
  });

  describe('expanded — typeahead moves the active option', () => {
    beforeEach(() => state.open());

    it('matches on a single character', () => {
      expect(state.handleKey(key('b'))).toEqual({ kind: 'move', index: 2 });
    });

    it('never lands on a disabled option', () => {
      // Blackcurrant is disabled, so "bl" must not match it.
      state.handleKey(key('b'));
      const intent = state.handleKey(key('l'));
      expect(intent).toEqual({ kind: 'none' });
    });
  });

  describe('multi-select', () => {
    beforeEach(() => {
      state.setMultiple(true);
      state.open();
    });

    it('Ctrl+A selects all ENABLED options', () => {
      expect(state.handleKey(key('a', { ctrlKey: true }))).toEqual({ kind: 'selectAll' });
      state.selectAll();
      expect(state.selected()).toEqual(['apple', 'apricot', 'banana', 'cherry']);
      expect(state.selected()).not.toContain('blackcurrant');
    });

    it('Shift+Down extends the selection', () => {
      state.setActive(1);
      expect(state.handleKey(key('ArrowDown', { shiftKey: true }))).toEqual({
        kind: 'selectRange',
        from: 1,
        to: 2,
      });
    });

    it('selecting an already-selected option deselects it', () => {
      state.select(0);
      expect(state.selected()).toEqual(['apple']);
      state.select(0);
      expect(state.selected()).toEqual([]);
    });

    it('Ctrl+A does nothing in single-select', () => {
      state.setMultiple(false);
      expect(state.handleKey(key('a', { ctrlKey: true }))).toEqual({ kind: 'none' });
    });
  });

  describe('aria-activedescendant', () => {
    it('is null while closed', () => {
      expect(state.activeIndex()).toBe(-1);
      expect(state.activeDescendantId()).toBeNull();
    });

    it('points at the active option once open', () => {
      state.open();
      expect(state.activeDescendantId()).toBe(state.optionId(0));
    });

    it('follows the active option', () => {
      state.open();
      state.setActive(2);
      expect(state.activeDescendantId()).toBe(state.optionId(2));
    });
  });

  describe('trigger display value', () => {
    it('is empty with no selection, so the placeholder shows', () => {
      expect(state.displayValue()).toBe('');
    });

    it('shows the label for a single selection', () => {
      state.setSelected(['banana']);
      expect(state.displayValue()).toBe('Banana');
    });

    it('shows a COUNT for multiple selections, not a growing list', () => {
      // A list would make the trigger's accessible name lengthen with every
      // selection, which becomes tedious to listen to.
      state.setMultiple(true);
      state.setSelected(['apple', 'banana', 'cherry']);
      expect(state.displayValue()).toBe('3 selected');
    });
  });

  describe('disabled options', () => {
    it('cannot be selected even directly', () => {
      state.select(3);
      expect(state.selected()).toEqual([]);
    });
  });
});
