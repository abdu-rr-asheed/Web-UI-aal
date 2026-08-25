import { TestBed } from '@angular/core/testing';
import { provideAal } from '@aal/a11y-core';
import { AalMenuState } from './menu';
import type { AalMenuItem } from './menu';

/**
 * Menu Button state machine (PRD §9.9, APG Menu Button).
 *
 * One describe block per row of the APG interaction table, so the report reads
 * as a conformance document (PRD §11.4).
 */
const ITEMS: AalMenuItem[] = [
  { value: 'rename', label: 'Rename' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'archive', label: 'Archive', disabled: true },
  { value: 'delete', label: 'Delete', separatorBefore: true },
];

const make = (items: AalMenuItem[] = ITEMS) => {
  TestBed.configureTestingModule({ providers: [provideAal({ assertions: 'off' }), AalMenuState] });
  const state = TestBed.inject(AalMenuState);
  state.setItems(items);
  return state;
};

const key = (k: string, init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: k, ...init });

describe('AalMenuState', () => {
  describe('trigger — Enter, Space or Down Arrow opens and focuses the first item', () => {
    it.each(['Enter', ' ', 'ArrowDown'])('%s opens on the first item', (k) => {
      const state = make();
      expect(state.handleKey(key(k))).toEqual({ kind: 'open', index: 0 });
    });
  });

  describe('trigger — Up Arrow opens and focuses the last item', () => {
    it('opens on the last item', () => {
      // Not decoration: "Delete" is conventionally last, and this is how a
      // keyboard user reaches it in one keystroke instead of arrowing past
      // everything above it.
      const state = make();
      expect(state.handleKey(key('ArrowUp'))).toEqual({ kind: 'open', index: 3 });
    });
  });

  describe('trigger — other keys do nothing', () => {
    it.each(['Escape', 'Tab', 'a', 'Home'])('%s is not claimed while closed', (k) => {
      const state = make();
      expect(state.handleKey(key(k))).toEqual({ kind: 'none' });
    });
  });

  describe('menu — Down Arrow moves to the next item and wraps', () => {
    it('moves to the next enabled item', () => {
      const state = make();
      state.open(0);
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'focus', index: 1 });
    });

    it('SKIPS a disabled item', () => {
      const state = make();
      state.open(1);
      // index 2 is disabled, so Down goes to 3.
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'focus', index: 3 });
    });

    it('wraps from the last item to the first', () => {
      const state = make();
      state.open(3);
      expect(state.handleKey(key('ArrowDown'))).toEqual({ kind: 'focus', index: 0 });
    });
  });

  describe('menu — Up Arrow moves to the previous item and wraps', () => {
    it('moves back', () => {
      const state = make();
      state.open(1);
      expect(state.handleKey(key('ArrowUp'))).toEqual({ kind: 'focus', index: 0 });
    });

    it('wraps from the first item to the last', () => {
      const state = make();
      state.open(0);
      expect(state.handleKey(key('ArrowUp'))).toEqual({ kind: 'focus', index: 3 });
    });
  });

  describe('menu — Home and End', () => {
    it('Home moves to the first enabled item', () => {
      const state = make();
      state.open(3);
      expect(state.handleKey(key('Home'))).toEqual({ kind: 'focus', index: 0 });
    });

    it('End moves to the last enabled item', () => {
      const state = make();
      state.open(0);
      expect(state.handleKey(key('End'))).toEqual({ kind: 'focus', index: 3 });
    });

    it('End never lands on a disabled item', () => {
      const state = make([
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta', disabled: true },
      ]);
      state.open(0);
      expect(state.handleKey(key('End'))).toEqual({ kind: 'focus', index: 0 });
    });
  });

  describe('menu — Enter or Space activates the focused item', () => {
    it.each(['Enter', ' '])('%s activates', (k) => {
      const state = make();
      state.open(1);
      expect(state.handleKey(key(k))).toEqual({ kind: 'activate', index: 1 });
    });

    it('activates nothing when no item is focused', () => {
      const state = make();
      state.open(-1);
      expect(state.handleKey(key('Enter'))).toEqual({ kind: 'none' });
    });
  });

  describe('menu — Escape closes and returns focus to the trigger', () => {
    it('asks for focus to be returned', () => {
      const state = make();
      state.open(2);
      expect(state.handleKey(key('Escape'))).toEqual({ kind: 'close', returnFocus: true });
    });
  });

  describe('menu — Tab closes and moves on', () => {
    it('does NOT return focus', () => {
      // The user asked to leave. Pulling focus back to the trigger would trap
      // them in the control they are escaping.
      const state = make();
      state.open(0);
      expect(state.handleKey(key('Tab'))).toEqual({ kind: 'close', returnFocus: false });
    });
  });

  describe('menu — typeahead moves to a matching item (AR-03)', () => {
    it('matches on the first character', () => {
      const state = make();
      state.open(0);
      expect(state.handleKey(key('d'))).toEqual({ kind: 'focus', index: 1 });
    });

    it('never matches a disabled item', () => {
      // "a" would otherwise land on the disabled "Archive".
      const state = make();
      state.open(0);
      expect(state.handleKey(key('a'))).toEqual({ kind: 'none' });
    });

    it('ignores keys held with a modifier, which are shortcuts, not typing', () => {
      const state = make();
      state.open(0);
      expect(state.handleKey(key('d', { ctrlKey: true }))).toEqual({ kind: 'none' });
    });
  });

  describe('open and close bookkeeping', () => {
    it('reports closed initially, with no active item', () => {
      const state = make();
      expect(state.isOpen()).toBe(false);
      expect(state.activeIndex()).toBe(-1);
    });

    it('clears the active item on close, so reopening does not resume mid-list', () => {
      const state = make();
      state.open(2);
      state.close();
      expect(state.isOpen()).toBe(false);
      expect(state.activeIndex()).toBe(-1);
    });

    it('reports -1 for first and last when every item is disabled', () => {
      const state = make([{ value: 'a', label: 'Alpha', disabled: true }]);
      expect(state.firstIndex()).toBe(-1);
      expect(state.lastIndex()).toBe(-1);
    });
  });
});
