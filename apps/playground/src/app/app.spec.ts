import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

/**
 * Shell accessibility structure (PRD AR-24).
 *
 * The playground app is an audit target — Lighthouse and Playwright run against it
 * (TR-06, NFR-13) — so its landmark and heading structure is a requirement,
 * not incidental markup. These assertions locate elements the way a screen
 * reader does (CLAUDE.md test conventions): by role and accessible name.
 */
describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('creates the app', async () => {
    expect(await render()).toBeTruthy();
  });

  describe('AR-24 — landmark and heading structure', () => {
    it('exposes a main landmark', async () => {
      expect((await render()).querySelector('main')).not.toBeNull();
    });

    it('exposes a navigation landmark with a unique accessible name', async () => {
      const nav = (await render()).querySelector('nav');
      expect(nav).not.toBeNull();
      expect(nav?.getAttribute('aria-label')).toBe('Primary');
    });

    it('has exactly one h1', async () => {
      expect((await render()).querySelectorAll('h1')).toHaveLength(1);
    });

    it('does not skip heading levels', async () => {
      const levels = [...(await render()).querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) =>
        Number(h.tagName[1]),
      );
      levels.forEach((level, i) => {
        if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('SC 2.4.1 — bypass blocks', () => {
    it('renders a skip link as the first focusable element', async () => {
      const root = await render();
      const focusable = root.querySelector('a[href], button, [tabindex]:not([tabindex="-1"])');
      expect(focusable?.getAttribute('href')).toBe('#main');
      expect(focusable?.textContent?.trim()).toBe('Skip to main content');
    });

    it('points the skip link at a focusable main', async () => {
      const main = (await render()).querySelector('main');
      expect(main?.id).toBe('main');
      expect(main?.getAttribute('tabindex')).toBe('-1');
    });
  });
});
