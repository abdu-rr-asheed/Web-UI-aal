import { Injectable, inject, isDevMode } from '@angular/core';
import { AAL_CONFIG } from '../config/aal-config';

/**
 * Dev-mode accessibility assertions (FR-08).
 *
 * The PRD's "impossible to misuse silently" principle (§1.3) needs teeth. Where
 * TypeScript can make a misconfiguration unrepresentable it should — but a
 * great deal cannot be expressed in the type system: whether projected content
 * actually produced an accessible name, whether a role is nested legally,
 * whether two landmarks collide.
 *
 * Those are checked here, at runtime, in development only. Every message names
 * the requirement, states the user impact, and gives the fix — an error that
 * says "invalid ARIA" teaches nobody anything.
 *
 * Production: every method short-circuits on `isDevMode()`, and the whole class
 * is tree-shaken from production bundles because no live call site survives.
 */
@Injectable({ providedIn: 'root' })
export class A11yAssertService {
  private readonly config = inject(AAL_CONFIG);
  private readonly reported = new Set<string>();

  /** Whether assertions run at all. */
  get enabled(): boolean {
    return isDevMode() && this.config.assertions !== 'off';
  }

  /**
   * Report a violation.
   *
   * Deduplicated by message: a broken component inside an `@for` would
   * otherwise throw once per row and bury the real problem in noise.
   */
  fail(requirement: string, message: string, fix: string, docs?: string): void {
    if (!this.enabled) return;

    const key = `${requirement}:${message}`;
    if (this.reported.has(key)) return;
    this.reported.add(key);

    const full =
      `[AAL][${requirement}] ${message}\n` +
      `  Fix: ${fix}` +
      (docs ? `\n  Docs: ${docs}` : '');

    if (this.config.assertions === 'throw') throw new Error(full);
    console.error(full);
  }

  /**
   * An interactive element must expose a non-empty accessible name (AR-01,
   * SC 4.1.2). Unnamed controls are one of the most common real-world failures
   * — WebAIM Million finds unlabelled inputs on roughly half of all pages.
   *
   * Deliberately checks the RENDERED result rather than "did the consumer pass
   * an input": content projection, aria-label and aria-labelledby can all
   * supply the name, and only the computed outcome tells you whether one did.
   */
  assertAccessibleName(el: Element, component: string, docs?: string): void {
    if (!this.enabled) return;
    if (this.computeName(el)) return;

    this.fail(
      'FR-08 / AR-01',
      `<${component}> has no accessible name. A screen-reader user hears only its role — "button", with no indication of what it does.`,
      'Project text content into the component, or pass the ariaLabel input if it is icon-only.',
      docs,
    );
  }

  /** A role's required ARIA properties must be present (SC 4.1.2). */
  assertRequiredAria(el: Element, role: string, required: readonly string[], component: string): void {
    if (!this.enabled) return;

    const missing = required.filter((attr) => !el.hasAttribute(attr));
    if (missing.length === 0) return;

    this.fail(
      'AR-16',
      `<${component}> renders role="${role}" but is missing required ${missing.length === 1 ? 'attribute' : 'attributes'}: ${missing.join(', ')}. Assistive technology cannot report the component's state.`,
      `Add ${missing.join(', ')}. If AAL owns this attribute, this is a library bug — please report it.`,
    );
  }

  /**
   * Consumers may add descriptive ARIA, but never override attributes AAL owns
   * (PRD §7.11 rule 3). An overridden `aria-expanded` desynchronises from the
   * real state the moment the user interacts, and then the component lies.
   */
  assertNoOwnedAriaOverride(el: Element, owned: readonly string[], component: string): void {
    if (!this.enabled) return;

    const overridden = owned.filter((attr) => el.hasAttribute(`data-consumer-${attr}`));
    if (overridden.length === 0) return;

    this.fail(
      'FR-08 / §7.11',
      `<${component}> has consumer overrides for ARIA that AAL owns: ${overridden.join(', ')}. These desynchronise from the component's real state as soon as the user interacts with it.`,
      'Remove the override. Descriptive ARIA (aria-description, aria-keyshortcuts) is fine; state attributes are not.',
    );
  }

  /**
   * Landmarks of the same type need distinct accessible names (SC 1.3.1 /
   * AR-24). Two unnamed `<nav>` elements are announced identically, so a
   * screen-reader user cannot tell the primary navigation from the footer one.
   */
  assertUniqueLandmarkName(doc: Document, role: string, name: string | null): void {
    if (!this.enabled || !name) return;

    const peers = Array.from(doc.querySelectorAll(`[role="${role}"], ${role === 'navigation' ? 'nav' : role}`));
    const clashes = peers.filter((p) => this.computeName(p) === name);
    if (clashes.length <= 1) return;

    this.fail(
      'AR-24',
      `${clashes.length} "${role}" landmarks share the accessible name "${name}". A screen-reader user navigating by landmark hears the same label repeatedly and cannot tell them apart.`,
      `Give each ${role} a distinct name, e.g. "Primary" and "Footer".`,
    );
  }

  /** Minimal accessible-name computation — enough for assertion purposes. */
  private computeName(el: Element): string {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => el.ownerDocument?.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }

    const label = el.getAttribute('aria-label')?.trim();
    if (label) return label;

    // An image's alt text contributes to the name of a control wrapping it.
    const alt = el.querySelector('img[alt]')?.getAttribute('alt')?.trim();
    return this.visibleText(el) || alt || '';
  }

  /**
   * Text content EXCLUDING aria-hidden subtrees.
   *
   * Plain `textContent` was the original implementation and it was wrong in
   * precisely the case this service exists to catch: an icon-only button
   * containing `<span aria-hidden="true">x</span>` has non-empty textContent
   * but a completely empty accessible name. Counting hidden text as a name
   * meant the icon-only assertion silently never fired.
   */
  private visibleText(el: Element): string {
    let text = '';

    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 /* Node.TEXT_NODE */) {
        text += node.textContent ?? '';
        continue;
      }
      if (!(node instanceof Element)) continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      if (node.hasAttribute('hidden')) continue;

      text += this.visibleText(node);
    }

    return text.trim();
  }

  /** Test-only: clear the dedupe cache between cases. */
  resetForTesting(): void {
    this.reported.clear();
  }
}
