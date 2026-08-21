/**
 * Ambient type declarations for `jest-axe`.
 *
 * The package ships no types, and DefinitelyTyped's @types/jest-axe is stuck at
 * 3.5.x against jest-axe 11 — worse, it does `/// <reference types="jest" />`
 * and augments Jest's matcher namespace, neither of which applies here: this
 * workspace runs Vitest (PRD §19.2) and has no Jest globals. Stale types that
 * look authoritative are more dangerous than no types, so we declare exactly
 * the surface AAL uses.
 *
 * NOTE: this file must contain NO top-level import or export, or it becomes a
 * module and `declare module 'jest-axe'` would be read as an augmentation of an
 * already-typed module rather than an ambient declaration of an untyped one.
 * Types from axe-core are therefore referenced with inline `import(...)`.
 */

declare module 'jest-axe' {
  /**
   * Option shape declared self-contained rather than `extends
   * import('axe-core').RunOptions`. axe-core publishes its types as
   * `declare namespace axe { … } export = axe`, and under this workspace's
   * module resolution the namespace members do not resolve through an inline
   * `import()` inside an ambient declaration — the extend silently produced an
   * empty interface, so every option looked like an excess property. Declaring
   * the handful of fields AAL actually uses is both correct and clearer about
   * the surface being relied on.
   */
  export interface JestAxeConfigureOptions {
    runOnly?:
      | { type: 'rule' | 'rules' | 'tag' | 'tags'; values: string[] }
      | string[]
      | string;
    rules?: Record<string, { enabled: boolean }>;
    resultTypes?: ('inapplicable' | 'passes' | 'incomplete' | 'violations')[];
    impactLevels?: ('minor' | 'moderate' | 'serious' | 'critical')[];
  }

  /** Run axe against an element or an HTML string. */
  export const axe: (
    html: Element | string,
    options?: JestAxeConfigureOptions,
  ) => Promise<import('axe-core').AxeResults>;

  /** Build an axe runner with defaults baked in. */
  export const configureAxe: (
    options?: JestAxeConfigureOptions,
  ) => (
    html: Element | string,
    options?: JestAxeConfigureOptions,
  ) => Promise<import('axe-core').AxeResults>;

  /** Matcher object, registered onto Vitest's expect in testing/vitest-setup.ts. */
  export const toHaveNoViolations: {
    toHaveNoViolations(results: import('axe-core').AxeResults): {
      actual: import('axe-core').AxeResults;
      message(): string;
      pass: boolean;
    };
  };
}
