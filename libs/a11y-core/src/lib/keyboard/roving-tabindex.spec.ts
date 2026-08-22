import { Component, signal } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AalRovingItem, AalRovingTabindex } from './roving-tabindex.directive';

/**
 * Roving tabindex (AR-04 / SC 2.4.3).
 *
 * Composite widgets must be ONE tab stop. Ten tabs to cross a tab list is not
 * a style preference — for a switch-access user, where every activation is a
 * deliberate physical effort, it is the difference between usable and not.
 *
 * Describe blocks are named after the APG interaction-table rows they verify
 * (PRD §11.4), so the report reads as a conformance document.
 */

@Component({
  selector: 'aal-roving-host',
  standalone: true,
  imports: [AalRovingTabindex, AalRovingItem],
  template: `
    <button type="button">before</button>
    <div
      role="toolbar"
      aria-label="Formatting"
      [aalRovingTabindex]="'[aalRovingItem]'"
      [orientation]="orientation()"
      [wrap]="wrap()"
    >
      @for (item of items(); track item) {
        <button type="button" aalRovingItem [disabled]="item === 'Disabled'">{{ item }}</button>
      }
    </div>
    <button type="button">after</button>
  `,
})
class RovingHost {
  readonly items = signal(['Bold', 'Italic', 'Underline']);
  readonly orientation = signal<'horizontal' | 'vertical' | 'both'>('horizontal');
  readonly wrap = signal(true);
}

const setup = async (opts: { rtl?: boolean } = {}) => {
  const result = await render(RovingHost, {
    providers: opts.rtl
      ? [{ provide: Directionality, useValue: { value: 'rtl', change: { subscribe: () => undefined } } }]
      : [],
  });
  const directive = result.fixture.debugElement
    .query((n) => n.name === 'div')
    .injector.get(AalRovingTabindex);
  directive.syncTabindex();
  result.fixture.detectChanges();
  return { ...result, directive, user: userEvent.setup() };
};

const item = (name: string) => screen.getByRole('button', { name });

describe('AalRovingTabindex', () => {
  describe('Tab — moves focus into the widget, then out of it (single tab stop)', () => {
    it('exposes exactly one tabbable item', async () => {
      await setup();
      const tabbable = ['Bold', 'Italic', 'Underline'].filter(
        (n) => item(n).getAttribute('tabindex') === '0',
      );
      expect(tabbable).toEqual(['Bold']);
    });

    it('gives every other item tabindex="-1"', async () => {
      await setup();
      expect(item('Italic').getAttribute('tabindex')).toBe('-1');
      expect(item('Underline').getAttribute('tabindex')).toBe('-1');
    });

    it('Tab leaves the widget entirely rather than stepping through it', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }));
    });
  });

  describe('Right Arrow — moves focus to the next item', () => {
    it('advances and moves DOM focus', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(item('Italic'));
    });

    it('moves tabindex="0" with the focus, so re-entering resumes where the user left off', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.keyboard('{ArrowRight}');
      expect(item('Italic').getAttribute('tabindex')).toBe('0');
      expect(item('Bold').getAttribute('tabindex')).toBe('-1');
    });

    it('wraps from the last item to the first', async () => {
      const { user } = await setup();
      item('Underline').focus();
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(item('Bold'));
    });
  });

  describe('Left Arrow — moves focus to the previous item', () => {
    it('retreats', async () => {
      const { user } = await setup();
      item('Italic').focus();
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(item('Bold'));
    });

    it('wraps from the first item to the last', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(item('Underline'));
    });
  });

  describe('Home / End — moves focus to the first / last item', () => {
    it('Home jumps to the first', async () => {
      const { user } = await setup();
      item('Underline').focus();
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(item('Bold'));
    });

    it('End jumps to the last', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.keyboard('{End}');
      expect(document.activeElement).toBe(item('Underline'));
    });
  });

  describe('orientation', () => {
    it('ignores vertical arrows when horizontal', async () => {
      const { user } = await setup();
      item('Bold').focus();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(item('Bold'));
    });

    it('responds to vertical arrows when vertical', async () => {
      const { fixture, user } = await setup();
      fixture.componentInstance.orientation.set('vertical');
      fixture.detectChanges();

      item('Bold').focus();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(item('Italic'));
    });

    it('responds to both axes when set to both', async () => {
      const { fixture, user } = await setup();
      fixture.componentInstance.orientation.set('both');
      fixture.detectChanges();

      item('Bold').focus();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(item('Italic'));
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(item('Underline'));
    });
  });

  describe('RTL (FR-13)', () => {
    it('inverts the horizontal arrows, because "next" is to the left', async () => {
      // The most common RTL accessibility bug, and invisible to any LTR test.
      const { user } = await setup({ rtl: true });
      item('Italic').focus();
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(item('Underline'));
    });

    it('does NOT invert the vertical arrows', async () => {
      const { fixture, user } = await setup({ rtl: true });
      fixture.componentInstance.orientation.set('vertical');
      fixture.detectChanges();

      item('Bold').focus();
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(item('Italic'));
    });
  });

  describe('disabled items', () => {
    it('are skipped, per APG', async () => {
      const { fixture, directive, user } = await setup();
      fixture.componentInstance.items.set(['Bold', 'Disabled', 'Underline']);
      fixture.detectChanges();
      directive.syncTabindex();

      item('Bold').focus();
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(item('Underline'));
    });
  });

  describe('wrap: false', () => {
    it('clamps at the last item instead of wrapping', async () => {
      const { fixture, user } = await setup();
      fixture.componentInstance.wrap.set(false);
      fixture.detectChanges();

      item('Underline').focus();
      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(item('Underline'));
    });
  });

  describe('focus arriving by click', () => {
    it('resyncs the active index, so the next arrow press does not jump from a stale position', async () => {
      const { user } = await setup();
      await user.click(item('Underline'));
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(item('Italic'));
    });
  });
});
