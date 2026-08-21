/**
 * @aal/tokens — L1 foundation (PRD §7.3).
 *
 * The single source of truth for every visual value that has an accessibility
 * consequence. Contains NO Angular code by design: this layer must be usable by
 * the contrast validator, the docs site and the VPAT generator alike.
 *
 * Consumers import the stylesheet once:
 *   @import '@aal/tokens/styles/tokens.css';
 *
 * and reference tokens type-safely in TypeScript:
 *   import { token } from '@aal/tokens';
 *   token('color.action.bg')  // -> 'var(--aal-color-action-bg)'
 */

export * from './lib/tokens.generated';
