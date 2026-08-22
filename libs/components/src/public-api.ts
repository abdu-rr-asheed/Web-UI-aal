/**
 * @aal/components — L4 styled components (PRD §7.3).
 *
 * **This entry point exports no components, deliberately.** Import each one
 * from its own secondary entry point:
 *
 * ```ts
 * import { AalButton }         from '@aal/components/button';
 * import { AalLink }           from '@aal/components/link';
 * import { AalSkipLink }       from '@aal/components/skip-link';
 * import { AalVisuallyHidden } from '@aal/components/visually-hidden';
 * ```
 *
 * Why no convenience barrel:
 *
 * FR-02 requires every component to be independently importable so that using
 * one cannot drag the rest into a consumer's bundle. A barrel re-exporting
 * everything works against that in practice — it relies on the bundler
 * tree-shaking correctly, and it makes the cheap import and the expensive one
 * look identical at the call site. Angular Material's `MatButtonModule`-style
 * split exists for the same reason.
 *
 * It is also a technical consequence worth being straight about: the primary
 * entry point cannot reach into a secondary entry point's sources without
 * breaking ng-packagr's rootDir boundaries, and routing around that would mean
 * compiling every component into the primary bundle — the exact outcome FR-02
 * exists to prevent.
 *
 * `@aal/a11y-core` remains the place to import `provideAal()` and the
 * accessibility services.
 */

/** Library version, stamped at release. Useful in bug reports and VPAT evidence. */
export const AAL_VERSION = '0.0.0';
