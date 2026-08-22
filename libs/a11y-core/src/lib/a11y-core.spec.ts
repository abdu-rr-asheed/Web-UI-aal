import { TestBed } from '@angular/core/testing';
import { AriaIdService } from './ids/aria-id.service';
import { TypeaheadService } from './keyboard/typeahead.service';
import { DismissService, type DismissReason } from './dismiss/dismiss.service';
import { ScrollLockService } from './scroll/scroll-lock.service';
import { A11yAssertService } from './assert/a11y-assert.service';
import { FocusObscuringGuard } from './focus/focus-obscuring-guard';
import { AAL_DEFAULT_CONFIG, provideAal } from './config/aal-config';

/**
 * L2 Accessibility Core (PRD §7.4).
 *
 * Every AAL component depends on this layer, so a defect here is a defect in
 * every component simultaneously. These tests are correspondingly blunt about
 * the failure modes each service exists to prevent.
 */

describe('AriaIdService (FR-07)', () => {
  let ids: AriaIdService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    ids = TestBed.inject(AriaIdService);
  });

  it('never repeats an id', () => {
    // Duplicate ids silently repoint an ARIA relationship at the wrong
    // element — renders correctly, reads wrongly.
    const generated = Array.from({ length: 500 }, () => ids.next('aal-x'));
    expect(new Set(generated).size).toBe(500);
  });

  it('keeps the caller prefix so ids are debuggable in the DOM', () => {
    expect(ids.next('aal-dialog-title')).toMatch(/^aal-dialog-title-\d+$/);
  });

  it('produces the same sequence from a fresh injector, which is what makes SSR hydration safe (FR-09)', () => {
    const server = [ids.next('p'), ids.next('p'), ids.next('p')];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const client = TestBed.inject(AriaIdService);
    const hydrated = [client.next('p'), client.next('p'), client.next('p')];

    expect(hydrated).toEqual(server);
  });
});

describe('TypeaheadService (AR-03)', () => {
  const LABELS = ['Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil'];
  let typeahead: TypeaheadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    typeahead = TestBed.inject(TypeaheadService);
  });

  describe('single character', () => {
    it('matches the first item starting with it', () => {
      expect(typeahead.type('b', LABELS, -1, 1000)).toBe(3); // Belgium
    });

    it('is case-insensitive', () => {
      expect(typeahead.type('B', LABELS, -1, 1000)).toBe(3);
    });

    it('returns null when nothing matches', () => {
      expect(typeahead.type('z', LABELS, -1, 1000)).toBeNull();
    });
  });

  describe('multi-character within the reset window', () => {
    it('narrows the match as more characters arrive', () => {
      // "aust" is genuinely ambiguous — it prefixes both Australia and
      // Austria — so the match only moves at "austri". Asserting otherwise
      // would be asserting a bug: jumping to Austria on "aust" would take the
      // user somewhere they had not yet specified.
      expect(typeahead.type('a', LABELS, -1, 1000)).toBe(0); // Argentina
      expect(typeahead.type('u', LABELS, 0, 1100)).toBe(1); // au    -> Australia
      expect(typeahead.type('s', LABELS, 1, 1200)).toBe(1); // aus   -> Australia
      expect(typeahead.type('t', LABELS, 1, 1300)).toBe(1); // aust  -> still ambiguous
      expect(typeahead.type('r', LABELS, 1, 1400)).toBe(1); // austr -> still ambiguous
      expect(typeahead.type('i', LABELS, 1, 1500)).toBe(2); // austri -> Austria
    });

    it('starts a new search once the reset window lapses', () => {
      typeahead.type('a', LABELS, -1, 1000);
      typeahead.type('u', LABELS, 0, 1100);
      // >500ms later: "b" begins a fresh search rather than continuing "aub".
      expect(typeahead.type('b', LABELS, 1, 5000)).toBe(3);
    });
  });

  describe('repeated same character', () => {
    it('cycles through items starting with it, per APG', () => {
      // This is how a user reaches the third "Sales…" entry without typing it.
      expect(typeahead.type('a', LABELS, -1, 1000)).toBe(0);
      expect(typeahead.type('a', LABELS, 0, 1100)).toBe(1);
      expect(typeahead.type('a', LABELS, 1, 1200)).toBe(2);
    });

    it('wraps back to the first match', () => {
      expect(typeahead.type('a', LABELS, 2, 1000)).toBe(0);
    });
  });

  it('ignores space, because Space activates the focused item in most APG patterns', () => {
    expect(typeahead.type(' ', LABELS, -1, 1000)).toBeNull();
  });

  it('ignores named keys', () => {
    expect(typeahead.type('ArrowDown', LABELS, -1, 1000)).toBeNull();
  });
});

describe('DismissService (AR-15)', () => {
  let dismiss: DismissService;
  let doc: Document;

  const layer = (): HTMLElement => {
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    return el;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    dismiss = TestBed.inject(DismissService);
    doc = TestBed.inject(DOCUMENT_TOKEN);
    dismiss.resetForTesting();
  });

  afterEach(() => dismiss.resetForTesting());

  it('dismisses only the top-most layer on Escape', () => {
    // The failure this prevents: one Escape closing a confirm dialog AND the
    // dialog behind it, losing the user's work with no explanation.
    const outer: DismissReason[] = [];
    const inner: DismissReason[] = [];

    dismiss.register(layer(), { onDismiss: (r) => outer.push(r) });
    dismiss.register(layer(), { onDismiss: (r) => inner.push(r) });

    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(inner).toEqual(['escape']);
    expect(outer).toEqual([]);
    expect(dismiss.depth).toBe(1);
  });

  it('unwinds the stack one Escape at a time', () => {
    const closed: string[] = [];
    dismiss.register(layer(), { onDismiss: () => closed.push('outer') });
    dismiss.register(layer(), { onDismiss: () => closed.push('inner') });

    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closed).toEqual(['inner', 'outer']);
    expect(dismiss.depth).toBe(0);
  });

  it('honours escape: false for layers that must not be Escape-dismissible', () => {
    const closed: DismissReason[] = [];
    dismiss.register(layer(), { onDismiss: (r) => closed.push(r), escape: false });

    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closed).toEqual([]);
    expect(dismiss.depth).toBe(1);
  });

  it('reports which layer is top-most', () => {
    const first = dismiss.register(layer(), { onDismiss: () => undefined });
    expect(first.isTop()).toBe(true);

    const second = dismiss.register(layer(), { onDismiss: () => undefined });
    expect(first.isTop()).toBe(false);
    expect(second.isTop()).toBe(true);
  });

  it('is idempotent — dismissing twice does not pop someone else’s layer', () => {
    const closed: string[] = [];
    const outer = dismiss.register(layer(), { onDismiss: () => closed.push('outer') });
    const inner = dismiss.register(layer(), { onDismiss: () => closed.push('inner') });

    inner.dismiss();
    inner.dismiss();

    expect(closed).toEqual(['inner']);
    expect(dismiss.depth).toBe(1);
    outer.dismiss();
    expect(closed).toEqual(['inner', 'outer']);
  });
});

describe('ScrollLockService (AR-15)', () => {
  let lock: ScrollLockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    lock = TestBed.inject(ScrollLockService);
    lock.resetForTesting();
  });

  afterEach(() => {
    lock.resetForTesting();
    document.body.style.overflow = '';
    document.body.style.paddingInlineEnd = '';
  });

  it('locks and unlocks', () => {
    expect(lock.locked).toBe(false);
    lock.lock();
    expect(lock.locked).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    lock.unlock();
    expect(lock.locked).toBe(false);
  });

  it('reference-counts, so a nested dialog closing does not unlock the page', () => {
    lock.lock();
    lock.lock();

    lock.unlock();
    expect(lock.locked).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    lock.unlock();
    expect(lock.locked).toBe(false);
  });

  it('restores the original overflow rather than assuming it was empty', () => {
    document.body.style.overflow = 'scroll';
    lock.lock();
    lock.unlock();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('ignores an unlock with no matching lock', () => {
    expect(() => lock.unlock()).not.toThrow();
    expect(lock.locked).toBe(false);
  });
});

describe('A11yAssertService (FR-08)', () => {
  let assert: A11yAssertService;

  const setup = (assertions: 'throw' | 'warn' | 'off') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAal({ assertions })] });
    assert = TestBed.inject(A11yAssertService);
    assert.resetForTesting();
  };

  const el = (html: string): Element => {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    return host.firstElementChild!;
  };

  it('throws on a control with no accessible name', () => {
    setup('throw');
    expect(() => assert.assertAccessibleName(el('<button></button>'), 'aal-button')).toThrow(/no accessible name/);
  });

  it('accepts a name from projected content', () => {
    setup('throw');
    expect(() => assert.assertAccessibleName(el('<button>Save</button>'), 'aal-button')).not.toThrow();
  });

  it('accepts a name from aria-label', () => {
    setup('throw');
    expect(() => assert.assertAccessibleName(el('<button aria-label="Close"></button>'), 'aal-button')).not.toThrow();
  });

  it('accepts a name from aria-labelledby', () => {
    setup('throw');
    document.body.insertAdjacentHTML('beforeend', '<span id="lbl-x">Delete</span>');
    expect(() =>
      assert.assertAccessibleName(el('<button aria-labelledby="lbl-x"></button>'), 'aal-button'),
    ).not.toThrow();
  });

  it('names the requirement and the fix, because an error that says only "invalid ARIA" teaches nothing', () => {
    setup('throw');
    try {
      assert.assertAccessibleName(el('<button></button>'), 'aal-button');
      throw new Error('should have thrown');
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain('[AAL][FR-08 / AR-01]');
      expect(message).toContain('Fix:');
    }
  });

  it('reports missing required ARIA for a role', () => {
    setup('throw');
    expect(() =>
      assert.assertRequiredAria(el('<div role="checkbox"></div>'), 'checkbox', ['aria-checked'], 'aal-checkbox'),
    ).toThrow(/aria-checked/);
  });

  it('warns instead of throwing when configured to', () => {
    setup('warn');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => assert.assertAccessibleName(el('<button></button>'), 'aal-button')).not.toThrow();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('is silent when disabled', () => {
    setup('off');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => assert.assertAccessibleName(el('<button></button>'), 'aal-button')).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('deduplicates, so a broken component in an @for does not bury the real error', () => {
    setup('warn');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (let i = 0; i < 20; i++) assert.assertAccessibleName(el('<button></button>'), 'aal-button');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe('FocusObscuringGuard (AR-06 / SC 2.4.11)', () => {
  let guard: FocusObscuringGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(FocusObscuringGuard);
  });

  it('reports visible in jsdom, which has no layout engine (D-003)', () => {
    // jsdom cannot answer this question — every rect is 0x0 and there is no
    // elementFromPoint worth trusting. Reporting "visible" is the honest
    // default; the real assertion lives in the Playwright suite (TR-04).
    const el = document.createElement('button');
    document.body.appendChild(el);
    expect(guard.check(el).visible).toBe(true);
  });

  it('never throws on a detached element', () => {
    expect(() => guard.check(document.createElement('div'))).not.toThrow();
  });
});

describe('provideAal (FR-11)', () => {
  it('is not required — defaults are complete', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(AriaIdService)).toBeTruthy();
  });

  it('merges partial config over the defaults', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideAal({ announceDebounceMs: 0 })] });
    const assert = TestBed.inject(A11yAssertService);
    // Untouched keys keep their defaults.
    expect(AAL_DEFAULT_CONFIG.assertions).toBe('throw');
    expect(assert.enabled).toBe(true);
  });
});

// Imported late so the DOCUMENT token reference stays close to its single use.
import { DOCUMENT as DOCUMENT_TOKEN } from '@angular/core';
