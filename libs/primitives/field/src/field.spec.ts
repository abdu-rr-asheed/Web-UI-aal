import { Component, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { provideAal } from '@aal/a11y-core';
import { AalField, AalFieldControl, AalFieldError, AalFieldHint, AalFieldLabel } from './field';

/**
 * Field primitive (PRD §9.2, §7.5.1).
 *
 * The headless layer that owns label/control/hint/error ARIA wiring. Every AAL
 * form control composes it, so a defect here is a defect in all of them — and
 * the wiring is exactly where form accessibility fails in practice.
 *
 * These tests also verify the L3 contract itself: the primitive renders no DOM
 * of its own and every relationship is derived rather than passed in.
 */

@Component({
  selector: 'aal-field-host',
  standalone: true,
  imports: [AalField, AalFieldLabel, AalFieldControl, AalFieldHint, AalFieldError],
  template: `
    <div
      aalField
      [invalid]="invalid()"
      [touched]="touched()"
      [required]="required()"
      [disabled]="disabled()"
    >
      <!--
        The label/control association is made at RUNTIME by AalFieldLabel's
        [attr.for] host binding, which a static rule cannot follow. Disabling
        the rule here does not weaken the gate: the first test below asserts
        label.for === input.id on the rendered output, which is a stronger
        check than the static one. L4 components write [attr.for] literally, so
        the rule still applies to them.
      -->
      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
      <label aalFieldLabel>Email address</label>
      @if (showHint()) {
        <p aalFieldHint>We only use this to send your receipt</p>
      }
      <input aalFieldControl type="email" />
      @if (showError()) {
        <p aalFieldError>Enter an email address in the format name&#64;example.com</p>
      }
    </div>
  `,
})
class FieldHost {
  readonly invalid = signal(false);
  readonly touched = signal(false);
  readonly required = signal(false);
  readonly disabled = signal(false);
  readonly showHint = signal(false);
  readonly showError = signal(false);
}

@Component({
  selector: 'aal-two-field-host',
  standalone: true,
  imports: [AalField, AalFieldLabel, AalFieldControl],
  template: `
    <div aalField>
      <!--
        The label/control association is made at RUNTIME by AalFieldLabel's
        [attr.for] host binding, which a static rule cannot follow. Disabling
        the rule here does not weaken the gate: the first test below asserts
        label.for === input.id on the rendered output, which is a stronger
        check than the static one. L4 components write [attr.for] literally, so
        the rule still applies to them.
      -->
      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
      <label aalFieldLabel>Email address</label>
      <input aalFieldControl type="email" />
    </div>
    <div aalField>
      <!--
        The label/control association is made at RUNTIME by AalFieldLabel's
        [attr.for] host binding, which a static rule cannot follow. Disabling
        the rule here does not weaken the gate: the first test below asserts
        label.for === input.id on the rendered output, which is a stronger
        check than the static one. L4 components write [attr.for] literally, so
        the rule still applies to them.
      -->
      <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
      <label aalFieldLabel>Confirm email address</label>
      <input aalFieldControl type="email" />
    </div>
  `,
})
class TwoFieldHost {}

const setup = async () => {
  const result = await render(FieldHost, { providers: [provideAal({ assertions: 'off' })] });
  const input = () => result.container.querySelector('input')!;
  const label = () => result.container.querySelector('label')!;
  return { ...result, input, label };
};

describe('AalField', () => {
  describe('label association (AR-11 / SC 3.3.2)', () => {
    it('associates the label with the control via for/id', async () => {
      const { input, label } = await setup();
      expect(label().getAttribute('for')).toBe(input().id);
      expect(input().id).toBeTruthy();
    });

    it('is discoverable by role and accessible name, the way a screen reader finds it', async () => {
      await setup();
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeTruthy();
    });

    it('generates unique ids for two fields in the SAME document', async () => {
      // Duplicate ids silently repoint an ARIA relationship at the wrong
      // element — renders correctly, reads wrongly (FR-07).
      //
      // Two separate render() calls would NOT test this: each creates a fresh
      // injector, so the counter restarts and both get the same id. That is
      // the SSR-stability property (covered in a11y-core), not a collision.
      // Collisions only happen within one document, so the test has to put
      // both fields in one.
      const { container } = await render(TwoFieldHost, {
        providers: [provideAal({ assertions: 'off' })],
      });

      const [a, b] = [...container.querySelectorAll('input')];
      expect(a.id).toBeTruthy();
      expect(b.id).toBeTruthy();
      expect(a.id).not.toBe(b.id);

      // And each label still points at its OWN control.
      const [labelA, labelB] = [...container.querySelectorAll('label')];
      expect(labelA.getAttribute('for')).toBe(a.id);
      expect(labelB.getAttribute('for')).toBe(b.id);
    });
  });

  describe('aria-describedby ordering', () => {
    it('is absent when there is neither hint nor error', async () => {
      const { input } = await setup();
      expect(input().hasAttribute('aria-describedby')).toBe(false);
    });

    it('references the hint when one is present', async () => {
      const { fixture, input, container } = await setup();
      fixture.componentInstance.showHint.set(true);
      fixture.detectChanges();

      const id = input().getAttribute('aria-describedby')!;
      expect(container.querySelector(`#${id}`)?.textContent).toContain('send your receipt');
    });

    it('lists hint BEFORE error, so the instruction arrives while it can still help', async () => {
      // Screen readers announce descriptions in reference order. Hearing "that
      // is not valid" before "we only use this for your receipt" is backwards.
      const { fixture, input, container } = await setup();
      fixture.componentInstance.showHint.set(true);
      fixture.componentInstance.showError.set(true);
      fixture.componentInstance.invalid.set(true);
      fixture.componentInstance.touched.set(true);
      fixture.detectChanges();

      const ids = input().getAttribute('aria-describedby')!.split(' ');
      expect(ids).toHaveLength(2);
      expect(container.querySelector(`#${ids[0]}`)?.textContent).toContain('receipt');
      expect(container.querySelector(`#${ids[1]}`)?.textContent).toContain('name@example.com');
    });
  });

  describe('aria-invalid waits for touched (AR-12)', () => {
    it('is absent when invalid but untouched', async () => {
      // Otherwise a screen-reader user tabbing through a fresh form hears
      // "invalid" on every control before typing a character.
      const { fixture, input } = await setup();
      fixture.componentInstance.invalid.set(true);
      fixture.detectChanges();

      expect(input().hasAttribute('aria-invalid')).toBe(false);
    });

    it('is absent when touched but valid', async () => {
      const { fixture, input } = await setup();
      fixture.componentInstance.touched.set(true);
      fixture.detectChanges();

      expect(input().hasAttribute('aria-invalid')).toBe(false);
    });

    it('appears only when invalid AND touched', async () => {
      const { fixture, input } = await setup();
      fixture.componentInstance.invalid.set(true);
      fixture.componentInstance.touched.set(true);
      fixture.detectChanges();

      expect(input().getAttribute('aria-invalid')).toBe('true');
    });

    it('drops the error from aria-describedby while untouched', async () => {
      const { fixture, input } = await setup();
      fixture.componentInstance.showError.set(true);
      fixture.componentInstance.invalid.set(true);
      fixture.detectChanges();

      expect(input().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('required and disabled', () => {
    it('exposes aria-required', async () => {
      const { fixture, input } = await setup();
      fixture.componentInstance.required.set(true);
      fixture.detectChanges();
      expect(input().getAttribute('aria-required')).toBe('true');
    });

    it('omits aria-required when not required, rather than emitting "false"', async () => {
      const { input } = await setup();
      expect(input().hasAttribute('aria-required')).toBe(false);
    });

    it('propagates disabled to the control', async () => {
      const { fixture, input } = await setup();
      fixture.componentInstance.disabled.set(true);
      fixture.detectChanges();
      expect(input().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('L3 contract — renders no DOM of its own (PRD §7.3)', () => {
    it('adds no wrapper elements', async () => {
      // Wrapper elements are one of the most common causes of broken role
      // parent/child relationships in Angular libraries.
      const { container } = await setup();
      const host = container.querySelector('[aalField]')!;
      const tagNames = [...host.children].map((c) => c.tagName);
      expect(tagNames).toEqual(['LABEL', 'INPUT']);
    });

    it('applies no styles', async () => {
      const { container } = await setup();
      const host = container.querySelector('[aalField]') as HTMLElement;
      expect(host.getAttribute('style')).toBeNull();
    });
  });

  describe('label text exposure', () => {
    it('exposes the label text for out-of-context announcements', async () => {
      // A live-region message saying only "Required" is useless — the user
      // cannot see which of eight fields it belongs to.
      const { fixture } = await setup();
      await fixture.whenStable();

      const field = fixture.debugElement
        .query((n) => n.attributes?.['aalField'] !== undefined)
        .injector.get(AalField);

      expect(field.labelText()).toBe('Email address');
    });
  });
});
