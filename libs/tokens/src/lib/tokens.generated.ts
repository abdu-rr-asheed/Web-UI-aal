/**
 * AAL design tokens — GENERATED, DO NOT EDIT.
 * Rebuild with `npm run tokens:build`.
 *
 * Maps token path -> CSS custom property name. Values are intentionally NOT
 * inlined: a component that reads a literal hex has opted out of theming, and
 * therefore out of the high-contrast and forced-colors support that theming
 * carries (AR-19).
 */

export const AAL_TOKENS = {
  'border.width.medium': '--aal-border-width-medium',
  'border.width.thin': '--aal-border-width-thin',
  'font.family.mono': '--aal-font-family-mono',
  'font.family.sans': '--aal-font-family-sans',
  'font.letterSpacing.normal': '--aal-font-letter-spacing-normal',
  'font.letterSpacing.wide': '--aal-font-letter-spacing-wide',
  'font.lineHeight.body': '--aal-font-line-height-body',
  'font.lineHeight.tight': '--aal-font-line-height-tight',
  'font.size.2xl': '--aal-font-size-2xl',
  'font.size.large-text-threshold': '--aal-font-size-large-text-threshold',
  'font.size.lg': '--aal-font-size-lg',
  'font.size.md': '--aal-font-size-md',
  'font.size.sm': '--aal-font-size-sm',
  'font.size.xl': '--aal-font-size-xl',
  'font.size.xs': '--aal-font-size-xs',
  'font.weight.bold': '--aal-font-weight-bold',
  'font.weight.medium': '--aal-font-weight-medium',
  'font.weight.regular': '--aal-font-weight-regular',
  'layout.reflow-min': '--aal-layout-reflow-min',
  'motion.fast': '--aal-motion-fast',
  'motion.instant': '--aal-motion-instant',
  'motion.medium': '--aal-motion-medium',
  'radius.full': '--aal-radius-full',
  'radius.lg': '--aal-radius-lg',
  'radius.md': '--aal-radius-md',
  'radius.none': '--aal-radius-none',
  'radius.sm': '--aal-radius-sm',
  'space.0': '--aal-space-0',
  'space.1': '--aal-space-1',
  'space.2': '--aal-space-2',
  'space.3': '--aal-space-3',
  'space.4': '--aal-space-4',
  'space.5': '--aal-space-5',
  'space.6': '--aal-space-6',
  'space.7': '--aal-space-7',
  'color.action.bg': '--aal-color-action-bg',
  'color.action.bg-active': '--aal-color-action-bg-active',
  'color.action.bg-disabled': '--aal-color-action-bg-disabled',
  'color.action.bg-hover': '--aal-color-action-bg-hover',
  'color.action.border': '--aal-color-action-border',
  'color.border.default': '--aal-color-border-default',
  'color.border.strong': '--aal-color-border-strong',
  'color.border.subtle': '--aal-color-border-subtle',
  'color.danger.bg': '--aal-color-danger-bg',
  'color.danger.border': '--aal-color-danger-border',
  'color.danger.surface': '--aal-color-danger-surface',
  'color.danger.text': '--aal-color-danger-text',
  'color.field.bg': '--aal-color-field-bg',
  'color.field.bg-disabled': '--aal-color-field-bg-disabled',
  'color.field.border': '--aal-color-field-border',
  'color.field.border-hover': '--aal-color-field-border-hover',
  'color.field.border-invalid': '--aal-color-field-border-invalid',
  'color.focus.inner': '--aal-color-focus-inner',
  'color.focus.outer': '--aal-color-focus-outer',
  'color.selected.bg': '--aal-color-selected-bg',
  'color.selected.border': '--aal-color-selected-border',
  'color.selected.text': '--aal-color-selected-text',
  'color.success.border': '--aal-color-success-border',
  'color.success.surface': '--aal-color-success-surface',
  'color.success.text': '--aal-color-success-text',
  'color.surface.default': '--aal-color-surface-default',
  'color.surface.overlay': '--aal-color-surface-overlay',
  'color.surface.raised': '--aal-color-surface-raised',
  'color.surface.scrim': '--aal-color-surface-scrim',
  'color.surface.sunken': '--aal-color-surface-sunken',
  'color.text.default': '--aal-color-text-default',
  'color.text.disabled': '--aal-color-text-disabled',
  'color.text.link': '--aal-color-text-link',
  'color.text.muted': '--aal-color-text-muted',
  'color.text.on-action': '--aal-color-text-on-action',
  'color.text.on-danger': '--aal-color-text-on-danger',
  'color.text.placeholder': '--aal-color-text-placeholder',
  'color.warning.border': '--aal-color-warning-border',
  'color.warning.surface': '--aal-color-warning-surface',
  'color.warning.text': '--aal-color-warning-text',
  'focus.ring.offset': '--aal-focus-ring-offset',
  'focus.ring.width': '--aal-focus-ring-width',
  'target.comfortable': '--aal-target-comfortable',
  'target.min': '--aal-target-min',
} as const;

export type AalTokenPath = keyof typeof AAL_TOKENS;

/** CSS `var()` reference for a token path. Type-safe: a typo will not compile. */
export function token(path: AalTokenPath): string {
  return `var(${AAL_TOKENS[path]})`;
}

/** Themes shipped by AAL. `forced-colors` is a media state, not a selectable theme. */
export const AAL_THEMES = ['light', 'dark', 'high-contrast'] as const;
export type AalTheme = (typeof AAL_THEMES)[number];
