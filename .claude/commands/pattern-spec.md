---
description: Draft a PRD §9-format accessibility specification for a component that only has a §9.9 summary row
argument-hint: <component-name>
---

Write the full accessibility specification for **$1** in the exact table format used by `PRD.md` §9.1–§9.8, and save it to `docs/patterns/$1.md`.

## Source of truth, in priority order

1. **The W3C WAI-ARIA Authoring Practices Guide pattern** for `$1`. Use the `apg-spec-extractor` subagent to read the actual APG page and extract its keyboard interaction table — **do not write the keyboard table from memory**. Wrong key bindings are the single most common defect in this category of library, and reproducing them from recall is exactly how that happens.
2. The `$1` row in `PRD.md` §9.9, which fixes the role, key keyboard behaviour, focus rule and critical SC already decided.
3. `PRD.md` §5.2 (AR-01…AR-25) for the requirements every component must satisfy.
4. The nearest completed spec in §9.1–§9.8 for tone, depth and table shape.

## Required rows

| Aspect | Content |
|---|---|
| **APG pattern** | Named pattern, with a link. **If you are choosing between patterns, say which you rejected and why** — as §9.6 does for Disclosure Navigation vs `role="menu"`. That rationale is dissertation material. |
| **Element** | The native HTML element. ARIA only where no native element exists (AR-01). |
| **Role/semantics** | Rendered accessibility tree: role, accessible name source, name computation. |
| **Keyboard** | Complete APG interaction table, verbatim. Every key. Include RTL inversion where arrows are directional. |
| **Focus** | Before / during / after each interaction. Tab-stop count. Roving tabindex vs `aria-activedescendant`, and why. |
| **States** | Every ARIA state/property and what keeps it synchronised with the visual state (AR-16). |
| **Announcements** | Expected screen-reader output, and whether polite or assertive. |
| **Target size** | How ≥24×24 CSS px is met (AR-09). |
| **Forced colors** | Behaviour under `forced-colors: active` (AR-19). |
| **Reflow** | Behaviour at 320 CSS px (AR-17). |
| **SC covered** | Every WCAG 2.2 criterion the component is responsible for, bolding those new in 2.2. |
| **Known failure it prevents** | The real-world defect this component makes impossible. Ties the spec to the research motivation. |

## Rules

- Cross-check every SC number against `PRD.md` Appendix B. Getting a criterion number wrong in the dissertation is worse than omitting it.
- If the APG offers options (manual vs automatic activation, single vs multi-select), pick one as the default, state the trade-off, and flag that it needs an ADR.
- If `$1` genuinely has no APG pattern, say so and specify it from first principles against the POUR principles — do not force-fit an unrelated pattern.

Finish by listing the ADRs this spec requires, and note that §9.9 in `PRD.md` should be updated to point at the new full spec.
