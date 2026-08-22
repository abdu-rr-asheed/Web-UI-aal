import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration (PRD TR-04, TR-08).
 *
 * Real browsers, because jsdom cannot do the things that matter most here:
 * it does not compute colour contrast, does not resolve pseudo-elements
 * (the focus-ring warnings in the unit run are exactly this), does not model
 * real focus order across overlay stacking contexts, and does not expose a
 * genuine accessibility tree. Unit-level axe is a fast first pass; this is
 * where the AR-05/AR-07/AR-08 evidence actually comes from.
 *
 * Three engines, because screen-reader behaviour is a function of the
 * browser's accessibility tree and those trees genuinely differ — divergence
 * between them is a research finding (PRD §17 R9), not a flake to retry away.
 */

const CI = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  outputDir: './reports/playwright/artifacts',
  fullyParallel: true,
  forbidOnly: CI,
  // Retries hide intermittent accessibility bugs — a focus trap that escapes
  // one run in five is a defect, not flakiness. Zero retries, always.
  retries: 0,
  workers: CI ? 2 : undefined,

  // 'github' emits ::error:: annotations, which surface the failure inline on
  // the PR diff AND make it readable through the check-runs annotations API —
  // downloading raw job logs needs auth, annotations do not.
  reporter: CI
    ? [
        ['github'],
        ['list'],
        ['json', { outputFile: 'reports/playwright/results.json' }],
        ['html', { open: 'never', outputFolder: 'reports/playwright/html' }],
      ]
    : [['list']],

  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    // --- Accessibility sweeps (axe in a real engine) ---
    {
      name: 'a11y-chromium',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y-firefox',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'a11y-webkit',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    // --- APG keyboard conformance (PRD TR-02) ---
    // Chromium only by default: key handling is implemented by AAL, not by the
    // engine, so running identical assertions three times mostly buys wall time.
    // The full matrix runs on main via --project=keyboard-firefox/webkit.
    {
      name: 'keyboard',
      testMatch: /keyboard\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'keyboard-firefox',
      testMatch: /keyboard\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'keyboard-webkit',
      testMatch: /keyboard\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },

    // --- forced-colors and RTL (PRD AR-19, FR-13, TR-10) ---
    // forced-colors emulation is Chromium-only in Playwright.
    {
      name: 'forced-colors',
      testMatch: /forced-colors\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], forcedColors: 'active' },
    },

    // --- Reflow at the SC 1.4.10 minimum (AR-17) ---
    {
      name: 'reflow-320',
      testMatch: /a11y\/.*reflow.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 640 } },
    },
  ],

  webServer: {
    command: 'npm run start:docs',
    url: 'http://localhost:4200',
    reuseExistingServer: !CI,
    timeout: 180_000,
  },
});
