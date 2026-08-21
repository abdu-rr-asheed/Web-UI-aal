# AAL — Angular Aria Library

Accessibility-first Angular component library. WCAG 2.2 Level AA + WAI-ARIA APG 1.2 are **enforced structural properties**, not aspirations. MSc research deliverable (Kingston University, K2635673).

**`PRD.md` is the source of truth.** Cite its section numbers in commits, ADRs and PR descriptions. If this file and the PRD disagree, the PRD wins — and fix this file.

## Toolchain (pinned — do not upgrade without an ADR)

Angular 22.1.x · TypeScript 6.0.x · Node 24.15+ · npm 11 · Vitest 4 via `@angular/build:unit-test` · `@testing-library/angular` 19 · jest-axe 11 · Playwright 1.62 · Storybook 10.5 · angular-eslint 22.1 · axe-core 4.13 · Style Dictionary 5.5

Workspace is **Angular CLI multi-project + npm** (ADR-0011). Not Nx. Not pnpm. Not Jest. Not Karma.

## Layer architecture (PRD §7.2, §7.3)

```
L4 components  @aal/components   styled, composes L3 via hostDirectives
L3 primitives  @aal/primitives   APG state machines, ZERO styles
L2 a11y-core   @aal/a11y-core    focus/ARIA/announce services, renders NO DOM
L1 tokens      @aal/tokens       DTCG JSON, no Angular code
```

**Imports flow downward only.** Enforced by ESLint `no-restricted-imports` (PRD §7.6) — a violation fails CI.

- L4 **must never re-implement** ARIA or keyboard logic that exists in L3. If you are writing `aria-expanded` in a component, it belongs in a primitive.
- L2 wraps `@angular/cdk` where CDK already solves the problem (PRD §6.3.1). Do not reimplement focus trapping, live regions or key managers.
- Every ARIA attribute in rendered output must originate from **exactly one place** in the codebase. That single-origin property is the research claim.

## Public API rules (PRD §7.11)

1. **No boolean traps.** `variant: 'primary' | 'secondary' | 'danger'`, never three booleans.
2. **Accessible name is type-required** where it cannot be derived from projected content (icon-only buttons, etc.). Enforce in the type system where expressible; `A11yAssertService` throws in dev mode otherwise.
3. **No raw `aria-*` passthrough** on attributes AAL owns (`role`, `aria-expanded`, `aria-selected`, `aria-checked`, …). Consumers may add descriptive ARIA only.
4. **Content projection over string inputs.** `<aal-button>Save</aal-button>`, not `[label]="'Save'"`.
5. **Signals in, signals out.** `input()`, `output()`, `model()`. Never `@Input() set` with side effects.
6. **Every component independently importable** via its own secondary entry point.
7. **Any change to a rendered ARIA attribute, role or keyboard binding is a BREAKING change** (semver-major). Consumers' accessibility tests depend on it. ADR-0010.

Also: `OnPush` everywhere · zoneless-compatible · SSR-safe (no `document` outside `afterNextRender`/`inject(DOCUMENT)`) · IDs from `AriaIdService` only, never hand-rolled.

## Test conventions (PRD §11.4) — non-negotiable

- **`getByRole(name)` only. `getByTestId` is BANNED in component tests.** If a test cannot find an element by role and accessible name, neither can a screen reader — that test failure *is* the accessibility failure.
- Keyboard tests use `@testing-library/user-event`, never synthetic `dispatchEvent`.
- **Name each `describe` block after its APG interaction-table row**, so the test report reads as a conformance report.
- Assert ARIA against the **accessibility tree** (Playwright `page.accessibility.snapshot()`), not only the DOM.
- axe assertions cover **every documented state and variant**, not just the default. Record the rule tag set.
- Coverage floors: **90%** primitives, **85%** components.

## Token rules (PRD §10)

- Tier 4 tokens (`--aal-focus-ring-*`, `--aal-target-min`) are **sealed invariants**. Consumers cannot override them.
- **`outline: none` without a compliant replacement is a Stylelint error.** No exceptions.
- No hard-coded hex in component styles — semantic tokens only.
- Every fg/bg pair validated at build time across all four themes (light, dark, high-contrast, forced-colors). Build fails on violation.
- Focus ring: ≥2px, ≥2px offset, ≥3:1 against **both** component and page background.
- Minimum target 24×24 CSS px (SC 2.5.8).

## Definition of Done (PRD §11.3) — a component is not done until all pass

- [ ] Semantic HTML, composing an L3 primitive (no duplicated ARIA logic)
- [ ] Spec written in `docs/patterns/<component>.md` (PRD §9 table format)
- [ ] Unit tests: every state, jest-axe clean, coverage met
- [ ] Keyboard tests: one per APG interaction-table row
- [ ] Focus tests: before / during / after each interaction
- [ ] Playwright a11y-tree snapshot on Chromium + Firefox + WebKit
- [ ] Contrast validated in all four themes
- [ ] `forced-colors: active` verified
- [ ] Reflow at 320px · 200% text zoom · text-spacing override
- [ ] RTL verified
- [ ] SSR render + hydration, no ID mismatch
- [ ] Zoneless render verified
- [ ] Manual NVDA+Firefox and VoiceOver+Safari executed, **dated**
- [ ] Storybook page: API table, accessibility section, keyboard table, live axe panel
- [ ] Bundle budget met (≤6 KB gz styled component)
- [ ] Expert WCAG checklist row completed for every applicable SC

Run the `a11y-reviewer` subagent before ticking the last box. Use `/dod <component>` to audit honestly — report boxes that do *not* pass rather than assuming they do.

## Commit convention

Reference requirement IDs: `feat(dialog): trap focus and restore on close (AR-15, FR-07)`.
Prefixes: `feat` `fix` `docs` `test` `chore` `refactor`. ARIA/keyboard changes need a Changeset marked **major**.

## Working style here

- **Never weaken a quality gate to make a build pass.** Fix the component, or file a waiver in `docs/waivers.md` with rule ID, justification, WCAG SC, reviewer and date. **Critical and serious violations can never be waived** (PRD §12.4).
- Prefer the APG source over memory — use the `apg-spec-extractor` agent for keyboard tables.
- When accessibility and convenience conflict, accessibility wins and the trade-off goes in an ADR.
- This is research: **report what is actually true**. A component that fails is a finding, not something to paper over.
