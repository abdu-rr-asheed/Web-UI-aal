import { TestBed } from '@angular/core/testing';
import { FocusTrapFacade } from './focus-trap.facade';

/**
 * Modal focus management (AR-15 / SC 2.1.2, 2.4.3).
 *
 * Dialog depends on this service entirely, and the dialog is the component
 * that most reliably fails accessibility review in mainstream libraries
 * (PRD §9.5). These tests cover the three things that actually go wrong:
 * background content staying readable, focus being lost on close, and initial
 * focus landing somewhere dangerous.
 *
 * Scope note: jsdom has no layout engine, so Tab CYCLING inside the trap is
 * verified in Playwright (TR-04), not here. What is verifiable here — inert
 * application, initial-focus resolution and restoration — is exactly the part
 * that is pure DOM manipulation.
 */
describe('FocusTrapFacade', () => {
  let facade: FocusTrapFacade;
  let root: HTMLElement;

  const build = (html: string): HTMLElement => {
    root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(FocusTrapFacade);
  });

  afterEach(() => {
    root?.remove();
    document.body.innerHTML = '';
  });

  describe('initial focus (PRD §9.5 resolution order)', () => {
    it('prefers an element marked [aalFocusInitial]', () => {
      const el = build(`
        <div id="dialog">
          <button id="first">Cancel</button>
          <button id="marked" data-aal-focus-initial>Rename</button>
        </div>`);
      const dialog = el.querySelector<HTMLElement>('#dialog')!;

      facade.trap(dialog);

      expect(document.activeElement?.id).toBe('marked');
    });

    it('falls back to the first tabbable element', () => {
      const el = build(`
        <div id="dialog">
          <button id="first">Cancel</button>
          <button id="second">Delete</button>
        </div>`);

      facade.trap(el.querySelector<HTMLElement>('#dialog')!);

      expect(document.activeElement?.id).toBe('first');
    });

    it('falls back to the container itself when nothing inside is tabbable', () => {
      const el = build('<div id="dialog"><p>Read-only notice</p></div>');
      const dialog = el.querySelector<HTMLElement>('#dialog')!;

      facade.trap(dialog);

      // tabindex="-1" so it can hold focus without becoming a tab stop.
      expect(dialog.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(dialog);
    });

    it('honours an explicitly requested initial focus target', () => {
      const el = build(`
        <div id="dialog">
          <button id="first">Cancel</button>
          <button id="safe">Keep</button>
        </div>`);
      const safe = el.querySelector<HTMLElement>('#safe')!;

      facade.trap(el.querySelector<HTMLElement>('#dialog')!, { initialFocus: safe });

      // Matters because the default must never be a destructive action: a
      // screen-reader user who presses Enter on open should not delete data.
      expect(document.activeElement?.id).toBe('safe');
    });
  });

  describe('inert background (AR-15)', () => {
    it('marks siblings inert so a screen reader cannot read behind the dialog', () => {
      // A focus trap stops Tab escaping, but WITHOUT inert a screen reader in
      // browse mode still reads the page behind — the user hears content they
      // cannot reach. aria-modal promises this; only inert delivers it.
      const el = build(`
        <div id="page">Background copy</div>
        <div id="dialog"><button>OK</button></div>`);

      facade.trap(el.querySelector<HTMLElement>('#dialog')!);

      expect(el.querySelector('#page')?.hasAttribute('inert')).toBe(true);
      expect(el.querySelector('#dialog')?.hasAttribute('inert')).toBe(false);
    });

    it('removes inert on release', () => {
      const el = build(`
        <div id="page">Background</div>
        <div id="dialog"><button>OK</button></div>`);

      facade.trap(el.querySelector<HTMLElement>('#dialog')!).release();

      expect(el.querySelector('#page')?.hasAttribute('inert')).toBe(false);
    });

    it('leaves live regions alive, so announcements still work while a dialog is open', () => {
      const el = build(`
        <div id="live" aria-live="polite"></div>
        <div id="dialog"><button>OK</button></div>`);

      facade.trap(el.querySelector<HTMLElement>('#dialog')!);

      expect(el.querySelector('#live')?.hasAttribute('inert')).toBe(false);
    });

    it('does not un-inert the page when only the inner of two nested dialogs closes', () => {
      const el = build(`
        <div id="page">Background</div>
        <div id="outer"><button>Outer</button><div id="inner"><button>Inner</button></div></div>`);

      facade.trap(el.querySelector<HTMLElement>('#outer')!);
      const innerTrap = facade.trap(el.querySelector<HTMLElement>('#inner')!);

      innerTrap.release();

      expect(el.querySelector('#page')?.hasAttribute('inert')).toBe(true);
    });

    it('skips inert entirely for non-modal layers', () => {
      const el = build(`
        <div id="page">Background</div>
        <div id="popover"><button>OK</button></div>`);

      facade.trap(el.querySelector<HTMLElement>('#popover')!, { inertBackground: false });

      expect(el.querySelector('#page')?.hasAttribute('inert')).toBe(false);
    });
  });

  describe('focus restoration on release', () => {
    it('returns focus to whatever opened the dialog', () => {
      const el = build(`
        <button id="trigger">Open</button>
        <div id="dialog"><button>OK</button></div>`);
      const trigger = el.querySelector<HTMLElement>('#trigger')!;
      trigger.focus();

      facade.trap(el.querySelector<HTMLElement>('#dialog')!).release();

      expect(document.activeElement).toBe(trigger);
    });

    it('honours an explicit restore target', () => {
      const el = build(`
        <button id="trigger">Open</button>
        <button id="elsewhere">Elsewhere</button>
        <div id="dialog"><button>OK</button></div>`);
      el.querySelector<HTMLElement>('#trigger')!.focus();
      const elsewhere = el.querySelector<HTMLElement>('#elsewhere')!;

      facade
        .trap(el.querySelector<HTMLElement>('#dialog')!, { restoreTo: elsewhere })
        .release();

      expect(document.activeElement).toBe(elsewhere);
    });

    it('NEVER loses focus to body when the trigger was removed while open', () => {
      // The real scenario: delete a row, confirm in a dialog, close. The
      // trigger no longer exists. Naive restoration dumps the keyboard user at
      // the top of the document with no idea where they are.
      const el = build(`
        <main id="main"><button id="trigger">Delete row</button></main>
        <div id="dialog"><button>Confirm</button></div>`);
      const trigger = el.querySelector<HTMLElement>('#trigger')!;
      trigger.focus();

      const handle = facade.trap(el.querySelector<HTMLElement>('#dialog')!);
      trigger.remove(); // the row, and its button, are gone
      handle.release();

      expect(document.activeElement).not.toBe(document.body);
      expect((document.activeElement as HTMLElement)?.id).toBe('main');
    });

    it('gives the fallback tabindex="-1" so it can hold focus without becoming a tab stop', () => {
      const el = build(`
        <main id="main"><button id="trigger">Go</button></main>
        <div id="dialog"><button>OK</button></div>`);
      const trigger = el.querySelector<HTMLElement>('#trigger')!;
      trigger.focus();

      const handle = facade.trap(el.querySelector<HTMLElement>('#dialog')!);
      trigger.remove();
      handle.release();

      expect(el.querySelector('#main')?.getAttribute('tabindex')).toBe('-1');
    });
  });
});
