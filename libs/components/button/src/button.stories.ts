import type { Meta, StoryObj } from '@storybook/angular-vite';
import { AalButton } from './button';
import type { AalButtonSize, AalButtonType, AalButtonVariant } from './button';

/**
 * Story args are declared as a plain shape rather than derived from AalButton.
 * The component's inputs are InputSignal<T>, and Storybook's Meta<T> does not
 * unwrap signal types — deriving from the class would make every `args` entry
 * a type error. This also keeps the controls panel describing the public API
 * as a consumer sees it, which is what DR-01 asks the API table to show.
 */
interface ButtonArgs {
  variant: AalButtonVariant;
  size: AalButtonSize;
  type: AalButtonType;
  disabled: boolean;
  loading: boolean;
  ariaLabel: string;
  pressed?: boolean;
}

/**
 * Storybook page for Button (DR-01, DR-02).
 *
 * Every variant and state gets its own story, because TR-01 requires axe to
 * run against every documented state — and the addon-a11y panel runs on the
 * story that is open. A single "playground" story would leave most states
 * unaudited while looking thoroughly documented.
 */
const meta: Meta<ButtonArgs> = {
  title: 'Components/Button',
  component: AalButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual treatment. A string union, never separate booleans (PRD §7.11 rule 1).',
    },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    type: {
      control: 'select',
      options: ['button', 'submit', 'reset'],
      description: 'Defaults to `button`, NOT the HTML default of `submit`.',
    },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    ariaLabel: {
      control: 'text',
      description: 'Only for buttons whose content cannot supply a name. Prefer projected text.',
    },
    pressed: { control: 'boolean', description: 'Toggle state. Leave undefined for an ordinary button.' },
  },
  parameters: {
    docs: {
      description: {
        component: [
          'A native `<button>`, always — never a `<div>` with a click handler.',
          '',
          '### Accessibility',
          '',
          '| Aspect | Behaviour |',
          '| --- | --- |',
          '| Role | Implicit `button` from the native element |',
          '| Name | Projected content, or `ariaLabel` for icon-only |',
          '| Keyboard | `Enter` and `Space` activate; `Tab` moves in and out |',
          '| Focus | Two-tone ring, ≥2px, ≥3:1 against any background (AR-05) |',
          '| Target | ≥24×24 CSS px; 44px by default (SC 2.5.8) |',
          '',
          '**Loading keeps the button focusable.** It reports `aria-disabled` and',
          '`aria-busy` rather than taking the native `disabled` attribute, because a',
          'natively-disabled element cannot hold focus — disabling the button the user',
          'just pressed would throw their focus to `<body>` at the exact moment they',
          'are waiting to learn whether it worked.',
          '',
          '**There is no `iconOnly` input.** The dev-mode assertion checks the rendered',
          'accessible name, so projecting an `aria-hidden` icon and nothing else fails',
          'whether or not anyone remembered to set a flag.',
          '',
          '**WCAG 2.2 SC covered:** 1.3.1, 1.4.1, 1.4.3, 1.4.11, 2.1.1, 2.4.7, 2.4.11,',
          '2.5.8, 4.1.2.',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<ButtonArgs>;

const render = (content: string) => (args: Partial<ButtonArgs>) => ({
  props: args,
  template: `<aal-button
      [variant]="variant" [size]="size" [disabled]="disabled"
      [loading]="loading" [ariaLabel]="ariaLabel">${content}</aal-button>`,
});

export const Primary: Story = {
  args: { variant: 'primary' },
  render: render('Save changes'),
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
  render: render('Cancel'),
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
  render: render('Learn more'),
};

export const Danger: Story = {
  args: { variant: 'danger' },
  render: render('Delete account'),
  parameters: {
    docs: {
      description: {
        story:
          'Colour is never the only signal that an action is destructive — the label says so too (AR-13 / SC 1.4.1).',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display:flex; gap:1rem; align-items:center">
        <aal-button size="small">Small</aal-button>
        <aal-button size="medium">Medium</aal-button>
        <aal-button size="large">Large</aal-button>
      </div>`,
  }),
  parameters: {
    docs: {
      description: {
        story: 'Even `small` stays above the 24×24 CSS px floor required by SC 2.5.8.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  render: render('Save changes'),
  parameters: {
    docs: {
      description: {
        story:
          'Uses the native `disabled` attribute, which removes it from the tab order. Use this for a control that is genuinely unavailable — not for one that is merely busy.',
      },
    },
  },
};

export const Loading: Story = {
  args: { loading: true },
  render: render('Saving'),
  parameters: {
    docs: {
      description: {
        story:
          'Stays focusable. Reports `aria-disabled="true"` and `aria-busy="true"`; the spinner is `aria-hidden` because `aria-busy` already conveys the state and exposing both would announce it twice.',
      },
    },
  },
};

export const IconOnly: Story = {
  args: { ariaLabel: 'Close dialog' },
  render: () => ({
    template: `<aal-button ariaLabel="Close dialog"><span aria-hidden="true">✕</span></aal-button>`,
  }),
  parameters: {
    docs: {
      description: {
        story:
          'The icon is `aria-hidden`; the name comes from `ariaLabel`. Omitting the label raises a dev-mode error, because the assertion checks the rendered name rather than trusting a flag.',
      },
    },
  },
};

export const Toggle: Story = {
  render: () => ({
    template: `
      <div style="display:flex; gap:0.5rem">
        <aal-button variant="secondary" [pressed]="false">Bold</aal-button>
        <aal-button variant="secondary" [pressed]="true">Italic</aal-button>
      </div>`,
  }),
  parameters: {
    docs: {
      description: {
        story:
          '`aria-pressed` appears only when `pressed` is explicitly bound. An always-present `aria-pressed="false"` would make every ordinary button announce as an unpressed toggle.',
      },
    },
  },
};

export const Disclosure: Story = {
  render: () => ({
    template: `
      <aal-button [expanded]="false" controls="sb-panel" hasPopup="menu">Actions</aal-button>
      <div id="sb-panel" hidden>Panel contents</div>`,
  }),
  parameters: {
    docs: {
      description: {
        story:
          '`aria-controls` must reference a real element. A dangling reference is a genuine defect — axe fails it, and so does this library’s test suite.',
      },
    },
  },
};
