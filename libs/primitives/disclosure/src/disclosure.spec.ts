import { TestBed } from '@angular/core/testing';
import { provideAal } from '@aal/a11y-core';
import { AalDisclosureSet, AalDisclosureState } from './disclosure';

const single = () => {
  TestBed.configureTestingModule({ providers: [provideAal({ assertions: 'off' }), AalDisclosureState] });
  return TestBed.inject(AalDisclosureState);
};

const set = () => {
  TestBed.configureTestingModule({ providers: [provideAal({ assertions: 'off' }), AalDisclosureSet] });
  return TestBed.inject(AalDisclosureSet);
};

describe('AalDisclosureState', () => {
  it('starts collapsed', () => {
    expect(single().expanded()).toBe(false);
  });

  it('generates distinct trigger and panel ids', () => {
    const state = single();
    expect(state.triggerId).not.toBe(state.panelId);
    expect(state.triggerId).toBeTruthy();
  });

  it('toggles, and reports the resulting state', () => {
    const state = single();
    expect(state.toggle()).toBe(true);
    expect(state.expanded()).toBe(true);
    expect(state.toggle()).toBe(false);
  });

  describe('disabled', () => {
    it('refuses to toggle', () => {
      const state = single();
      state.setDisabled(true);
      expect(state.toggle()).toBe(false);
      expect(state.expanded()).toBe(false);
    });

    it('refuses a programmatic expand too', () => {
      // Otherwise a consumer binding could open a disclosure whose trigger
      // reports itself unavailable — the button says one thing and the
      // rendered panel says another.
      const state = single();
      state.setDisabled(true);
      state.setExpanded(true);
      expect(state.expanded()).toBe(false);
    });
  });
});

describe('AalDisclosureSet', () => {
  it('starts with nothing open', () => {
    const s = set();
    expect(s.anyOpen()).toBe(false);
    expect(s.isOpen(0)).toBe(false);
  });

  it('generates a distinct trigger and panel id per index', () => {
    const s = set();
    expect(s.triggerId(0)).not.toBe(s.triggerId(1));
    expect(s.triggerId(0)).not.toBe(s.panelId(0));
  });

  describe('single-open policy (the default)', () => {
    it('closes the previous disclosure when another opens', () => {
      const s = set();
      s.open(0);
      s.open(1);
      expect(s.isOpen(0)).toBe(false);
      expect(s.isOpen(1)).toBe(true);
    });

    it('collapses an existing multi-open state when the policy is applied', () => {
      // Switching the policy at runtime must not leave the set in a state the
      // policy forbids — two open submenus would push the rest of the
      // navigation off-screen at a narrow viewport.
      const s = set();
      s.setMultiple(true);
      s.open(0);
      s.open(1);

      s.setMultiple(false);

      expect([...s.openIndices()]).toHaveLength(1);
    });
  });

  describe('multiple', () => {
    it('keeps both open', () => {
      const s = set();
      s.setMultiple(true);
      s.open(0);
      s.open(1);
      expect(s.isOpen(0)).toBe(true);
      expect(s.isOpen(1)).toBe(true);
    });
  });

  it('toggles, and reports the resulting state', () => {
    const s = set();
    expect(s.toggle(2)).toBe(true);
    expect(s.toggle(2)).toBe(false);
  });

  it('closeAll clears everything', () => {
    const s = set();
    s.setMultiple(true);
    s.open(0);
    s.open(3);

    s.closeAll();

    expect(s.anyOpen()).toBe(false);
  });
});
