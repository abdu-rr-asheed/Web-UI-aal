/**
 * @aal/primitives — L3 headless APG pattern implementations (PRD §7.3, §7.5).
 *
 * **This entry point exports nothing.** Import each primitive from its own
 * secondary entry point, for the same reason as @aal/components:
 *
 * ```ts
 * import { AalField } from '@aal/primitives/field';
 * ```
 *
 * Primitives carry behaviour and ARIA semantics with ZERO styles. They exist
 * so that styled components in L4 compose the accessibility logic rather than
 * re-implementing it — which is what makes "every ARIA attribute originates in
 * exactly one place" a checkable property rather than a slogan (PRD §7.5).
 *
 * They are also independently useful: a team with its own design system can
 * depend on this layer alone and get AAL's conformance without its appearance.
 */

export const AAL_PRIMITIVES_VERSION = '0.0.0';
