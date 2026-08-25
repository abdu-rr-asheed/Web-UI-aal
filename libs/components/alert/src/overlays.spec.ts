import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalAlert } from './alert';
import { AalDisclosure } from '../../disclosure/src/disclosure';
import { AalTooltip } from '../../tooltip/src/tooltip';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Alert, Disclosure and Tooltip (PRD §9.9).
 *
 * Grouped because they are the three small overlay components of Sprint 3 and
 * share a single axe sweep at the end.
 */

const setup = (template: string, props: Record<string, unknown> = {}) =>
  render(template, {
    imports: [AalAlert, AalDisclosure, AalTooltip],
    providers: [provideAal({ assertions: 'off' })],
    componentProperties: props,
  });

describe('AalAlert (SC 4.1.3)', () => {
  describe('live region', () => {
    it('renders the region even with no message', async () => {
      // The single most common live-region failure: a region added to the DOM
      // at the same moment as its text is frequently never announced, because
      // the screen reader was not yet observing the node.
      const { container } = await setup(`<aal-alert />`);
      expect(container.querySelector('[aria-live]')).not.toBeNull();
    });

    it('is polite by default', async () => {
      const { container } = await setup(`<aal-alert message="Saved" />`);
      const region = container.querySelector('[aria-live]')!;
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.getAttribute('role')).toBe('status');
    });

    it('is assertive only when asked', async () => {
      // Assertive cuts the user off mid-sentence. Correct for a failed
      // submission; wrong for almost everything else.
      const { container } = await setup(`<aal-alert message="Session expiring" [assertive]="true" />`);
      const region = container.querySelector('[aria-live]')!;
      expect(region.getAttribute('aria-live')).toBe('assertive');
      expect(region.getAttribute('role')).toBe('alert');
    });

    it('is atomic, so the whole message is re-read rather than the diff', async () => {
      const { container } = await setup(`<aal-alert message="Saved" />`);
      expect(container.querySelector('[aria-live]')?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('tone is never conveyed by colour alone (AR-13)', () => {
    it('states the tone in words for screen-reader users', async () => {
      await setup(`<aal-alert message="Could not save" tone="error" />`);
      // "Error: Could not save" — a red border says nothing to a screen reader.
      expect(screen.getByRole('status').textContent).toContain('Error');
    });

    it('hides the decorative icon from assistive technology', async () => {
      const { container } = await setup(`<aal-alert message="Saved" tone="success" />`);
      expect(container.querySelector('.aal-alert__icon')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('focus is never stolen', () => {
    it('contains nothing focusable unless dismissible', async () => {
      // SC 4.1.3 exists so a message can be announced WITHOUT taking focus.
      const { container } = await setup(`<aal-alert message="Saved" />`);
      expect(container.querySelectorAll('button, [tabindex]')).toHaveLength(0);
    });

    it('gives the dismiss button an accessible name, since it is icon-only', async () => {
      await setup(`<aal-alert message="Saved" [dismissible]="true" />`);
      expect(screen.getByRole('button', { name: 'Dismiss message' })).toBeTruthy();
    });
  });
});

describe('AalDisclosure (APG Disclosure)', () => {
  const disclosure = (extra = '') =>
    setup(`<aal-disclosure summary="Delivery options" ${extra}><p>Panel content</p></aal-disclosure>`);

  it('uses a real button, not a div or a dead link', async () => {
    await disclosure();
    expect(screen.getByRole('button', { name: /Delivery options/ })).toBeTruthy();
  });

  it('reports aria-expanded on the TRIGGER, not the panel', async () => {
    // On the panel it is announced only after the user has found their way in
    // — by which point they already know.
    await disclosure();
    expect(screen.getByRole('button', { name: /Delivery options/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('REMOVES the panel from the DOM when collapsed', async () => {
    // visibility:hidden and height:0 both leave content in the accessibility
    // tree, so a screen-reader user reads a panel the button calls collapsed.
    await disclosure();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('expands on click and points aria-controls at the real panel', async () => {
    const user = userEvent.setup();
    const { container } = await disclosure();
    const trigger = screen.getByRole('button', { name: /Delivery options/ });

    await user.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const panelId = trigger.getAttribute('aria-controls')!;
    expect(container.querySelector(`#${panelId}`)).not.toBeNull();
  });

  it('names the panel region after its trigger', async () => {
    const user = userEvent.setup();
    await disclosure();
    await user.click(screen.getByRole('button', { name: /Delivery options/ }));

    expect(screen.getByRole('region', { name: /Delivery options/ })).toBeTruthy();
  });

  it('toggles on Enter and Space, via the native button', async () => {
    const user = userEvent.setup();
    await disclosure();
    const trigger = screen.getByRole('button', { name: /Delivery options/ });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard(' ');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not toggle when disabled', async () => {
    const user = userEvent.setup();
    await disclosure('[disabled]="true"');
    const trigger = screen.getByRole('button', { name: /Delivery options/ });

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('AalTooltip (SC 1.4.13)', () => {
  const tooltip = () =>
    setup(`<aal-tooltip text="Saves without closing"><button type="button">Save</button></aal-tooltip>`);

  it('is hidden until hover or focus', async () => {
    await tooltip();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows on FOCUS, not only hover', async () => {
    // A keyboard user who cannot hover would otherwise never see it.
    const { fixture } = await tooltip();
    screen.getByRole('button', { name: 'Save' }).focus();
    fixture.detectChanges();

    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('describes the trigger rather than naming it', async () => {
    // A control whose only name lives in a tooltip has no name for a touch
    // user at all.
    const { fixture } = await tooltip();
    const trigger = screen.getByRole('button', { name: 'Save' });
    trigger.focus();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-describedby')).toContain(
      screen.getByRole('tooltip').id,
    );
    expect(trigger.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('is DISMISSIBLE with Escape, without moving focus', async () => {
    const user = userEvent.setup();
    const { fixture } = await tooltip();
    const trigger = screen.getByRole('button', { name: 'Save' });

    trigger.focus();
    fixture.detectChanges();
    expect(screen.getByRole('tooltip')).toBeTruthy();

    await user.keyboard('{Escape}');
    fixture.detectChanges();

    expect(screen.queryByRole('tooltip')).toBeNull();
    // Focus must NOT move — the user was mid-task.
    expect(document.activeElement).toBe(trigger);
  });

  it('does not render when disabled', async () => {
    const { fixture } = await setup(
      `<aal-tooltip text="Hidden" [disabled]="true"><button type="button">Save</button></aal-tooltip>`,
    );
    screen.getByRole('button', { name: 'Save' }).focus();
    fixture.detectChanges();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('axe — every documented state (TR-01)', () => {
  const states: [string, string][] = [
    ['alert empty', `<aal-alert />`],
    ['alert info', `<aal-alert message="Your changes are saved" />`],
    ['alert success', `<aal-alert message="Order placed" tone="success" />`],
    ['alert warning', `<aal-alert message="Stock is low" tone="warning" />`],
    ['alert error', `<aal-alert message="Could not save" tone="error" [assertive]="true" />`],
    ['alert with heading', `<aal-alert heading="Saved" message="All changes stored" />`],
    ['alert dismissible', `<aal-alert message="Saved" [dismissible]="true" />`],
    ['disclosure collapsed', `<aal-disclosure summary="More"><p>Body</p></aal-disclosure>`],
    [
      'disclosure expanded',
      `<aal-disclosure summary="More" [expanded]="true"><p>Body</p></aal-disclosure>`,
    ],
    [
      'disclosure disabled',
      `<aal-disclosure summary="More" [disabled]="true"><p>Body</p></aal-disclosure>`,
    ],
    [
      'tooltip hidden',
      `<aal-tooltip text="Detail"><button type="button">Save</button></aal-tooltip>`,
    ],
  ];

  it.each(states)('is clean: %s', async (name, template) => {
    const { container } = await setup(template);
    await expectNoA11yViolations(container, name);
  });

  it('is clean with the tooltip visible', async () => {
    const { container, fixture } = await setup(
      `<aal-tooltip text="Saves without closing"><button type="button">Save</button></aal-tooltip>`,
    );
    screen.getByRole('button', { name: 'Save' }).focus();
    fixture.detectChanges();

    await expectNoA11yViolations(container, 'tooltip visible');
  });
});
