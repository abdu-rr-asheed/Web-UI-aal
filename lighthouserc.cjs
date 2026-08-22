/**
 * Lighthouse CI (PRD TR-06, §12.3).
 *
 * Asserts an accessibility score >= 0.98 on the built docs app, plus specific
 * audits as errors. The category score alone is a poor gate — it is a weighted
 * average, so one failing audit can hide behind several passing ones. Naming
 * the individual audits means a regression in any single one fails the build
 * regardless of what the aggregate does.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist/docs/browser',
      numberOfRuns: 3,
      settings: { onlyCategories: ['accessibility', 'best-practices'] },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.98 }],

        // Individually gated so none can hide inside the average.
        'color-contrast': 'error',
        'heading-order': 'error',
        'html-has-lang': 'error',
        'document-title': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr-value': 'error',
        'aria-valid-attr': 'error',
        'aria-allowed-attr': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'image-alt': 'error',
        label: 'error',
        list: 'error',
        listitem: 'error',
        tabindex: 'error',
        'duplicate-id-aria': 'error',
        'landmark-one-main': 'error',
        'bypass': 'error',
        'meta-viewport': 'error',

        // Not accessibility criteria; keep them visible without gating on them.
        'categories:best-practices': 'off',
        'uses-responsive-images': 'off',
        'unused-javascript': 'off',
      },
    },
    upload: { target: 'filesystem', outputDir: './reports/lighthouse' },
  },
};
