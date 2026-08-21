/**
 * Global Vitest setup for every Angular project (PRD TR-01).
 *
 * Wired via the `setupFiles` option of @angular/build:unit-test in angular.json.
 * Angular's polyfills and TestBed are initialised before this runs.
 */

import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

/**
 * jest-axe's matcher is runner-agnostic — it is a plain matcher object, not
 * anything Jest-specific — so it registers cleanly on Vitest's expect.
 *
 * The dedicated `vitest-axe` package was evaluated and rejected: it is still at
 * 0.1.0 and unmaintained, and taking an unmaintained dependency for the
 * assertion that carries the project's central conformance claim is a poor
 * trade (PRD §6.5).
 */
expect.extend(toHaveNoViolations);
