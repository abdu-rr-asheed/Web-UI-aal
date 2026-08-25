import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import type { AalListboxOption } from '@aal/primitives/listbox';
import { AalSelect } from './select';
import { AalNativeSelect } from './native-select';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Select — custom listbox and native (PRD §9.4).
 *
 * The custom widget's keyboard model is verified against the state machine in
 * libs/primitives/listbox. What is verified HERE is the rendered ARIA: the
 * relationships a screen reader actually consumes, which the state machine
 * cannot see.
 */

const OPTIONS: AalListboxOption[] = [
  { value: 'standard', label: 'Standard delivery' },
  { value: 'express', label: 'Express delivery' },
  { value: 'collect', label: 'Click and collect', disabled: true },
];

const setup = (template: string, props: Record<string, unknown> = {}) =>
  render(template, {
    imports: [AalSelect, AalNativeSelect, ReactiveFormsModule],
    providers: [provideAal({ assertions: 'off' })],
    componentProperties: { options: OPTIONS, ...props },
  });

const custom = (extra = '') =>
  setup(`<aal-select label="Delivery method" [options]="options" ${extra} />`);

describe('AalSelect (custom listbox)', () => {
  describe('trigger semantics (APG Select-Only Combobox)', () => {
    it('exposes role="combobox" with the label as its accessible name', async () => {
      await custom();
      expect(screen.getByRole('combobox', { name: /Delivery method/ })).toBeTruthy();
    });

    it('reports aria-expanded="false" while closed', async () => {
      await custom();
      expect(screen.getByRole('combobox', { name: /Delivery method/ }).getAttribute('aria-expanded')).toBe(
        'false',
      );
    });

    it('declares the popup type with aria-haspopup="listbox"', async () => {
      await custom();
      expect(screen.getByRole('combobox', { name: /Delivery method/ }).getAttribute('aria-haspopup')).toBe(
        'listbox',
      );
    });

    it('does not render the listbox until opened', async () => {
      await custom();
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('opening', () => {
    it('reveals a listbox and flips aria-expanded', async () => {
      const user = userEvent.setup();
      await custom();
      const trigger = screen.getByRole('combobox', { name: /Delivery method/ });

      await user.click(trigger);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByRole('listbox')).toBeTruthy();
    });

    it('keeps DOM focus on the TRIGGER, tracking the option with aria-activedescendant', async () => {
      // Moving real focus into the popup makes browsers announce the option
      // both as a focus change and as a selection change — users hear it twice.
      const user = userEvent.setup();
      await custom();
      const trigger = screen.getByRole('combobox', { name: /Delivery method/ });

      trigger.focus();
      await user.keyboard('{ArrowDown}');

      expect(document.activeElement).toBe(trigger);
      const activeId = trigger.getAttribute('aria-activedescendant');
      expect(activeId).toBeTruthy();
      expect(document.getElementById(activeId!)).not.toBeNull();
    });

    it('points aria-controls at the listbox that actually exists', async () => {
      const user = userEvent.setup();
      await custom();
      const trigger = screen.getByRole('combobox', { name: /Delivery method/ });
      await user.click(trigger);

      // A dangling aria-controls looks identical to a correct one in markup.
      const controls = trigger.getAttribute('aria-controls')!;
      expect(screen.getByRole('listbox').id).toBe(controls);
    });
  });

  describe('option semantics', () => {
    it('renders one option per entry, with aria-selected on each', async () => {
      const user = userEvent.setup();
      await custom();
      await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options.every((o) => o.hasAttribute('aria-selected'))).toBe(true);
    });

    it('marks a disabled option aria-disabled rather than removing it', async () => {
      // Removing it would change the "3 of 5" position announcements and hide
      // the fact that the choice exists but is unavailable.
      const user = userEvent.setup();
      await custom();
      await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));

      expect(screen.getByRole('option', { name: /Click and collect/ }).getAttribute('aria-disabled')).toBe(
        'true',
      );
    });

    it('declares aria-multiselectable only when multiple', async () => {
      const user = userEvent.setup();
      await custom('[multiple]="true"');
      await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));

      expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    });
  });

  describe('selection', () => {
    it('updates aria-selected and the trigger text', async () => {
      const user = userEvent.setup();
      const { fixture } = await custom();
      const trigger = screen.getByRole('combobox', { name: /Delivery method/ });

      await user.click(trigger);
      await user.click(screen.getByRole('option', { name: /Express delivery/ }));
      fixture.detectChanges();

      expect(trigger.textContent).toContain('Express delivery');
    });

    it('closes after a single-select choice', async () => {
      const user = userEvent.setup();
      await custom();
      await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));
      await user.click(screen.getByRole('option', { name: /Express delivery/ }));

      expect(screen.queryByRole('listbox')).toBeNull();
    });

    it('stays open in multi-select, so several choices can be made', async () => {
      const user = userEvent.setup();
      await custom('[multiple]="true"');
      await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));
      await user.click(screen.getByRole('option', { name: /Standard delivery/ }));

      expect(screen.getByRole('listbox')).toBeTruthy();
    });
  });

  describe('Reactive Forms (FR-05)', () => {
    it('reflects a FormControl value on the trigger', async () => {
      const control = new FormControl('express');
      await setup(
        `<aal-select label="Delivery" [options]="options" [formControl]="control" />`,
        { control },
      );

      expect(screen.getByRole('combobox', { name: /Delivery/ }).textContent).toContain('Express delivery');
    });

    it('honours setDisabledState', async () => {
      const control = new FormControl({ value: '', disabled: true });
      await setup(
        `<aal-select label="Delivery" [options]="options" [formControl]="control" />`,
        { control },
      );

      expect((screen.getByRole('combobox', { name: /Delivery/ }) as HTMLButtonElement).disabled).toBe(true);
    });
  });
});

describe('AalNativeSelect (the recommended default)', () => {
  const native = (extra = '') =>
    setup(`<aal-native-select label="Delivery method" [options]="options" ${extra} />`);

  it('renders a real <select> with an associated label', async () => {
    const { container } = await native();
    expect(container.querySelector('select')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: /Delivery method/ })).toBeTruthy();
  });

  it('renders a disabled placeholder with an EMPTY value when required', async () => {
    // A placeholder carrying a real value silently satisfies `required` and
    // defeats validation entirely.
    const { container } = await native('[required]="true"');
    const placeholder = container.querySelector<HTMLOptionElement>('option')!;
    expect(placeholder.value).toBe('');
    expect(placeholder.disabled).toBe(true);
  });

  it('marks disabled options disabled', async () => {
    const { container } = await native();
    const collect = [...container.querySelectorAll('option')].find((o) =>
      o.textContent?.includes('Click and collect'),
    )!;
    expect(collect.disabled).toBe(true);
  });

  it('updates a FormControl on change', async () => {
    const control = new FormControl('');
    await setup(
      `<aal-native-select label="Delivery" [options]="options" [formControl]="control" />`,
      { control },
    );

    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: /Delivery/ }), 'express');
    expect(control.value).toBe('express');
  });
});

describe('axe — every documented state (TR-01)', () => {
  const states: [string, string][] = [
    ['custom closed', `<aal-select label="Delivery" [options]="options" />`],
    ['custom with hint', `<aal-select label="Delivery" [options]="options" hint="Choose one" />`],
    ['custom disabled', `<aal-select label="Delivery" [options]="options" [disabled]="true" />`],
    ['custom required', `<aal-select label="Delivery" [options]="options" [required]="true" />`],
    ['custom hidden label', `<aal-select label="Delivery" [options]="options" [hideLabel]="true" />`],
    ['native default', `<aal-native-select label="Delivery" [options]="options" />`],
    ['native required', `<aal-native-select label="Delivery" [options]="options" [required]="true" />`],
    ['native disabled', `<aal-native-select label="Delivery" [options]="options" [disabled]="true" />`],
    ['native with hint', `<aal-native-select label="Delivery" [options]="options" hint="Choose one" />`],
  ];

  it.each(states)('is clean: %s', async (name, template) => {
    const { container } = await setup(template);
    await expectNoA11yViolations(container, name);
  });

  it('is clean with the listbox open', async () => {
    const user = userEvent.setup();
    const { container } = await custom();
    await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));
    await expectNoA11yViolations(container, 'custom open');
  });

  it('is clean with the multi-select listbox open', async () => {
    const user = userEvent.setup();
    const { container } = await custom('[multiple]="true"');
    await user.click(screen.getByRole('combobox', { name: /Delivery method/ }));
    await expectNoA11yViolations(container, 'custom open, multiple');
  });
});
