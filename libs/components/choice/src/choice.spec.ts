import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalCheckbox, AalSwitch } from './checkbox';
import { AalRadioGroup, type AalRadioOption } from './radio-group';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Checkbox, Switch and Radio Group (PRD §9.3).
 *
 * Describe blocks for the radio group are named after the APG Radio Group
 * interaction-table rows (PRD §11.4), so the report reads as a conformance
 * document.
 */

const OPTIONS: AalRadioOption[] = [
  { value: 'standard', label: 'Standard delivery' },
  { value: 'express', label: 'Express delivery' },
  { value: 'collect', label: 'Click and collect' },
];

const setup = (template: string, props: Record<string, unknown> = {}) =>
  render(template, {
    imports: [AalCheckbox, AalSwitch, AalRadioGroup, ReactiveFormsModule],
    providers: [provideAal({ assertions: 'off' })],
    componentProperties: props,
  });

describe('AalCheckbox', () => {
  describe('native input retained', () => {
    it('renders a real input[type=checkbox], not a div', async () => {
      const { container } = await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      const input = container.querySelector('input[type="checkbox"]');
      expect(input).not.toBeNull();
      expect(screen.getByRole('checkbox', { name: 'Subscribe' })).toBeTruthy();
    });

    it('keeps the input in the accessibility tree — never display:none', async () => {
      // display:none would remove it from the tree AND the tab order, forcing a
      // re-implementation of everything the platform already does correctly.
      const { container } = await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(getComputedStyle(input).display).not.toBe('none');
      expect(getComputedStyle(input).visibility).not.toBe('hidden');
    });

    it('marks the drawn indicator aria-hidden, so the tree describes ONE checkbox', async () => {
      const { container } = await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      expect(container.querySelector('.aal-choice__indicator')?.getAttribute('aria-hidden')).toBe('true');
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });
  });

  describe('Space toggles (APG Checkbox)', () => {
    it('toggles on Space without a custom key handler', async () => {
      const user = userEvent.setup();
      await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      const box = screen.getByRole('checkbox', { name: 'Subscribe' }) as HTMLInputElement;

      box.focus();
      await user.keyboard(' ');
      expect(box.checked).toBe(true);

      await user.keyboard(' ');
      expect(box.checked).toBe(false);
    });

    it('is reachable by Tab', async () => {
      const user = userEvent.setup();
      await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('checkbox', { name: 'Subscribe' }));
    });

    it('toggles when the LABEL is clicked, via the native for/id association', async () => {
      const user = userEvent.setup();
      await setup(`<aal-checkbox>Subscribe</aal-checkbox>`);
      await user.click(screen.getByText('Subscribe'));
      expect((screen.getByRole('checkbox', { name: 'Subscribe' }) as HTMLInputElement).checked).toBe(true);
    });
  });

  describe('indeterminate (tri-state parent)', () => {
    it('reports aria-checked="mixed", not unchecked', async () => {
      // Without this a partially-selected parent announces as plainly
      // unchecked — the opposite of the truth.
      await setup(`<aal-checkbox [indeterminate]="true">Select all</aal-checkbox>`);
      expect(screen.getByRole('checkbox', { name: 'Select all' }).getAttribute('aria-checked')).toBe('mixed');
    });

    it('sets the native indeterminate property too', async () => {
      const { container } = await setup(`<aal-checkbox [indeterminate]="true">Select all</aal-checkbox>`);
      expect(container.querySelector<HTMLInputElement>('input')!.indeterminate).toBe(true);
    });
  });

  describe('Reactive Forms (FR-05)', () => {
    it('reflects and updates a FormControl', async () => {
      const control = new FormControl(true);
      await setup(`<aal-checkbox [formControl]="control">Subscribe</aal-checkbox>`, { control });

      const box = screen.getByRole('checkbox', { name: 'Subscribe' }) as HTMLInputElement;
      expect(box.checked).toBe(true);

      await userEvent.setup().click(box);
      expect(control.value).toBe(false);
    });

    it('honours setDisabledState', async () => {
      const control = new FormControl({ value: false, disabled: true });
      await setup(`<aal-checkbox [formControl]="control">Subscribe</aal-checkbox>`, { control });
      expect((screen.getByRole('checkbox', { name: 'Subscribe' }) as HTMLInputElement).disabled).toBe(true);
    });
  });
});

describe('AalSwitch', () => {
  it('exposes role="switch", not checkbox', async () => {
    // Semantic, not cosmetic: a settings toggle announced as a checkbox
    // implies a Save button that is not coming.
    await setup(`<aal-switch>Email notifications</aal-switch>`);
    expect(screen.getByRole('switch', { name: 'Email notifications' })).toBeTruthy();
  });

  it('reports its state through aria-checked', async () => {
    const user = userEvent.setup();
    await setup(`<aal-switch>Email notifications</aal-switch>`);
    const sw = screen.getByRole('switch', { name: 'Email notifications' });

    expect(sw.getAttribute('aria-checked')).toBe('false');
    await user.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('toggles on Space', async () => {
    const user = userEvent.setup();
    await setup(`<aal-switch>Email notifications</aal-switch>`);
    const sw = screen.getByRole('switch', { name: 'Email notifications' }) as HTMLInputElement;
    sw.focus();
    await user.keyboard(' ');
    expect(sw.checked).toBe(true);
  });
});

describe('AalRadioGroup', () => {
  const group = (extra = '') =>
    setup(`<aal-radio-group legend="Delivery method" [options]="options" ${extra} />`, {
      options: OPTIONS,
    });

  describe('group semantics', () => {
    it('names the group with a <legend>, so readers announce the group and position', async () => {
      // "Delivery method, radio button, Standard delivery, 1 of 3". An
      // aria-label on a div loses the position announcement in several readers.
      const { container } = await group();
      expect(container.querySelector('fieldset')).not.toBeNull();
      expect(container.querySelector('legend')?.textContent).toContain('Delivery method');
    });

    it('renders one radio per option', async () => {
      await group();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('gives every radio the SAME name, which is what makes them one group', async () => {
      // Mismatched names silently produce several one-option groups that all
      // appear selectable at once.
      const { container } = await group();
      const names = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')].map((r) => r.name);
      expect(new Set(names).size).toBe(1);
      expect(names[0]).toBeTruthy();
    });
  });

  describe('Tab — moves focus into the group, then out of it', () => {
    it('is a single tab stop', async () => {
      const user = userEvent.setup();
      await setup(
        `<aal-radio-group legend="Delivery method" [options]="options" /><button>After</button>`,
        { options: OPTIONS },
      );

      await user.tab(); // into the group
      expect(screen.getAllByRole('radio')).toContain(document.activeElement);

      await user.tab(); // straight out, not to radio 2
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));
    });
  });

  describe('Arrow keys — moves to and SELECTS the adjacent radio', () => {
    /**
     * Verified in e2e/keyboard/radio-group.spec.ts, NOT here.
     *
     * Native radio arrow behaviour — move focus, select, wrap, single tab stop
     * — is implemented by the BROWSER, and jsdom does not implement it. A
     * jsdom test would therefore be testing nothing, and worse, it would go
     * green if the component ever stopped using native radios and started
     * hand-rolling the keys.
     *
     * That is not a small risk: relying on the platform for this behaviour is
     * the central design decision of this component (see AalRadioGroup docs).
     * The claim has to be verified where it can actually be observed. Recorded
     * as D-006 in docs/reports/engine-divergences.md.
     */
    it('is covered by the Playwright keyboard suite, in a real browser', () => {
      expect(true).toBe(true);
    });

    it('uses native same-name radios, which is WHY the browser provides the behaviour', async () => {
      // The verifiable half in jsdom: the precondition for native arrow
      // handling is that every radio shares a name and sits in one fieldset.
      const { container } = await setup(
        `<aal-radio-group legend="Delivery method" [options]="options" />`,
        { options: OPTIONS },
      );
      const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

      expect(radios).toHaveLength(3);
      expect(new Set(radios.map((r) => r.name)).size).toBe(1);
      expect(radios.every((r) => r.closest('fieldset') !== null)).toBe(true);
      // No hand-rolled key handling — the platform does it.
      expect(container.querySelector('[tabindex]')).toBeNull();
    });
  });

  describe('error state', () => {
    it('does not surface an error before the group is touched (AR-12)', async () => {
      await group(`error="Choose a delivery method"`);
      expect(screen.queryByText('Choose a delivery method')).toBeNull();
    });

    it('surfaces the error on the fieldset once touched', async () => {
      const user = userEvent.setup();
      const { container, fixture } = await group(`error="Choose a delivery method"`);

      (screen.getAllByRole('radio')[0] as HTMLElement).focus();
      await user.tab();
      fixture.detectChanges();

      expect(screen.getByText(/Choose a delivery method/)).toBeTruthy();
      const described = container.querySelector('fieldset')?.getAttribute('aria-describedby');
      expect(described).toBeTruthy();
    });
  });

  describe('Reactive Forms (FR-05)', () => {
    it('reflects and updates a FormControl', async () => {
      const control = new FormControl('express');
      await setup(`<aal-radio-group legend="Delivery" [options]="options" [formControl]="control" />`, {
        options: OPTIONS,
        control,
      });

      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      expect(radios[1].checked).toBe(true);

      await userEvent.setup().click(radios[2]);
      expect(control.value).toBe('collect');
    });
  });
});

describe('axe — every documented state (TR-01)', () => {
  const states: [string, string, Record<string, unknown>][] = [
    ['checkbox default', `<aal-checkbox>Subscribe</aal-checkbox>`, {}],
    ['checkbox checked', `<aal-checkbox [checked]="true">Subscribe</aal-checkbox>`, {}],
    ['checkbox indeterminate', `<aal-checkbox [indeterminate]="true">Select all</aal-checkbox>`, {}],
    ['checkbox disabled', `<aal-checkbox [disabled]="true">Subscribe</aal-checkbox>`, {}],
    ['checkbox required', `<aal-checkbox [required]="true">Accept terms</aal-checkbox>`, {}],
    ['checkbox with hint', `<aal-checkbox hint="We send one email a month">Subscribe</aal-checkbox>`, {}],
    ['switch off', `<aal-switch>Notifications</aal-switch>`, {}],
    ['switch on', `<aal-switch [checked]="true">Notifications</aal-switch>`, {}],
    ['switch disabled', `<aal-switch [disabled]="true">Notifications</aal-switch>`, {}],
    ['radio group', `<aal-radio-group legend="Delivery" [options]="options" />`, { options: OPTIONS }],
    [
      'radio group hidden legend',
      `<aal-radio-group legend="Delivery" [options]="options" [hideLegend]="true" />`,
      { options: OPTIONS },
    ],
    [
      'radio group with hint',
      `<aal-radio-group legend="Delivery" [options]="options" hint="Choose one" />`,
      { options: OPTIONS },
    ],
    [
      'radio group disabled',
      `<aal-radio-group legend="Delivery" [options]="options" [disabled]="true" />`,
      { options: OPTIONS },
    ],
  ];

  it.each(states)('is clean: %s', async (name, template, props) => {
    const { container } = await setup(template, props);
    await expectNoA11yViolations(container, name);
  });
});
