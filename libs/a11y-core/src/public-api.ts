/**
 * @aal/a11y-core — L2 Accessibility Core (PRD §7.4).
 *
 * Cross-cutting accessibility mechanisms shared by every AAL pattern. This
 * layer renders NO DOM of its own and imports nothing from L3 primitives or
 * L4 components — enforced by ESLint (PRD §7.6), so the boundary is checked
 * rather than merely documented.
 *
 * Independently consumable: a team that wants AAL's focus, dismissal and
 * announcement behaviour without its visual components can depend on this
 * package alone.
 */

// Configuration
export {
  AAL_CONFIG,
  AAL_DEFAULT_CONFIG,
  AAL_DEFAULT_STRINGS,
  injectAalConfig,
  provideAal,
} from './lib/config/aal-config';
export type { AalConfig, AalStrings } from './lib/config/aal-config';

// Identity
export { AriaIdService } from './lib/ids/aria-id.service';

// Dev-mode assertions
export { A11yAssertService } from './lib/assert/a11y-assert.service';

// Announcements
export { AalLiveAnnouncer } from './lib/announce/live-announcer';
export type { AalPoliteness } from './lib/announce/live-announcer';

// Focus
export { FocusTrapFacade } from './lib/focus/focus-trap.facade';
export type { TrapHandle, TrapOptions } from './lib/focus/focus-trap.facade';
export { FocusObscuringGuard } from './lib/focus/focus-obscuring-guard';
export type { ObscuringResult } from './lib/focus/focus-obscuring-guard';
export { FocusRingPolicy } from './lib/focus/focus-ring-policy';
export type { AalInputModality } from './lib/focus/focus-ring-policy';

// Keyboard
export { AalRovingItem, AalRovingTabindex } from './lib/keyboard/roving-tabindex.directive';
export type { RovingOrientation } from './lib/keyboard/roving-tabindex.directive';
export { AalActiveDescendant } from './lib/keyboard/active-descendant.directive';
export { TypeaheadService } from './lib/keyboard/typeahead.service';

// Dismissal
export { DismissService } from './lib/dismiss/dismiss.service';
export type {
  DismissLayerOptions,
  DismissLayerRef,
  DismissReason,
} from './lib/dismiss/dismiss.service';

// Scroll containment
export { ScrollLockService } from './lib/scroll/scroll-lock.service';

// User media preferences
export { ReducedMotionService } from './lib/media/reduced-motion.service';
export { ForcedColorsService } from './lib/media/forced-colors.service';
