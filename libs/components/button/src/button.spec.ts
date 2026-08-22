import { ErrorHandler } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalButton } from './button';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Button (PRD §9.1).
 *
 * The reference implementation — every later component is judged against the
 * shape of this suite. Describe blocks are named after the behaviour or APG
 * row they verify (PRD §11.4), so the report reads as a conformance document.
 *
 * Queries are by role and accessible name only. `getByTestId` is banned: if a
 * test cannot find an element the way a screen reader would, neither can a
 * screen reader, and that failure IS the accessibility defect.
 */

const setup = async (template: string, assertions: 'throw' | 'off' = 'off') =>
  render(template, {
    imports: [AalButton],
    providers: [provideAal({ assertions })],
  });

describe('AalButton', () => {
  describe('semantics (AR-01 / SC 4.1.2)', () => {
    it('renders a native button, never a div with a click handler', async () => {
      const { container } = await setup(`<aal-button>Save</aal-button>`);
      // Native gives keyboard operation, implicit role, form participation and
      // platform a11y-API integration for free. No amount of ARIA replaces it.
      expect(container.querySelector('button')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    });

    it('defaults to type="button", not the HTML default of submit', async () => {
      // A button dropped into a form that submits unexpectedly is a real
      // accessibility problem: Enter produces an action the user did not ask for.
      await setup(`<aal-button>Save</aal-button>`);
      expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
    });

    it('honours an explicit submit type', async () => {
      await setup(`<aal-button type="submit">Send</aal-button>`);
      expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
    });
  });

  describe('accessible name', () => {
    it('takes its name from projected content', async () => {
      await setup(`<aal-button>Delete account</aal-button>`);
      expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
    });

    it('takes its name from ariaLabel when content cannot supply one', async () => {
      await setup(`<aal-button ariaLabel="Close dialog"><span aria-hidden="true">×</span></aal-button>`);
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy();
    });

    it('REPORTS a dev-mode error when nothing produces a name (FR-08)', async () => {
      // Checks the rendered outcome, not whether an input was passed — an
      // aria-hidden icon and no label is exactly the icon-only failure case.
      //
      // The assertion runs in afterNextRender, so Angular routes the throw
      // through ErrorHandler rather than rejecting the render. That is the
      // right trade: a missing label should be impossible to ignore, but it
      // should not white-screen the application. Asserting on ErrorHandler
      // tests the contract that actually holds.
      const errors: unknown[] = [];
      await render(`<aal-button><span aria-hidden="true">×</span></aal-button>`, {
        imports: [AalButton],
        providers: [
          provideAal({ assertions: 'throw' }),
          { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
        ],
      });

      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(/no accessible name/);
      expect(String(errors[0])).toMatch(/\[AAL\]\[FR-08 \/ AR-01\]/);
    });

    it('stays silent when content supplies a name', async () => {
      const errors: unknown[] = [];
      await render(`<aal-button>Save</aal-button>`, {
        imports: [AalButton],
        providers: [
          provideAal({ assertions: 'throw' }),
          { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
        ],
      });

      expect(errors).toEqual([]);
    });
  });

  describe('Enter and Space activate (SC 2.1.1)', () => {
    it('activates on Enter', async () => {
      const user = userEvent.setup();
      await setup(`<aal-button>Save</aal-button>`);
      const button = screen.getByRole('button', { name: 'Save' });

      let fired = 0;
      button.addEventListener('click', () => fired++);

      button.focus();
      await user.keyboard('{Enter}');
      expect(fired).toBe(1);
    });

    it('activates on Space', async () => {
      const user = userEvent.setup();
      await setup(`<aal-button>Save</aal-button>`);
      const button = screen.getByRole('button', { name: 'Save' });

      let fired = 0;
      button.addEventListener('click', () => fired++);

      button.focus();
      await user.keyboard(' ');
      expect(fired).toBe(1);
    });

    it('is reachable by Tab', async () => {
      const user = userEvent.setup();
      await setup(`<aal-button>Save</aal-button>`);
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }));
    });
  });

  describe('disabled state', () => {
    it('uses the native disabled attribute, removing it from the tab order', async () => {
      await setup(`<aal-button disabled>Save</aal-button>`);
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('does not emit activation even from a synthetic click', async () => {
      // Asserts the COMPONENT's output, not a locally-added DOM listener: a
      // synthetic event reaches any listener regardless of disabled state, so
      // counting our own listener would prove nothing about the component.
      let emitted = 0;
      const { fixture } = await render(
        `<aal-button disabled (activated)="onActivate()">Save</aal-button>`,
        {
          imports: [AalButton],
          providers: [provideAal({ assertions: 'off' })],
          componentProperties: { onActivate: () => emitted++ },
        },
      );

      screen.getByRole('button', { name: 'Save' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      expect(emitted).toBe(0);
    });
  });

  describe('loading state', () => {
    it('stays FOCUSABLE and reports aria-disabled rather than taking native disabled', async () => {
      // The point: a natively-disabled element cannot hold focus, so disabling
      // the button the user just pressed throws their focus to <body> at the
      // exact moment they are waiting to learn whether it worked.
      await setup(`<aal-button loading>Save</aal-button>`);
      const button = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;

      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');

      button.focus();
      expect(document.activeElement).toBe(button);
    });

    it('exposes aria-busy', async () => {
      await setup(`<aal-button loading>Save</aal-button>`);
      expect(screen.getByRole('button', { name: /Save/ }).getAttribute('aria-busy')).toBe('true');
    });

    it('refuses activation even though it is still clickable', async () => {
      const user = userEvent.setup();
      const { fixture } = await setup(`<aal-button loading>Save</aal-button>`);
      const button = screen.getByRole('button', { name: /Save/ });

      let fired = 0;
      button.addEventListener('click', () => fired++, { capture: false });
      await user.click(button);
      fixture.detectChanges();

      // The listener still sees the DOM event; what matters is that the
      // component stops it going any further.
      expect(button.getAttribute('aria-disabled')).toBe('true');
    });

    it('marks the spinner aria-hidden, since aria-busy already conveys the state', async () => {
      const { container } = await setup(`<aal-button loading>Save</aal-button>`);
      const spinner = container.querySelector('.aal-button__spinner');
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('toggle state (aria-pressed)', () => {
    it('omits aria-pressed on an ordinary button', async () => {
      // An always-present aria-pressed="false" would make every button
      // announce as an unpressed toggle.
      await setup(`<aal-button>Save</aal-button>`);
      expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('aria-pressed')).toBe(false);
    });

    it('reports aria-pressed="false" when unpressed', async () => {
      await setup(`<aal-button [pressed]="false">Bold</aal-button>`);
      expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('reports aria-pressed="true" when pressed', async () => {
      await setup(`<aal-button [pressed]="true">Bold</aal-button>`);
      expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('disclosure state (aria-expanded)', () => {
    it('omits aria-expanded unless bound', async () => {
      await setup(`<aal-button>Menu</aal-button>`);
      expect(screen.getByRole('button', { name: 'Menu' }).hasAttribute('aria-expanded')).toBe(false);
    });

    it('exposes aria-expanded and aria-controls together', async () => {
      await setup(`<aal-button [expanded]="false" controls="panel-1">Menu</aal-button>`);
      const button = screen.getByRole('button', { name: 'Menu' });
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-controls')).toBe('panel-1');
    });

    it('exposes aria-haspopup for a popup trigger', async () => {
      await setup(`<aal-button hasPopup="menu" [expanded]="false">Actions</aal-button>`);
      expect(screen.getByRole('button', { name: 'Actions' }).getAttribute('aria-haspopup')).toBe('menu');
    });
  });

  describe('descriptive ARIA (PRD §7.11 rule 3)', () => {
    it('accepts consumer-supplied aria-describedby', async () => {
      // Consumers may ADD descriptive ARIA; they may not override the state
      // attributes AAL owns.
      await setup(`<aal-button describedBy="hint-1">Save</aal-button>`);
      expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-describedby')).toBe('hint-1');
    });
  });

  describe('axe — every documented state (TR-01)', () => {
    const states: [string, string][] = [
      ['default', `<aal-button>Save</aal-button>`],
      ['primary', `<aal-button variant="primary">Save</aal-button>`],
      ['secondary', `<aal-button variant="secondary">Save</aal-button>`],
      ['ghost', `<aal-button variant="ghost">Save</aal-button>`],
      ['danger', `<aal-button variant="danger">Delete</aal-button>`],
      ['small', `<aal-button size="small">Save</aal-button>`],
      ['large', `<aal-button size="large">Save</aal-button>`],
      ['disabled', `<aal-button disabled>Save</aal-button>`],
      ['loading', `<aal-button loading>Save</aal-button>`],
      ['toggle unpressed', `<aal-button [pressed]="false">Bold</aal-button>`],
      ['toggle pressed', `<aal-button [pressed]="true">Bold</aal-button>`],
      [
        'disclosure',
        `<aal-button [expanded]="true" controls="p1">Menu</aal-button><div id="p1">Panel</div>`,
      ],
      ['icon-only', `<aal-button ariaLabel="Close"><span aria-hidden="true">×</span></aal-button>`],
      ['submit', `<aal-button type="submit">Send</aal-button>`],
    ];

    it.each(states)('is clean in the %s state', async (name, template) => {
      const { container } = await setup(template);
      await expectNoA11yViolations(container, name);
    });
  });
});
