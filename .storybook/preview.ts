import type { Preview } from '@storybook/angular-vite';
import { AAL_THEMES } from '../libs/tokens/src/lib/tokens.generated';

// Token stylesheet first — @layer order is fixed by first declaration, and the
// sealed accessibility invariants live in the aal.invariants layer.
import '../libs/tokens/src/styles/tokens.css';

/**
 * Global story configuration.
 *
 * The theme toolbar is a testing affordance, not a demo: PRD §11.3 requires
 * every component to be verified in light, dark and high-contrast, and
 * switching here drives the same `data-aal-theme` attribute the real cascade
 * uses (§10.4) rather than a Storybook-only approximation.
 */
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },

    a11y: {
      config: {
        // Mirrors WCAG_22_AA_TAGS in testing/a11y.ts. Divergence between the
        // docs panel and the CI gate would make one of them a lie.
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
        },
      },
      // Fail the story rather than annotate it: DR-01 exists so an auditor can
      // trust the panel (PRD persona P2).
      test: 'error',
    },

    backgrounds: { disable: true }, // themes are token-driven; a separate bg picker would lie
  },

  globalTypes: {
    theme: {
      description: 'AAL theme (PRD §10.4)',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: AAL_THEMES.map((t) => ({ value: t, title: t })),
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, context) => {
      // Drive the real attribute the cascade keys off, so what a reviewer sees
      // in Storybook is what a consumer gets in an application.
      document.documentElement.setAttribute('data-aal-theme', context.globals['theme'] as string);
      return story();
    },
  ],
};

export default preview;
