import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations, runAxe, accessibleName } from '../../../../testing/a11y';

/**
 * Proves the accessibility test harness itself works (PRD TR-01).
 *
 * The point is the same one made for the lint gate: a harness that reports
 * nothing is indistinguishable from a harness that finds nothing, and the
 * second is worthless as evidence. Before any real component depends on
 * `expectNoA11yViolations`, it has to be shown to FAIL on something broken.
 *
 * Deleted or weakened axe wiring will break these tests rather than silently
 * turning every future component test green.
 */

@Component({
  selector: 'aal-fixture-accessible',
  standalone: true,
  template: `
    <main>
      <h1>Accessible fixture</h1>
      <button type="button" (click)="clicks = clicks + 1">Save changes</button>
      <label for="email">Email address</label>
      <input id="email" type="email" autocomplete="email" />
      <img src="chart.png" alt="Revenue rose 12% in Q3" />
    </main>
  `,
})
class AccessibleFixture {
  clicks = 0;
}

@Component({
  selector: 'aal-fixture-broken',
  standalone: true,
  template: `
    <main>
      <!--
        These defects are the POINT of this fixture — the harness has to fail on
        them, and a harness never proved to fail is not evidence of anything.
        Disabled locally so the lint gate does not reject the very input used to
        prove the axe gate works. Scoped to these two lines only.
      -->
      <!-- eslint-disable @angular-eslint/template/alt-text -->
      <img src="chart.png" />
      <!-- eslint-enable @angular-eslint/template/alt-text -->
      <input type="email" />
    </main>
  `,
})
class BrokenFixture {}

describe('a11y harness', () => {
  describe('axe integration', () => {
    it('passes a genuinely accessible fixture', async () => {
      const { container } = await render(AccessibleFixture);
      await expectNoA11yViolations(container, 'accessible fixture');
    });

    it('FAILS a fixture with a missing alt and an unlabelled input', async () => {
      const { container } = await render(BrokenFixture);
      await expect(expectNoA11yViolations(container, 'broken fixture')).rejects.toThrow(
        /blocking violation/,
      );
    });

    it('names the offending rules, so a failure is actionable', async () => {
      const { container } = await render(BrokenFixture);
      const results = await runAxe(container);
      const ids = results.violations.map((v) => v.id);
      expect(ids).toContain('image-alt');
      expect(ids).toContain('label');
    });

    it('includes the state label in the failure, since TR-01 covers every state', async () => {
      const { container } = await render(BrokenFixture);
      await expect(expectNoA11yViolations(container, 'open, with description')).rejects.toThrow(
        /open, with description/,
      );
    });

    it('runs the WCAG 2.2 AA rule set, not just the axe defaults', async () => {
      const { container } = await render(AccessibleFixture);
      const results = await runAxe(container);
      // If the tag filter were dropped, wcag22aa rules would not appear at all.
      const tags = new Set(results.passes.flatMap((p) => p.tags));
      expect(tags.has('wcag2a')).toBe(true);
      expect([...tags].some((t) => t.startsWith('wcag2'))).toBe(true);
    });
  });

  describe('jest-axe matcher registration', () => {
    it('registers toHaveNoViolations on Vitest expect', async () => {
      const { container } = await render(AccessibleFixture);
      const results = await runAxe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Testing Library conventions (PRD §11.4)', () => {
    it('finds controls by role and accessible name, the way a screen reader does', async () => {
      await render(AccessibleFixture);
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeTruthy();
      expect(screen.getByRole('img', { name: /Revenue rose 12%/ })).toBeTruthy();
    });

    it('drives real key sequences through user-event, not synthetic events', async () => {
      const user = userEvent.setup();
      const { fixture } = await render(AccessibleFixture);

      await user.tab();
      const button = screen.getByRole('button', { name: 'Save changes' });
      expect(document.activeElement).toBe(button);

      // Enter and Space must both activate a native button.
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(fixture.componentInstance.clicks).toBe(2);
    });
  });

  describe('accessibleName()', () => {
    it('prefers aria-labelledby over aria-label', async () => {
      const { container } = await render(
        `<span id="t">From heading</span><button aria-labelledby="t" aria-label="From label">x</button>`,
      );
      expect(accessibleName(container.querySelector('button')!)).toBe('From heading');
    });

    it('falls back to aria-label, then to content', async () => {
      const { container } = await render(
        `<button aria-label="Close dialog">x</button><button>Content name</button>`,
      );
      const [labelled, content] = [...container.querySelectorAll('button')];
      expect(accessibleName(labelled)).toBe('Close dialog');
      expect(accessibleName(content)).toBe('Content name');
    });

    it('resolves an input name from its associated label element', async () => {
      const { container } = await render(`<label for="a">Full name</label><input id="a" />`);
      expect(accessibleName(container.querySelector('input')!)).toBe('Full name');
    });
  });
});
