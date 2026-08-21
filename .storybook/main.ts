import type { StorybookConfig } from '@storybook/angular-vite';

/**
 * Storybook configuration (PRD DR-01, DR-02).
 *
 * Framework note: `@storybook/angular-vite`, NOT `@storybook/angular` as PRD
 * §6.7 originally specified. The latter still depends on the legacy
 * @angular-devkit/build-angular webpack builder, which npm resolves to v21 and
 * conflicts with this workspace's Angular 22. The Vite framework peers directly
 * on @angular/build, which is what Angular 22 actually ships. See PRD §19.9.
 *
 * Storybook is the primary documentation surface AND the Lighthouse audit
 * target, so addon-a11y is not optional decoration here — it is how DR-01's
 * "live axe panel per component" requirement is met.
 */
const config: StorybookConfig = {
  stories: [
    '../libs/components/**/*.mdx',
    '../libs/components/**/*.stories.@(ts|mdx)',
    '../libs/primitives/**/*.stories.@(ts|mdx)',
    '../docs/**/*.mdx',
  ],

  addons: [
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-a11y',
      options: {
        // Same rule set as the unit and E2E gates (testing/a11y.ts), so a
        // component cannot look green in the docs panel while failing CI.
        test: 'error',
      },
    },
  ],

  framework: {
    name: '@storybook/angular-vite',
    options: {},
  },

  staticDirs: [{ from: '../libs/tokens/src/styles', to: '/tokens' }],

  typescript: {
    // Autodocs generates the API tables required by DR-01 from the TypeScript
    // types, which is why the public API has to be honestly typed (PRD §7.11).
    check: false,
  },

  docs: { defaultName: 'Overview' },

  // NFR-08 — this repository does not phone home, and that includes its tooling.
  core: { disableTelemetry: true },
};

export default config;
