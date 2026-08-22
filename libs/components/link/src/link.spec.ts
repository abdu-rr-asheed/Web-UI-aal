import { ErrorHandler } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { provideAal } from '@aal/a11y-core';
import { AalLink } from './link';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Link (PRD §9.9).
 *
 * A link navigates; a button acts. Screen-reader users pull up a list of
 * links to navigate by, so a control that does not change the URL has no
 * business being in that list.
 */

const setup = (template: string, assertions: 'throw' | 'off' = 'off') =>
  render(template, { imports: [AalLink], providers: [provideAal({ assertions })] });

const withErrors = async (template: string) => {
  const errors: unknown[] = [];
  await render(template, {
    imports: [AalLink],
    providers: [
      provideAal({ assertions: 'throw' }),
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  return errors.map(String);
};

describe('AalLink', () => {
  describe('semantics (SC 4.1.2)', () => {
    it('renders a native anchor with an href', async () => {
      await setup(`<aal-link href="/reports">Reports</aal-link>`);
      const link = screen.getByRole('link', { name: 'Reports' });
      expect(link.getAttribute('href')).toBe('/reports');
    });

    it('exposes the link role, so it appears in a screen reader’s link list', async () => {
      await setup(`<aal-link href="/a">Annual report</aal-link>`);
      expect(screen.getByRole('link', { name: 'Annual report' })).toBeTruthy();
    });
  });

  describe('underline (SC 1.4.1 — not colour alone)', () => {
    it('is underlined by default', async () => {
      const { container } = await setup(`<aal-link href="/a">Reports</aal-link>`);
      expect(container.querySelector('a')?.classList.contains('aal-link--no-underline')).toBe(false);
    });

    it('can opt out, which is a design decision rather than a preference', async () => {
      const { container } = await setup(`<aal-link href="/a" [underline]="false">Reports</aal-link>`);
      expect(container.querySelector('a')?.classList.contains('aal-link--no-underline')).toBe(true);
    });
  });

  describe('current page (AR-16)', () => {
    it('omits aria-current by default', async () => {
      await setup(`<aal-link href="/a">Home</aal-link>`);
      expect(screen.getByRole('link', { name: 'Home' }).hasAttribute('aria-current')).toBe(false);
    });

    it('exposes aria-current="page" when marked current', async () => {
      await setup(`<aal-link href="/a" current="page">Home</aal-link>`);
      expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
    });
  });

  describe('new tab (SC 3.2.5)', () => {
    it('warns in the accessible name, not only visually', async () => {
      // Opening a new tab unannounced disorients screen-reader users and
      // breaks Back for everyone. The warning has to be part of the NAME so it
      // is announced with the link rather than discovered afterwards.
      await setup(`<aal-link href="https://example.org" newTab>Guidance</aal-link>`);
      expect(screen.getByRole('link', { name: /Guidance.*opens in a new tab/i })).toBeTruthy();
    });

    it('hides the decorative icon from assistive technology', async () => {
      const { container } = await setup(`<aal-link href="https://example.org" newTab>Guidance</aal-link>`);
      expect(container.querySelector('.aal-link__external-icon')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('hardens rel automatically, so a consumer cannot forget', async () => {
      await setup(`<aal-link href="https://example.org" newTab>Guidance</aal-link>`);
      const link = screen.getByRole('link', { name: /Guidance/ });
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    });

    it('sets no target or rel for a same-tab link', async () => {
      await setup(`<aal-link href="/a">Reports</aal-link>`);
      const link = screen.getByRole('link', { name: 'Reports' });
      expect(link.hasAttribute('target')).toBe(false);
      expect(link.hasAttribute('rel')).toBe(false);
    });

    it('allows the warning text to be localised', async () => {
      await setup(
        `<aal-link href="https://example.org" newTab newTabHint="(agorir mewn tab newydd)">Canllawiau</aal-link>`,
      );
      expect(screen.getByRole('link', { name: /agorir mewn tab newydd/ })).toBeTruthy();
    });
  });

  describe('link purpose (SC 2.4.4)', () => {
    it('reports vague link text in dev mode', async () => {
      // A screen reader's link list is presented OUT of context. Fifteen
      // entries reading "read more" give the user no way to choose.
      const errors = await withErrors(`<aal-link href="/a">click here</aal-link>`);
      expect(errors.join()).toMatch(/SC 2\.4\.4/);
      expect(errors.join()).toMatch(/out of context/);
    });

    it('accepts descriptive link text', async () => {
      expect(await withErrors(`<aal-link href="/a">Read the 2026 accessibility report</aal-link>`)).toEqual([]);
    });

    it('reports a link with no accessible name at all', async () => {
      const errors = await withErrors(`<aal-link href="/a"><span aria-hidden="true">→</span></aal-link>`);
      expect(errors.join()).toMatch(/no accessible name/);
    });
  });

  describe('axe — every documented state (TR-01)', () => {
    const states: [string, string][] = [
      ['default', `<aal-link href="/a">Annual report</aal-link>`],
      ['subtle', `<aal-link href="/a" variant="subtle">Annual report</aal-link>`],
      ['no underline', `<aal-link href="/a" [underline]="false">Annual report</aal-link>`],
      ['current page', `<aal-link href="/a" current="page">Annual report</aal-link>`],
      ['new tab', `<aal-link href="https://example.org" newTab>Guidance</aal-link>`],
      ['download', `<aal-link href="/a.pdf" download="report.pdf">Download the report</aal-link>`],
    ];

    it.each(states)('is clean in the %s state', async (name, template) => {
      const { container } = await setup(template);
      await expectNoA11yViolations(container, name);
    });
  });
});
