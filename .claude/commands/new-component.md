---
description: Scaffold an AAL component end-to-end from its PRD §9 spec — primitive, styled component, tests, story, pattern doc
argument-hint: <component-name> (e.g. dialog, text-field, radio-group)
---

Build the AAL component **$1**, complete and Definition-of-Done ready.

## Step 1 — Read the spec before writing anything

1. Read the `$1` specification in `PRD.md` §9. If `$1` is one of the eight MUST components it has a full spec table (§9.1–§9.8); otherwise it is a row in §9.9 and you must first expand it with `/pattern-spec $1`.
2. Read `PRD.md` §7.4 (a11y-core service catalogue) and §7.5.1 (primitive inventory) to find which primitive `$1` composes and which L2 services it needs. **Do not invent new services** — if the mechanism exists in §7.4, inject it.
3. Read `PRD.md` §6.3.1 to check whether Angular CDK already provides the behaviour. If it does, wrap it. Do not reimplement focus trapping, live regions, key managers, overlays or portals.
4. Read an existing completed component (start with `libs/components/button` once it exists) and match its structure exactly. Consistency across components is a research property here, not a style preference.

State which primitive, which CDK entry points and which L2 services you will use **before** you write code. If the spec is ambiguous, ask rather than guessing — a wrong ARIA pattern is expensive to unwind later.

## Step 2 — Build, in this order

**a. L3 primitive** in `libs/primitives/$1/` (skip if the primitive already exists — compose it instead)
- Directive set per PRD §7.5.1, `exportAs` set, zero styles, no visual opinion
- State as `signal()`/`model()`, derived ARIA values as `computed()`
- IDs from `AriaIdService` only
- Full APG keyboard model in the primitive, never in the styled layer
- Parent/child coordination by hierarchical DI (`inject(Parent)`), never an event bus

**b. L4 styled component** in `libs/components/$1/`
- Adopts the primitive via `hostDirectives` — no wrapper elements (they break `role` parent/child relationships)
- Presentation only. If you write an `aria-*` binding here, stop: it belongs in the primitive
- `ChangeDetectionStrategy.OnPush`, semantic HTML root element
- Styles reference semantic tokens only — no hex, no `outline: none`
- Secondary entry point wired (`ng-package.json`, `sideEffects: false`)
- Dev-mode assertions via `A11yAssertService` for anything the type system cannot enforce

**c. Vitest suite** — `getByRole` queries only, `getByTestId` banned
- One `describe` per state/variant, jest-axe clean on **every** one
- Focus assertions before / during / after each interaction
- Forms components: `ControlValueAccessor` including `setDisabledState`, touched/dirty
- SSR + hydration test (no ID mismatch), zoneless render test

**d. Playwright keyboard suite** in `e2e/keyboard/$1.spec.ts`
- **One test per row of the APG interaction table** in the §9 spec, each `describe` named after that row
- `@axe-core/playwright` run across chromium / firefox / webkit
- Accessibility-tree snapshot assertion (`page.accessibility.snapshot()`), not just DOM

**e. Storybook story + docs** in `libs/components/$1/$1.stories.ts` and `.mdx`
- Every variant and state as a story
- Accessibility section per PRD §15.2: role rationale (**including patterns rejected and why**), states table, full keyboard table, focus behaviour, expected screen-reader announcement text, WCAG SC satisfied, known limitations
- "Tested with" table, dates left blank for you to fill after the manual pass

**f. Pattern doc** `docs/patterns/$1.md` in the PRD §9 table format

## Step 3 — Prove it

Run `/a11y-audit $1`. Fix everything it reports. Then launch the **`a11y-reviewer`** subagent against `$1` and fix everything it finds.

## Step 4 — Report honestly

Walk the `CLAUDE.md` Definition of Done and tell me **which boxes do not yet pass** — specifically the manual NVDA/VoiceOver pass, which I must do myself and date.

Never claim a box passes because it probably would. This is research evidence.
