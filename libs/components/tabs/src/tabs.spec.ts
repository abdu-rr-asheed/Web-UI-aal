import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalTab, AalTabs } from './tabs';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Tabs (PRD §9.7, APG Tabs).
 *
 * Each describe block below is named after a row of the APG Tabs interaction
 * table, so the test report reads as a conformance report (PRD §11.4).
 */
@Component({
  selector: 'aal-tabs-host',
  standalone: true,
  imports: [AalTabs, AalTab],
  template: `
    <aal-tabs
      label="Account settings"
      [activation]="activation()"
      [orientation]="orientation()"
      [(selectedIndex)]="selected"
    >
      <aal-tab label="Profile">
        <p>Profile panel, containing only prose.</p>
      </aal-tab>
      <aal-tab label="Security">
        <button type="button">Change password</button>
      </aal-tab>
      <aal-tab label="Billing" [disabled]="billingDisabled()">
        <p>Billing panel.</p>
      </aal-tab>
      <aal-tab label="Sessions" [closeable]="true" (closed)="closedCount.set(closedCount() + 1)">
        <p>Sessions panel.</p>
      </aal-tab>
    </aal-tabs>
  `,
})
class TabsHost {
  readonly activation = signal<'manual' | 'automatic'>('manual');
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly billingDisabled = signal(true);
  readonly selected = signal(0);
  readonly closedCount = signal(0);
}

const setup = async () => {
  const result = await render(TabsHost, { providers: [provideAal({ assertions: 'off' })] });
  const settle = async () => {
    result.fixture.detectChanges();
    await result.fixture.whenStable();
    result.fixture.detectChanges();
  };
  await settle();
  return { ...result, settle, user: userEvent.setup() };
};

const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(name) });

describe('AalTabs', () => {
  describe('semantics (SC 4.1.2)', () => {
    it('exposes a named tablist', async () => {
      await setup();
      expect(screen.getByRole('tablist', { name: 'Account settings' })).toBeTruthy();
    });

    it('reports its orientation, so the user knows which arrows to reach for', async () => {
      const { fixture, settle } = await setup();
      expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');

      fixture.componentInstance.orientation.set('vertical');
      await settle();

      expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    });

    it('exposes one tab per aal-tab, named by its label', async () => {
      await setup();
      expect(screen.getAllByRole('tab')).toHaveLength(4);
      expect(tab('Profile')).toBeTruthy();
    });

    it('marks exactly one tab selected', async () => {
      await setup();
      const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
    });

    it('points each tab at its panel, and each panel back at its tab', async () => {
      const { container } = await setup();
      const profile = tab('Profile');
      const panelId = profile.getAttribute('aria-controls')!;
      const panel = container.querySelector(`#${panelId}`)!;

      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(profile.getAttribute('id'));
    });

    it('exposes only the SELECTED panel to assistive technology', async () => {
      // hidden removes a panel from the accessibility tree. visibility:hidden
      // and height:0 do not, which is how a screen-reader user ends up reading
      // three panels the tab list says are not selected.
      await setup();
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    });
  });

  describe('Tab — moves focus into the tab list, at the selected tab (SC 2.4.3)', () => {
    it('is a SINGLE tab stop', async () => {
      // Ten presses to cross a tab list is not a style preference: for a
      // switch-access user each activation is a deliberate physical effort.
      await setup();
      const stops = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
      expect(stops).toHaveLength(1);
    });

    it('puts the tab stop on the selected tab', async () => {
      await setup();
      expect(tab('Profile').getAttribute('tabindex')).toBe('0');
      expect(tab('Security').getAttribute('tabindex')).toBe('-1');
    });

    it('keeps a single tab stop after the selection changes', async () => {
      // Two writers touch this attribute: AalRovingItem's host binding sets the
      // -1 default, and syncTabindex() promotes one item to 0. If a re-render
      // ever re-applied the binding, the tab list would have no tab stop at
      // all and no keyboard user could enter it.
      const { user, settle } = await setup();
      await user.click(tab('Security'));
      await settle();

      const stops = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
      expect(stops, 'roving tabindex was clobbered by a re-render').toHaveLength(1);
      expect(tab('Security').getAttribute('tabindex')).toBe('0');
    });
  });

  describe('Right Arrow — moves focus to the next tab', () => {
    it('moves focus without selecting, under manual activation', async () => {
      const { user, settle } = await setup();
      tab('Profile').focus();

      await user.keyboard('{ArrowRight}');
      await settle();

      expect(document.activeElement).toBe(tab('Security'));
      expect(tab('Profile').getAttribute('aria-selected')).toBe('true');
    });

    it('SKIPS a disabled tab', async () => {
      const { user, settle } = await setup();
      tab('Security').focus();

      await user.keyboard('{ArrowRight}');
      await settle();

      // Billing is disabled, so focus lands on Sessions.
      expect(document.activeElement).toBe(tab('Sessions'));
    });
  });

  describe('Left Arrow — moves focus to the previous tab', () => {
    it('moves back', async () => {
      const { user, settle } = await setup();
      tab('Security').focus();

      await user.keyboard('{ArrowLeft}');
      await settle();

      expect(document.activeElement).toBe(tab('Profile'));
    });
  });

  describe('Home and End — first and last tab', () => {
    it('Home moves to the first tab', async () => {
      const { user, settle } = await setup();
      tab('Sessions').focus();

      await user.keyboard('{Home}');
      await settle();

      expect(document.activeElement).toBe(tab('Profile'));
    });

    it('End moves to the last tab', async () => {
      const { user, settle } = await setup();
      tab('Profile').focus();

      await user.keyboard('{End}');
      await settle();

      expect(document.activeElement).toBe(tab('Sessions'));
    });
  });

  describe('Enter and Space — activate the focused tab (manual activation)', () => {
    it('Enter selects', async () => {
      const { user, settle } = await setup();
      tab('Security').focus();

      await user.keyboard('{Enter}');
      await settle();

      expect(tab('Security').getAttribute('aria-selected')).toBe('true');
      expect(
        screen.getByRole('tabpanel').contains(screen.getByRole('button', { name: 'Change password' })),
      ).toBe(true);
    });

    it('Space selects', async () => {
      const { user, settle } = await setup();
      tab('Security').focus();

      await user.keyboard(' ');
      await settle();

      expect(tab('Security').getAttribute('aria-selected')).toBe('true');
    });

    it('a disabled tab cannot be selected', async () => {
      const { user, settle } = await setup();
      await user.click(tab('Billing'));
      await settle();

      expect(tab('Billing').getAttribute('aria-selected')).toBe('false');
      expect(tab('Profile').getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('activation mode (ADR-0008)', () => {
    it('MANUAL is the default — arrowing renders no panel the user did not ask for', async () => {
      const { user, settle } = await setup();
      tab('Profile').focus();

      await user.keyboard('{ArrowRight}{ArrowRight}');
      await settle();

      expect(tab('Profile').getAttribute('aria-selected')).toBe('true');
    });

    it('AUTOMATIC selects as focus moves, when opted in', async () => {
      const { fixture, user, settle } = await setup();
      fixture.componentInstance.activation.set('automatic');
      await settle();

      tab('Profile').focus();
      await user.keyboard('{ArrowRight}');
      await settle();

      expect(tab('Security').getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('Delete — removes a closeable tab', () => {
    it('emits closed on the tab', async () => {
      const { fixture, user, settle } = await setup();
      tab('Sessions').focus();

      await user.keyboard('{Delete}');
      await settle();

      expect(fixture.componentInstance.closedCount()).toBe(1);
    });

    it('does nothing on a tab that is not closeable', async () => {
      const { fixture, user, settle } = await setup();
      tab('Profile').focus();

      await user.keyboard('{Delete}');
      await settle();

      expect(fixture.componentInstance.closedCount()).toBe(0);
    });

    it('announces the key rather than only drawing an icon', async () => {
      // A bare ✕ tells a screen-reader user nothing about which key to press.
      await setup();
      expect(tab('Sessions').textContent).toContain('press Delete to close');
    });
  });

  describe('panel focusability (PRD §9.7)', () => {
    it('a panel with no focusable content IS a tab stop', async () => {
      // Otherwise the user tabs out of the tab list straight past the content
      // they just selected, with no way to scroll it without a mouse.
      await setup();
      expect(screen.getByRole('tabpanel').getAttribute('tabindex')).toBe('0');
    });

    it('a panel containing a control is NOT a tab stop', async () => {
      // It would be an extra press before every field, forever.
      const { user, settle } = await setup();
      await user.click(tab('Security'));
      await settle();

      expect(screen.getByRole('tabpanel').hasAttribute('tabindex')).toBe(false);
    });
  });

  describe('the tab set changing underneath the selection', () => {
    it('never leaves aria-selected true on a tab that became disabled', async () => {
      const { fixture, user, settle } = await setup();

      fixture.componentInstance.billingDisabled.set(false);
      await settle();
      await user.click(tab('Billing'));
      await settle();
      expect(tab('Billing').getAttribute('aria-selected')).toBe('true');

      fixture.componentInstance.billingDisabled.set(true);
      await settle();

      expect(tab('Billing').getAttribute('aria-selected')).toBe('false');
      const selected = screen.getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
      expect(selected, 'the tab list has no selected tab').toHaveLength(1);
    });
  });

  describe('axe (TR-01)', () => {
    it('is clean in the default state', async () => {
      const { container } = await setup();
      await expectNoA11yViolations(container, 'default');
    });

    it('is clean with a control-bearing panel selected', async () => {
      const { container, user, settle } = await setup();
      await user.click(tab('Security'));
      await settle();
      await expectNoA11yViolations(container, 'panel with a control');
    });

    it('is clean vertically', async () => {
      const { container, fixture, settle } = await setup();
      fixture.componentInstance.orientation.set('vertical');
      await settle();
      await expectNoA11yViolations(container, 'vertical');
    });

    it('is clean under automatic activation', async () => {
      const { container, fixture, settle } = await setup();
      fixture.componentInstance.activation.set('automatic');
      await settle();
      await expectNoA11yViolations(container, 'automatic');
    });
  });
});
