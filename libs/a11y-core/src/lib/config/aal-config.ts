import { InjectionToken, Provider, inject } from '@angular/core';

/**
 * Screen-reader announcement strings emitted by AAL itself (FR-12).
 *
 * Library-generated speech is content, and content must be localisable. A
 * hard-coded English string is an accessibility defect for a Welsh or Tamil
 * screen-reader user, not merely an i18n gap.
 */
export interface AalStrings {
  readonly dialogClosed: string;
  readonly loading: string;
  readonly selected: (label: string) => string;
  readonly deselected: (label: string) => string;
  readonly selectionCount: (count: number, total: number) => string;
  readonly sortedBy: (column: string, direction: 'ascending' | 'descending') => string;
  readonly errorSummary: (count: number) => string;
}

export const AAL_DEFAULT_STRINGS: AalStrings = {
  dialogClosed: 'Dialog closed',
  loading: 'Loading',
  selected: (label) => `${label} selected`,
  deselected: (label) => `${label} deselected`,
  selectionCount: (count, total) => `${count} of ${total} selected`,
  sortedBy: (column, direction) => `Sorted by ${column}, ${direction}`,
  errorSummary: (count) =>
    count === 1 ? '1 error must be fixed before continuing' : `${count} errors must be fixed before continuing`,
};

export interface AalConfig {
  /** Locale strings for library-emitted announcements. */
  readonly strings: AalStrings;

  /**
   * How aggressively dev-mode assertions report misuse (FR-08).
   * `throw` is the default in development because a silent accessibility
   * defect is the failure mode this library exists to prevent.
   */
  readonly assertions: 'throw' | 'warn' | 'off';

  /**
   * When the focus ring is painted.
   * `keyboard-only` matches :focus-visible semantics. `always` is offered for
   * consumers who have decided a persistent ring suits their audience —
   * notably some cognitive-accessibility contexts. There is deliberately no
   * `never`.
   */
  readonly focusRing: 'keyboard-only' | 'always';

  /**
   * Announce debounce in ms. Rapid updates otherwise flood the live region and
   * the user hears a stutter of half-finished phrases instead of the result.
   */
  readonly announceDebounceMs: number;
}

export const AAL_DEFAULT_CONFIG: AalConfig = {
  strings: AAL_DEFAULT_STRINGS,
  assertions: 'throw',
  focusRing: 'keyboard-only',
  announceDebounceMs: 150,
};

export const AAL_CONFIG = new InjectionToken<AalConfig>('AAL_CONFIG', {
  providedIn: 'root',
  factory: () => AAL_DEFAULT_CONFIG,
});

/**
 * Root configuration for AAL (FR-11).
 *
 * Never required. Every component is fully accessible with no configuration at
 * all — this exists for customisation, not for correctness. If a component
 * needed `provideAal()` to be accessible, that component would be broken.
 */
export function provideAal(config: Partial<AalConfig> = {}): Provider[] {
  return [
    {
      provide: AAL_CONFIG,
      useValue: {
        ...AAL_DEFAULT_CONFIG,
        ...config,
        strings: { ...AAL_DEFAULT_STRINGS, ...(config.strings ?? {}) },
      } satisfies AalConfig,
    },
  ];
}

/** Convenience accessor for use inside an injection context. */
export function injectAalConfig(): AalConfig {
  return inject(AAL_CONFIG);
}
