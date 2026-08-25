# ADR-0008 — Manual tab activation as the default for Tabs

**Status:** Accepted
**Date:** 2026-08-25
**PRD reference:** §9.7, Appendix D
**Supersedes / superseded by:** —

---

## Context

The APG Tabs pattern permits two activation models:

- **Automatic** — moving focus with an arrow key immediately selects that tab
  and displays its panel.
- **Manual** — arrow keys move focus only; `Enter` or `Space` selects.

Both are conformant. The APG's guidance is that automatic activation is
appropriate "when it is possible for panel content to be displayed instantly",
and manual otherwise. A component library must pick a default, because the
majority of consumers will never change it.

Most libraries default to automatic, and the reason is legitimate: with a mouse
it is one click either way, and automatic feels more responsive when arrowing
with a keyboard through cheap panels.

## Decision

**`AalTabs` defaults to `activation="manual"`. Automatic is available as an
opt-in, and the documentation states the APG's condition rather than presenting
it as a neutral preference.**

## Rationale

### What automatic activation does to a keyboard user

Consider a four-tab list, focus on tab 1, the user wanting tab 4. Under
automatic activation, `→ → →` selects tabs 2, 3 and 4 in turn. Every
intermediate panel is rendered.

For a sighted mouse user, none of that is visible. For everyone else:

- **Screen-reader users hear each intermediate panel announced.** Selection
  changes are announced, so reaching the tab they want means listening to two
  interruptions first and then finding their place again. On a wider tab list
  this becomes the dominant cost of using the component.
- **Panels that fetch data fire two requests nobody wanted.** Each may also
  announce its own loading and loaded states, compounding the previous point.
- **Switch-access and other slow-input users pay the cost per press**, and the
  presses are not free to begin with.

Manual activation makes arrowing a pure navigation act — look without
committing — and `Enter` the commitment. That maps to what the user is actually
doing.

### Why the default matters more than the option

Defaults are the library's real opinion. A consumer who has not thought about
activation mode should get the model that is safe for the panels they have not
described to us, including the expensive ones. A consumer who *has* thought
about it, and knows their panels render instantly, can opt in — and the fact
that they had to opt in is the record that they thought about it.

The APG attaches a condition to automatic activation. Defaulting to automatic
ships the behaviour and drops the condition.

### The cost, stated honestly

Manual activation costs one extra keystroke for a user who is arrowing through
cheap panels and wants to see each one. That is a real cost and it is smaller
than the costs above, because it is bounded at one press and it never surprises
anyone.

## Consequences

### Accepted

- One extra keypress to activate, always.
- Behaviour differs from Angular Material and several other libraries, so a
  migrating consumer may notice. The migration guide (DR-05) will call it out.

### Design consequences

- `AalTabsState.focusMoved(index)` is a no-op under manual activation. The
  activation policy lives in the L3 primitive, not in the styled component, so
  it is testable without a DOM and cannot drift between the two layers.
- Each tab is a real `<button>`, so `Enter` and `Space` activation comes from
  the platform. No key handler in AAL implements it, and therefore none can
  diverge from what assistive technology already expects.
- Arrow keys, `Home`/`End` and RTL inversion come from `AalRovingTabindex` in
  L2. `AalTabsState` claims exactly one key of its own — `Delete`, for
  closeable tabs — because it is the only one with no platform or L2
  equivalent.

### Enforced

- `libs/primitives/tabs/src/tabs.spec.ts` asserts that `focusMoved` changes
  nothing under manual activation and does select under automatic.
- `libs/components/tabs/src/tabs.spec.ts` asserts the same through the rendered
  component, by `getByRole` and `aria-selected`.
- `e2e/keyboard/tabs.spec.ts` asserts in a real browser that two `ArrowRight`
  presses leave the exposed `tabpanel` unchanged.

### Rejected alternatives

| Alternative | Why not |
|---|---|
| Automatic by default, manual opt-in | Ships the APG's conditional behaviour without its condition. The consumers who most need manual are the least likely to know the option exists. |
| Automatic, with a delay before selection | A timing-based workaround for a semantic problem, and it introduces its own SC 2.2.1 questions. |
| Infer from whether the panel has async content | Not knowable from the component's side, and a default that changes based on content is a default nobody can reason about. |

## References

- W3C WAI-ARIA APG, [Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — "Deciding When to Make Selection Automatically Follow Focus"
- WCAG 2.2 SC 2.1.1, 2.4.3, 3.2.1, 3.2.2
- PRD §9.7
