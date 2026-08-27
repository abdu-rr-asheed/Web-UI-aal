import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalSkipLink } from './skip-link';
import { AalVisuallyHidden } from '../../visually-hidden/src/visually-hidden';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Skip link — SC 2.4.1 Bypass Blocks (PRD §9.9).
 *
 * Reaching main content past a 30-item nav costs 30 key presses on every page
 * without one. For a switch-access user, where each activation is a deliberate
 * physical effort, that is the difference between a usable site and an
 * unusable one.
 */

@Component({
  selector: 'aal-skip-host',
  standalone: true,
  imports: [AalSkipLink],
  template: `
    <aal-skip-link targetId="main" />
    <nav aria-label="Primary">
      <a href="/one">One</a>
      <a href="/two">Two</a>
    </nav>
    <main id="main">
      <h1>Content</h1>
    </main>
  `,
})
class SkipHost {}

const setup = () =>
  render(SkipHost, { providers: [provideAal({ assertions: 'off' })] });

describe('AalSkipLink', () => {
  describe('structure (SC 2.4.1)', () => {
    it('renders a real anchor pointing at the target fragment', async () => {
      await setup();
      const link = screen.getByRole('link', { name: 'Skip to main content' });
      expect(link.getAttribute('href')).toBe('#main');
    });

    it('is the FIRST focusable element in the document', async () => {
      // A skip link placed third is a skip link that skips nothing.
      const { container } = await setup();
      const focusables = container.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      );
      expect(focusables[0].textContent?.trim()).toBe('Skip to main content');
    });

    it('is reachable on the very first Tab', async () => {
      const user = userEvent.setup();
      await setup();

      /**
       * The precondition, asserted rather than assumed: "the FIRST Tab" only
       * means anything if focus starts at the document body.
       *
       * This test failed on CI (Ubuntu) on three pushes between 22 and 27
       * August with `activeElement` reported as `<body>` AFTER the Tab — i.e.
       * focus never moved — while passing on Windows every time. It passes on
       * CI again now, and the cause was never established; the likely
       * candidates are focus leaking from an earlier test in the same worker,
       * or a different file distribution across CI's smaller worker pool.
       *
       * Rather than guess at a fix for something that currently passes, the
       * two possibilities are separated: if this first assertion fails, focus
       * leaked in from elsewhere; if it passes and the next one fails, the
       * link genuinely was not tabbable. The next CI failure will say which.
       */
      expect(document.activeElement, 'focus did not start at the document body').toBe(document.body);

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to main content' }));
    });

    it('accepts projected content in place of the default label', async () => {
      await render(`<aal-skip-link targetId="main">Skip navigation</aal-skip-link><main id="main"></main>`, {
        imports: [AalSkipLink],
        providers: [provideAal({ assertions: 'off' })],
      });
      expect(screen.getByRole('link', { name: 'Skip navigation' })).toBeTruthy();
    });
  });

  describe('activation actually MOVES FOCUS, not just the viewport', () => {
    it('moves focus to the target', async () => {
      // The classic broken implementation: href="#main" scrolls, but focus
      // stays on the link, so the next Tab lands on the second nav item and
      // the user has skipped nothing.
      const user = userEvent.setup();
      const { container } = await setup();

      await user.click(screen.getByRole('link', { name: 'Skip to main content' }));

      expect(document.activeElement).toBe(container.querySelector('#main'));
    });

    it('makes the target programmatically focusable without adding a tab stop', async () => {
      // <main> is not focusable by default, so .focus() would silently do
      // nothing. tabindex="-1" fixes that without putting it in the tab order.
      const user = userEvent.setup();
      const { container } = await setup();

      await user.click(screen.getByRole('link', { name: 'Skip to main content' }));

      expect(container.querySelector('#main')?.getAttribute('tabindex')).toBe('-1');
    });

    it('continues past the navigation on the next Tab', async () => {
      const user = userEvent.setup();
      await setup();

      await user.tab();
      await user.keyboard('{Enter}');

      // Focus is now on <main>; the nav links are behind us.
      expect((document.activeElement as HTMLElement).id).toBe('main');
    });
  });

  describe('missing target', () => {
    it('reports a dev-mode error rather than failing silently', async () => {
      const errors: string[] = [];
      await render(`<aal-skip-link targetId="does-not-exist" />`, {
        imports: [AalSkipLink],
        providers: [provideAal({ assertions: 'warn' })],
      });
      const spy = vi.spyOn(console, 'error').mockImplementation((m) => errors.push(String(m)));

      await userEvent.setup().click(screen.getByRole('link', { name: 'Skip to main content' }));

      expect(errors.join()).toMatch(/does not exist/);
      spy.mockRestore();
    });
  });

  describe('axe (TR-01)', () => {
    it('is clean unfocused', async () => {
      const { container } = await setup();
      await expectNoA11yViolations(container, 'unfocused');
    });

    it('is clean focused', async () => {
      const { container } = await setup();
      screen.getByRole('link', { name: 'Skip to main content' }).focus();
      await expectNoA11yViolations(container, 'focused');
    });
  });
});

describe('AalVisuallyHidden', () => {
  const hidden = (extra = '') =>
    render(`<span aalVisuallyHidden ${extra}>Search</span>`, { imports: [AalVisuallyHidden] });

  it('stays in the accessibility tree — never display:none', async () => {
    // display:none would remove it from the tree entirely, hiding the text
    // from exactly the users it was written for.
    const { container } = await hidden();
    const el = container.querySelector('span')!;
    expect(el.style.display).not.toBe('none');
    expect(el.style.visibility).not.toBe('hidden');
    expect(el.textContent).toBe('Search');
  });

  it('clips to 1px rather than 0, because some screen readers skip zero-area elements', async () => {
    const { container } = await hidden();
    const el = container.querySelector('span')!;
    expect(el.style.width).toBe('1px');
    expect(el.style.height).toBe('1px');
    expect(el.style.clipPath).toBe('inset(50%)');
  });

  it('prevents the 1px box wrapping text into a vertical column', async () => {
    const { container } = await hidden();
    expect(container.querySelector('span')!.style.whiteSpace).toBe('nowrap');
  });

  it('stays hidden on focus by default', async () => {
    const { container } = await hidden();
    const el = container.querySelector('span')!;
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(el.style.position).toBe('absolute');
  });

  it('reveals on focus in the focusable variant (SC 2.4.7)', async () => {
    // A control a sighted keyboard user can reach but cannot see is a focus
    // visibility failure.
    const { container, fixture } = await hidden('aalVisuallyHiddenFocusable');
    const el = container.querySelector('span')!;

    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();

    expect(el.style.position).toBe('');
    expect(el.style.clipPath).toBe('');
  });

  it('re-hides on blur', async () => {
    const { container, fixture } = await hidden('aalVisuallyHiddenFocusable');
    const el = container.querySelector('span')!;

    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();

    expect(el.style.position).toBe('absolute');
  });
});
