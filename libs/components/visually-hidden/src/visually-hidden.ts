import { Directive, booleanAttribute, computed, input, signal } from '@angular/core';

/**
 * Visually hidden, but present in the accessibility tree (PRD §9.9).
 *
 * For text a screen-reader user needs and a sighted user gets from context —
 * "(opens in a new tab)", a table caption already implied by the page heading,
 * the word "Search" on a magnifier-icon field.
 *
 * **Never `display: none` or `visibility: hidden`.** Both remove the element
 * from the accessibility tree entirely, which is the exact opposite of the
 * intent: the text becomes invisible to precisely the users it was written
 * for. The clip technique keeps it rendered and readable by assistive
 * technology while occupying no visual space.
 *
 * Details that matter:
 * - `1px`, not `0` — some screen readers skip zero-area elements.
 * - `white-space: nowrap` — otherwise the 1px box wraps the text into a
 *   one-character-per-line column, which some AT reads in layout order.
 * - `clip-path: inset(50%)` rather than the legacy `clip` property, which is
 *   deprecated.
 *
 * Implemented with host STYLE bindings rather than a stylesheet: a directive
 * cannot carry `styles`, and requiring consumers to import a separate utility
 * CSS file would make the hiding silently fail if they forgot. Self-contained
 * is the safer default for something whose failure mode is invisible text
 * becoming visible.
 */
@Directive({
  selector: '[aalVisuallyHidden]',
  standalone: true,
  host: {
    '[style.position]': 'revealed() ? null : "absolute"',
    '[style.width]': 'revealed() ? null : "1px"',
    '[style.height]': 'revealed() ? null : "1px"',
    '[style.margin]': 'revealed() ? null : "-1px"',
    '[style.padding]': 'revealed() ? null : "0"',
    '[style.overflow]': 'revealed() ? null : "hidden"',
    '[style.clip-path]': 'revealed() ? null : "inset(50%)"',
    '[style.white-space]': 'revealed() ? null : "nowrap"',
    '[style.border]': 'revealed() ? null : "0"',
    '(focusin)': 'hasFocus.set(true)',
    '(focusout)': 'hasFocus.set(false)',
  },
})
export class AalVisuallyHidden {
  /**
   * Reveal the element while it, or anything inside it, has focus.
   *
   * Required for anything focusable. A control a sighted keyboard user can
   * reach but cannot see is an SC 2.4.7 failure, and permanently-hidden
   * focusable content is one of the classic ways to strand a keyboard user
   * somewhere they cannot perceive.
   */
  readonly focusable = input(false, {
    transform: booleanAttribute,
    alias: 'aalVisuallyHiddenFocusable',
  });

  protected readonly hasFocus = signal(false);

  /** Hidden unless this is the focusable variant and focus is currently inside. */
  protected readonly revealed = computed(() => this.focusable() && this.hasFocus());
}
