import { defineConfig } from 'vitest/config';

/**
 * Vitest config for build tooling under tools/.
 *
 * Separate from `ng test`: the Angular CLI's unit-test builder runs per Angular
 * project, and tools/ is not one. The contrast engine still needs real tests —
 * it is the arithmetic the AR-07/AR-08 conformance claim rests on — so it gets
 * its own run, wired into the gate as `npm run test:tools`.
 */
export default defineConfig({
  test: {
    include: ['tools/**/*.spec.mjs'],
    environment: 'node',
    reporters: 'dot',
  },
});
