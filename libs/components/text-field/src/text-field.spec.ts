import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalTextField } from './text-field';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Text Field (PRD §9.2).
 *
 * Unlabelled inputs appear on roughly half of all pages in WebAIM's survey.
 * The interesting tests here are the ones about WHEN things are announced,
 * because that is what separates a form a screen-reader user can complete from
 * one that merely passes an automated audit.
 */

const setup = (template: string, extra: Record<string, unknown> = {}) =>
  render(template, {
    imports: [AalTextField],
    providers: [provideAal({ assertions: 'off' })],
    componentProperties: extra,
  });

describe('AalTextField', () => {
  describe('labelling (AR-11 / SC 3.3.2)', () => {
    it('associates a real <label> with the control', async () => {
      await setup(`<aal-text-field label="Email address" />`);
      // getByRole with a name proves the ASSOCIATION, not merely that a label
      // element exists somewhere on the page.
      expect(screen.getByRole('textbox', { name: /Email address/ })).toBeTruthy();
    });

    it('keeps the label in the accessibility tree when visually hidden', async () => {
      await setup(`<aal-text-field label="Search" [hideLabel]="true" />`);
      expect(screen.getByRole('textbox', { name: /Search/ })).toBeTruthy();
    });

    it('does not use the placeholder as the label', async () => {
      // A placeholder disappears the moment the user types, taking the only
      // description of the field with it.
      await setup(`<aal-text-field label="Email address" placeholder="name@example.org" />`);
      const input = screen.getByRole('textbox', { name: /Email address/ });
      expect(input.getAttribute('placeholder')).toBe('name@example.org');
      expect(input.getAttribute('aria-label')).toBeNull();
    });

    it('announces required state in words, not only an asterisk', async () => {
      // Several screen readers do not announce punctuation by default, and the
      // asterisk convention has to be known in advance to mean anything.
      await setup(`<aal-text-field label="Full name" [required]="true" />`);
      expect(screen.getByRole('textbox', { name: /required/i })).toBeTruthy();
    });

    it('exposes aria-required', async () => {
      await setup(`<aal-text-field label="Full name" [required]="true" />`);
      expect(screen.getByRole('textbox', { name: /Full name/ }).getAttribute('aria-required')).toBe('true');
    });
  });

  describe('hint and error ordering in aria-describedby', () => {
    it('references the hint', async () => {
      await setup(`<aal-text-field label="Date" hint="Use DD/MM/YYYY" />`);
      const input = screen.getByRole('textbox', { name: /Date/ });
      const described = input.getAttribute('aria-describedby')!;
      expect(document.getElementById(described)?.textContent).toContain('DD/MM/YYYY');
    });

    it('lists hint BEFORE error, so the instruction arrives while it can still help', async () => {
      const user = userEvent.setup();
      const { container } = await setup(
        `<aal-text-field label="Date" hint="Use DD/MM/YYYY" error="That date is not valid" />`,
      );

      const input = screen.getByRole('textbox', { name: /Date/ });
      await user.click(input);
      await user.tab(); // blur -> touched

      const ids = input.getAttribute('aria-describedby')!.split(' ');
      const texts = ids.map((id) => container.querySelector(`#${id}`)?.textContent?.trim() ?? '');
      expect(texts[0]).toContain('DD/MM/YYYY');
      expect(texts[1]).toContain('not valid');
    });
  });

  describe('error state waits for touched (AR-12)', () => {
    it('does NOT mark an untouched field invalid', async () => {
      // Otherwise a screen-reader user tabbing through a fresh form hears
      // "invalid" on every control before typing a character.
      await setup(`<aal-text-field label="Email" error="Enter an email address" />`);
      const input = screen.getByRole('textbox', { name: /Email/ });
      expect(input.hasAttribute('aria-invalid')).toBe(false);
    });

    it('does not render the error message before the field is touched', async () => {
      await setup(`<aal-text-field label="Email" error="Enter an email address" />`);
      expect(screen.queryByText('Enter an email address')).toBeNull();
    });

    it('marks invalid and shows the error after blur', async () => {
      const user = userEvent.setup();
      await setup(`<aal-text-field label="Email" error="Enter an email address" />`);
      const input = screen.getByRole('textbox', { name: /Email/ });

      await user.click(input);
      await user.tab();

      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Enter an email address')).toBeTruthy();
    });

    it('conveys the error by icon and text, not colour alone (AR-13)', async () => {
      const user = userEvent.setup();
      const { container } = await setup(`<aal-text-field label="Email" error="Enter an email address" />`);

      await user.click(screen.getByRole('textbox', { name: /Email/ }));
      await user.tab();

      // The icon is decorative — the TEXT is what carries the meaning.
      expect(container.querySelector('.aal-field__error-icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(container.querySelector('.aal-field__error')?.textContent).toContain('Enter an email address');
    });
  });

  describe('autofill (SC 1.3.5 / AR-23)', () => {
    it('emits the autocomplete token', async () => {
      await setup(`<aal-text-field label="Email" type="email" autocomplete="email" />`);
      expect(screen.getByRole('textbox', { name: /Email/ }).getAttribute('autocomplete')).toBe('email');
    });

    it('omits the attribute when unset rather than emitting an empty one', async () => {
      await setup(`<aal-text-field label="Nickname" />`);
      expect(screen.getByRole('textbox', { name: /Nickname/ }).hasAttribute('autocomplete')).toBe(false);
    });
  });

  describe('multiline', () => {
    it('renders a textarea and keeps the same labelling', async () => {
      await setup(`<aal-text-field label="Comments" [multiline]="true" />`);
      const textarea = screen.getByRole('textbox', { name: /Comments/ });
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Reactive Forms integration (FR-05)', () => {
    it('writes and reads the value', async () => {
      const control = new FormControl('initial');
      await render(`<aal-text-field label="Name" [formControl]="control" />`, {
        imports: [AalTextField, ReactiveFormsModule],
        providers: [provideAal({ assertions: 'off' })],
        componentProperties: { control },
      });

      expect((screen.getByRole('textbox', { name: /Name/ }) as HTMLInputElement).value).toBe('initial');

      await userEvent.setup().type(screen.getByRole('textbox', { name: /Name/ }), '!');
      expect(control.value).toBe('initial!');
    });

    it('honours setDisabledState, not just the disabled input', async () => {
      const control = new FormControl({ value: '', disabled: true });
      await render(`<aal-text-field label="Name" [formControl]="control" />`, {
        imports: [AalTextField, ReactiveFormsModule],
        providers: [provideAal({ assertions: 'off' })],
        componentProperties: { control },
      });

      expect((screen.getByRole('textbox', { name: /Name/ }) as HTMLInputElement).disabled).toBe(true);
    });

    it('marks touched on blur so validators can surface', async () => {
      const control = new FormControl('', Validators.required);
      const { fixture } = await render(`<aal-text-field label="Name" [formControl]="control" />`, {
        imports: [AalTextField, ReactiveFormsModule],
        providers: [provideAal({ assertions: 'off' })],
        componentProperties: { control },
      });

      const user = userEvent.setup();
      await user.click(screen.getByRole('textbox', { name: /Name/ }));
      await user.tab();
      fixture.detectChanges();

      expect(control.touched).toBe(true);
    });
  });

  describe('character counter', () => {
    it('is announced politely, not assertively', async () => {
      const { container } = await setup(
        `<aal-text-field label="Bio" [maxLength]="100" [showCounter]="true" />`,
      );
      expect(container.querySelector('.aal-field__counter')?.getAttribute('aria-live')).toBe('polite');
    });

    it('reports the remaining count', async () => {
      const user = userEvent.setup();
      const { container, fixture } = await setup(
        `<aal-text-field label="Bio" [maxLength]="10" [showCounter]="true" />`,
      );

      await user.type(screen.getByRole('textbox', { name: /Bio/ }), 'abc');
      fixture.detectChanges();

      expect(container.querySelector('.aal-field__counter')?.textContent).toContain('7 characters remaining');
    });
  });

  describe('axe — every documented state (TR-01)', () => {
    const states: [string, string][] = [
      ['default', `<aal-text-field label="Email address" />`],
      ['required', `<aal-text-field label="Email address" [required]="true" />`],
      ['with hint', `<aal-text-field label="Date" hint="Use DD/MM/YYYY" />`],
      ['with placeholder', `<aal-text-field label="Email" placeholder="name@example.org" />`],
      ['hidden label', `<aal-text-field label="Search" [hideLabel]="true" />`],
      ['disabled', `<aal-text-field label="Email" [disabled]="true" />`],
      ['readonly', `<aal-text-field label="Email" [readonly]="true" />`],
      ['multiline', `<aal-text-field label="Comments" [multiline]="true" />`],
      ['email type', `<aal-text-field label="Email" type="email" autocomplete="email" />`],
      ['password type', `<aal-text-field label="Password" type="password" autocomplete="current-password" />`],
      ['with counter', `<aal-text-field label="Bio" [maxLength]="100" [showCounter]="true" />`],
    ];

    it.each(states)('is clean in the %s state', async (name, template) => {
      const { container } = await setup(template);
      await expectNoA11yViolations(container, name);
    });

    it('is clean in the error state', async () => {
      const user = userEvent.setup();
      const { container } = await setup(`<aal-text-field label="Email" error="Enter an email address" />`);
      await user.click(screen.getByRole('textbox', { name: /Email/ }));
      await user.tab();
      await expectNoA11yViolations(container, 'error, touched');
    });
  });
});
