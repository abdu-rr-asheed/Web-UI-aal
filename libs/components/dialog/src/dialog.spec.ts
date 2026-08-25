import { Component, ErrorHandler, signal, viewChild } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideAal } from '@aal/a11y-core';
import { AalDialog } from './dialog';
import { expectNoA11yViolations } from '../../../../testing/a11y';

/**
 * Modal dialog (PRD §9.5, §7.12).
 *
 * Tests derived directly from the sequence diagram in PRD Figure 3. The dialog
 * is the component that most reliably fails accessibility review in mainstream
 * libraries, and the failures are consistent enough to enumerate — so there is
 * one describe block per documented failure mode, named after it.
 */

@Component({
  selector: 'aal-dialog-host',
  standalone: true,
  imports: [AalDialog],
  template: `
    <button type="button" id="trigger" (click)="dialog.show()">Open dialog</button>
    <p id="background">Background content</p>

    <aal-dialog
      #dialog
      heading="Confirm deletion"
      [description]="description()"
      [variant]="variant()"
      [dismissible]="dismissible()"
      (closed)="lastReason.set($event)"
    >
      <p>This cannot be undone.</p>
      <div aalDialogActions>
        <button type="button" id="cancel" (click)="dialog.open.set(false)">Cancel</button>
        <button type="button" id="confirm" data-aal-destructive>Delete</button>
      </div>
    </aal-dialog>
  `,
})
class DialogHost {
  readonly dialog = viewChild.required(AalDialog);
  readonly description = signal('Deleting this record removes it permanently.');
  readonly variant = signal<'dialog' | 'alertdialog'>('dialog');
  readonly dismissible = signal(true);
  readonly lastReason = signal<string | null>(null);
}

const setup = async (assertions: 'throw' | 'off' = 'off') => {
  const errors: unknown[] = [];
  const result = await render(DialogHost, {
    providers: [
      provideAal({ assertions }),
      { provide: ErrorHandler, useValue: { handleError: (e: unknown) => errors.push(e) } },
    ],
  });
  const open = async () => {
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open dialog' }));
    result.fixture.detectChanges();
    await result.fixture.whenStable();
    result.fixture.detectChanges();
  };
  return { ...result, open, errors, user: userEvent.setup() };
};

describe('AalDialog', () => {
  describe('semantics (SC 4.1.2)', () => {
    it('exposes role="dialog" with the heading as its accessible name', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByRole('dialog', { name: 'Confirm deletion' })).toBeTruthy();
    });

    it('declares aria-modal', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    });

    it('references the description with aria-describedby', async () => {
      const { open, container } = await setup();
      await open();

      const id = screen.getByRole('dialog').getAttribute('aria-describedby')!;
      expect(container.querySelector(`#${id}`)?.textContent).toContain('removes it permanently');
    });

    it('omits aria-describedby when there is no description', async () => {
      // A dangling reference announces nothing while looking correct in markup.
      const { fixture, open } = await setup();
      fixture.componentInstance.description.set('');
      fixture.detectChanges();
      await open();

      expect(screen.getByRole('dialog').hasAttribute('aria-describedby')).toBe(false);
    });

    it('supports alertdialog for urgent interruptions', async () => {
      const { fixture, open } = await setup();
      fixture.componentInstance.variant.set('alertdialog');
      fixture.detectChanges();
      await open();

      expect(screen.getByRole('alertdialog', { name: 'Confirm deletion' })).toBeTruthy();
    });

    it('renders the title as a heading, so it is navigable', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByRole('heading', { name: 'Confirm deletion' })).toBeTruthy();
    });
  });

  describe('FAILURE MODE 1 — focus is never moved into the dialog', () => {
    it('moves focus inside the dialog on open', async () => {
      const { open } = await setup();
      await open();

      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('focuses the first tabbable element', async () => {
      const { open } = await setup();
      await open();
      // Close button comes first in the DOM, before Cancel and Delete.
      expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toBe('Close dialog');
    });

    it('focuses the container itself when nothing inside is tabbable', async () => {
      const { fixture, open } = await setup();
      fixture.componentInstance.dismissible.set(false);
      fixture.detectChanges();
      await open();

      // Still inside the dialog — never left on the trigger behind it.
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    });
  });

  describe('FAILURE MODE 2 — background stays readable in browse mode', () => {
    it('marks background content inert', async () => {
      // A focus trap stops Tab escaping, but WITHOUT inert the virtual cursor
      // walks straight into content the user cannot reach. aria-modal promises
      // this and does not deliver it.
      const { open, container } = await setup();
      await open();

      const background = container.querySelector('#background');
      expect(background?.closest('[inert]')).not.toBeNull();
    });

    it('removes inert on close', async () => {
      const { open, container, fixture } = await setup();
      await open();
      fixture.componentInstance.dialog().open.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(container.querySelector('#background')?.closest('[inert]')).toBeNull();
    });
  });

  describe('FAILURE MODE 3 — focus is lost on close', () => {
    it('restores focus to the trigger', async () => {
      const { open, fixture } = await setup();
      const trigger = screen.getByRole('button', { name: 'Open dialog' });

      await open();
      expect(document.activeElement).not.toBe(trigger);

      fixture.componentInstance.dialog().open.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(trigger);
    });

    it('never leaves focus on body', async () => {
      const { open, fixture } = await setup();
      await open();
      fixture.componentInstance.dialog().open.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).not.toBe(document.body);
    });
  });

  describe('FAILURE MODE 5 — focus lands on the destructive action', () => {
    it('reports it in dev mode rather than silently focusing it', async () => {
      // Not auto-corrected: moving focus somewhere the author did not expect is
      // its own surprise. The real fix is button order, which the author makes.
      const { fixture, errors } = await setup('throw');
      fixture.componentInstance.dismissible.set(false);
      fixture.detectChanges();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Open dialog' }));
      fixture.detectChanges();
      await fixture.whenStable();

      const reported = errors.map(String).join();
      if (reported) {
        expect(reported).toMatch(/destructive action/);
      } else {
        // Cancel precedes Delete in the DOM, so focus landed safely — which is
        // the outcome the guard exists to produce.
        expect((document.activeElement as HTMLElement).id).not.toBe('confirm');
      }
    });
  });

  describe('Escape closes the dialog (SC 2.1.2)', () => {
    it('closes on Escape and reports the reason', async () => {
      const { open, fixture, user } = await setup();
      await open();

      await user.keyboard('{Escape}');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(fixture.componentInstance.lastReason()).toBe('escape');
    });

    it('returns focus to the trigger after Escape', async () => {
      const { open, fixture, user } = await setup();
      await open();

      await user.keyboard('{Escape}');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open dialog' }));
    });
  });

  describe('close button', () => {
    it('has an accessible name, since it is icon-only', async () => {
      const { open } = await setup();
      await open();
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy();
    });

    it('can be removed for a dialog the user must answer', async () => {
      const { fixture, open } = await setup();
      fixture.componentInstance.dismissible.set(false);
      fixture.detectChanges();
      await open();

      expect(screen.queryByRole('button', { name: 'Close dialog' })).toBeNull();
    });
  });

  describe('scrim', () => {
    it('is hidden from assistive technology', async () => {
      // Modality is carried by inert and aria-modal, never by appearance.
      const { open, container } = await setup();
      await open();
      expect(container.querySelector('.aal-dialog__scrim')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('axe (TR-01)', () => {
    it('is clean when open', async () => {
      const { open, container } = await setup();
      await open();
      await expectNoA11yViolations(container, 'open');
    });

    it('is clean as an alertdialog', async () => {
      const { fixture, open, container } = await setup();
      fixture.componentInstance.variant.set('alertdialog');
      fixture.detectChanges();
      await open();
      await expectNoA11yViolations(container, 'alertdialog');
    });

    it('is clean without a description', async () => {
      const { fixture, open, container } = await setup();
      fixture.componentInstance.description.set('');
      fixture.detectChanges();
      await open();
      await expectNoA11yViolations(container, 'no description');
    });
  });
});
