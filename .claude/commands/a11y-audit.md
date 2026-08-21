---
description: Run the full local accessibility gate and summarise failures by requirement ID
argument-hint: [component-name] (omit to audit everything)
---

Run the local accessibility quality gate for **$1** (or the whole library if `$1` is empty) and report results **grouped by PRD requirement ID**, not by tool.

## Run these, in order, and keep going after failures

Collect every failure before reporting — do not stop at the first one.

1. **Static** — `npm run lint` (angular-eslint a11y rules + layer boundaries) and `npx stylelint "libs/**/*.{css,scss}"`
2. **Types** — `npx tsc -b --pretty false`
3. **Tokens/contrast (TR-07)** — `npm run tokens:build` then `npx tsx tools/contrast-validator --themes light,dark,high-contrast,forced-colors --fail-on-violation`
4. **Unit + component a11y (TR-01, TR-05)** — `npx ng test --watch=false --coverage` (Vitest + jest-axe)
5. **E2E a11y (TR-04, TR-08)** — `npx playwright test --project=a11y` and `--project=keyboard`
6. **Page-level (TR-06)** — `npm run build-storybook` then `npx lhci autorun --config=lighthouserc.cjs`
7. **Second engine** — `npx pa11y-ci --config .pa11yci.json`

If a step's tooling does not exist yet (early in the project), say so plainly and skip it — do not fabricate a result or silently pass.

## Report format

A table: **Requirement ID · what failed · file:line · how to fix**.

Map each finding back to its requirement — `AR-05` for a focus-indicator failure, `AR-11` for an unlabelled control, `AR-15` for focus not restored, `TR-05` for a coverage shortfall, and so on. A finding you cannot map to a requirement is still reported, flagged as unmapped.

Then state the gate verdict against PRD §12.3 thresholds:

| Metric | Threshold |
|---|---|
| axe critical | 0 |
| axe serious | 0 |
| Lighthouse accessibility | ≥98 every route |
| Contrast violations | 0, all four themes |
| Coverage | ≥90% primitives / ≥85% components |
| APG keyboard rows tested | 100% |

**PASS or FAIL. Do not soften a FAIL.** If a moderate/minor finding is genuinely not a defect, propose a waiver entry for `docs/waivers.md` (rule ID, component, state, justification, WCAG SC, reviewer, date, re-review date) — but never propose waiving a critical or serious violation, and never adjust a threshold to make the gate green.
