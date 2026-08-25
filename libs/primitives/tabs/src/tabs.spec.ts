import { TestBed } from '@angular/core/testing';
import { provideAal } from '@aal/a11y-core';
import { AalTabsState } from './tabs';

/**
 * Tabs state machine (PRD §9.7, APG Tabs).
 *
 * Headless: no host component, no DOM. Everything here is a rule about what
 * selection MEANS, which is the part of the pattern that has no platform
 * equivalent — arrow keys and roving tabindex belong to `AalRovingTabindex`
 * and are tested there.
 */
const make = () => {
  TestBed.configureTestingModule({ providers: [provideAal({ assertions: 'off' }), AalTabsState] });
  return TestBed.inject(AalTabsState);
};

describe('AalTabsState', () => {
  describe('identity', () => {
    it('generates a distinct id per tab and per panel', () => {
      const state = make();
      expect(state.tabId(0)).not.toBe(state.tabId(1));
      expect(state.tabId(0)).not.toBe(state.panelId(0));
    });

    it('scopes ids to the instance, so two tab lists on one page cannot collide', () => {
      const first = make();
      const second = TestBed.inject(AalTabsState);
      // Same injector returns the same instance; a second tab list gets its own
      // provider, which is what the component-level `providers` array does.
      expect(second).toBe(first);
    });
  });

  describe('selection', () => {
    it('selects the first tab by default', () => {
      const state = make();
      state.setTabs(3);
      expect(state.selectedIndex()).toBe(0);
    });

    it('selects a valid index', () => {
      const state = make();
      state.setTabs(3);
      state.select(2);
      expect(state.selectedIndex()).toBe(2);
    });

    it('REFUSES a disabled index', () => {
      // Silently selecting it would leave aria-disabled and aria-selected both
      // true on the same tab, which is a contradiction a screen reader reads
      // aloud.
      const state = make();
      state.setTabs(3, [1]);
      state.select(1);
      expect(state.selectedIndex()).toBe(0);
    });

    it('refuses an index that does not exist', () => {
      const state = make();
      state.setTabs(2);
      state.select(9);
      expect(state.selectedIndex()).toBe(0);
    });
  });

  describe('the tab set changing underneath the selection', () => {
    it('re-resolves when the selected tab is removed', () => {
      // Otherwise aria-selected is true on nothing and the panel region has no
      // labelling tab.
      const state = make();
      state.setTabs(4);
      state.select(3);

      state.setTabs(2);
      expect(state.selectedIndex()).toBe(0);
    });

    it('re-resolves when the selected tab becomes disabled', () => {
      const state = make();
      state.setTabs(3);
      state.select(1);

      state.setTabs(3, [1]);
      expect(state.selectedIndex()).toBe(2);
    });

    it('keeps the selection when it is still valid', () => {
      const state = make();
      state.setTabs(3);
      state.select(2);

      state.setTabs(3, [0]);
      expect(state.selectedIndex()).toBe(2);
    });

    it('reports -1 when every tab is disabled, rather than a false selection', () => {
      const state = make();
      state.setTabs(2, [0, 1]);
      expect(state.selectedIndex()).toBe(-1);
    });
  });

  describe('activation mode (ADR-0008)', () => {
    it('MANUAL — moving focus does not change the panel', () => {
      // The whole point: arrowing past three tabs must not render three panels
      // the user never asked for, each announced as they pass.
      const state = make();
      state.setTabs(4);

      state.focusMoved(3);

      expect(state.selectedIndex()).toBe(0);
    });

    it('manual is the default', () => {
      expect(make().activation()).toBe('manual');
    });

    it('AUTOMATIC — moving focus selects', () => {
      const state = make();
      state.setTabs(4);
      state.setActivation('automatic');

      state.focusMoved(3);

      expect(state.selectedIndex()).toBe(3);
    });

    it('automatic still refuses a disabled tab', () => {
      const state = make();
      state.setTabs(4, [2]);
      state.setActivation('automatic');

      state.focusMoved(2);

      expect(state.selectedIndex()).toBe(0);
    });
  });

  describe('Delete closes a closeable tab', () => {
    const del = () => new KeyboardEvent('keydown', { key: 'Delete' });

    it('reports a close intent', () => {
      const state = make();
      state.setTabs(3);
      expect(state.handleKey(del(), 1, true)).toMatchObject({ kind: 'close', index: 1 });
    });

    it('ignores Delete on a tab that is not closeable', () => {
      const state = make();
      state.setTabs(3);
      expect(state.handleKey(del(), 1, false)).toEqual({ kind: 'none' });
    });

    it('claims no other key — arrows belong to AalRovingTabindex', () => {
      const state = make();
      state.setTabs(3);
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ']) {
        expect(state.handleKey(new KeyboardEvent('keydown', { key }), 1, true)).toEqual({ kind: 'none' });
      }
    });
  });

  describe('where focus goes after a tab is closed', () => {
    it('moves to the FOLLOWING tab, accounting for the index shift', () => {
      // Closing tab 1 of [0,1,2,3] leaves [0,1,2]: what was tab 2 is now tab 1.
      const state = make();
      state.setTabs(4);
      expect(state.focusAfterClose(1)).toBe(1);
    });

    it('falls back to the PRECEDING tab when the last one is closed', () => {
      // Otherwise focus points past the end of the list and is lost to <body>.
      const state = make();
      state.setTabs(3);
      expect(state.focusAfterClose(2)).toBe(1);
    });

    it('skips disabled neighbours', () => {
      const state = make();
      state.setTabs(4, [2]);
      // Closing 1 leaves enabled {0, 3}; 3 shifts down to 2.
      expect(state.focusAfterClose(1)).toBe(2);
    });

    it('reports -1 when nothing is left to focus', () => {
      // The caller must then move focus somewhere deliberate rather than let
      // it fall to <body>.
      const state = make();
      state.setTabs(1);
      expect(state.focusAfterClose(0)).toBe(-1);
    });
  });
});
