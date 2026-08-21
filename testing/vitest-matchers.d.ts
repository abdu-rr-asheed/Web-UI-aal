/**
 * Teaches Vitest's `expect` about the matcher jest-axe registers in
 * testing/vitest-setup.ts. Separate from jest-axe.d.ts because module
 * augmentation requires this file to BE a module, while an ambient module
 * declaration requires the opposite.
 */

import 'vitest';

declare module 'vitest' {
  interface Assertion {
    /** Asserts axe found no violations. Registered via expect.extend. */
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
