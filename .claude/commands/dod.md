---
description: Audit a component against the Definition of Done and report which boxes genuinely pass
argument-hint: <component-name>
---

Audit **$1** against the Definition of Done in `PRD.md` §11.3 (mirrored in `CLAUDE.md`).

For each of the 16 checkboxes, verify by **inspecting evidence**, not by inference:

| Box | Evidence that counts |
|---|---|
| Semantic HTML + composes L3 primitive | Read the component source; confirm no `aria-*` binding lives in L4 |
| Pattern spec written | `docs/patterns/$1.md` exists and matches the §9 table format |
| Unit tests, all states, jest-axe clean | Run them; count states in the spec vs states covered |
| Keyboard tests, one per APG row | Count rows in the §9 keyboard table vs `describe` blocks in `e2e/keyboard/$1.spec.ts` |
| Focus tests before/during/after | Read the assertions |
| Playwright a11y-tree snapshot ×3 browsers | Run it; confirm all three projects |
| Contrast, four themes | `reports/contrast/` output |
| forced-colors verified | Test or recorded manual check |
| Reflow 320px / 200% / text-spacing | Tests or recorded manual check |
| RTL verified | Test exists and passes |
| SSR + hydration, no ID mismatch | Test exists and passes |
| Zoneless render | Test exists and passes |
| **Manual NVDA + VoiceOver, dated** | A dated row in the component's "Tested with" table — **only the student can produce this** |
| Storybook page complete | Story + MDX with all seven §15.2 sections |
| Bundle budget | Build output size vs ≤6 KB gz |
| WCAG checklist rows | `reports/wcag-checklist/` records for every applicable SC |

## Rules for this audit

- **A box passes only with evidence you actually looked at.** "The test probably covers it" is a FAIL.
- A test that exists but is skipped, `.only`'d, or asserts nothing is a FAIL.
- A box you cannot verify is reported as **UNVERIFIED**, not as passing.
- The manual screen-reader box is almost always the outstanding one — say so explicitly rather than quietly ticking it.

## Output

A checklist with ✅ PASS / ❌ FAIL / ⚠️ UNVERIFIED per box, each with one line of evidence or the specific reason it fails. Then: **is `$1` done — yes or no**, and the shortest path to yes.

Be the reviewer who fails the work, not the author who defends it. An honestly-failed box found now costs an hour; found during the expert review in October it costs the claim.
