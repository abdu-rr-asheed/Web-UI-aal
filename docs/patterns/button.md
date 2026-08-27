# Button — accessibility specification

**Component:** `@aal/components/button` · **Status:** implemented, awaiting manual screen-reader verification
**PRD reference:** §9.1 · **APG pattern:** [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
**Last updated:** 2026-08-22

---

## Element and role

| Aspect | Specification |
|---|---|
| **Element** | Native `<button>`. Never a `<div>` with a click handler. |
| **Why native** | Keyboard operation, implicit role, form participation, and platform accessibility-API integration come free and are not reproducible with ARIA. A `<div role="button">` needs hand-written `tabindex`, `Enter`/`Space` handling and a role, and still behaves differently under Windows High Contrast and in forms. |
| **Role** | Implicit `button`. Never set explicitly. |
| **Default `type`** | `button`, **not** the HTML default of `submit`. A button dropped into a form that silently submits gives a keyboard user an action they never asked for. |

## Accessible name

Resolution order, per the accessible name computation:

1. `aria-labelledby` (consumer-supplied, for a name held elsewhere on the page)
2. `ariaLabel` input → `aria-label`
3. Projected text content — **the preferred source** (PRD §7.11 rule 4)

Projected content is preferred because it is naturally localisable and cannot drift out of step with what is displayed on screen.

**Icon-only buttons.** There is no `iconOnly` input. `A11yAssertService` checks the *rendered* accessible name in dev mode, excluding `aria-hidden` and `[hidden]` subtrees. Projecting only a hidden icon therefore fails whether or not anyone remembered to set a flag.

> This assertion was initially broken: `computeName` used plain `textContent`, so an `aria-hidden` icon counted as a name and the check silently never fired in exactly the case it existed to catch. Fixed in `b9070c7`, with regression tests in `a11y-core`.

## Keyboard interaction

Inherited from the native element and deliberately not intercepted.

| Key | Result |
|---|---|
| `Enter` | Activates the button (on keydown) |
| `Space` | Activates the button (on keyup) |
| `Tab` | Moves focus to the button |
| `Shift + Tab` | Moves focus away from the button |

No custom key handling exists. Every additional handler is an opportunity to diverge from platform behaviour that assistive technology already understands.

## Focus behaviour

| Moment | Behaviour |
|---|---|
| Before | Standard document tab order |
| On focus | Two-tone ring: ≥2px width, ≥2px offset, one tone always ≥3:1 against the background behind it |
| While loading | **Retains focus.** Reports `aria-disabled`, not native `disabled` |
| While disabled | Not focusable — removed from the tab order by the native attribute |
| After activation | Unchanged; the button keeps focus |

**Why loading keeps focus.** A natively-disabled element cannot hold focus. Disabling the button the user just pressed throws their focus to `<body>` at the exact moment they are waiting to learn whether their action worked — they lose their place, and a screen-reader user loses their reading position entirely. The cost of `aria-disabled` is that the element stays clickable, so the component refuses activation explicitly in its handler. That trade is worth making.

## States and properties

| State | Attribute | Notes |
|---|---|---|
| Default | — | No `aria-pressed`, no `aria-expanded`. Adding them unconditionally would announce every button as an unpressed toggle. |
| Disabled | `disabled` | Native. Not focusable. |
| Loading | `aria-disabled="true"`, `aria-busy="true"` | Focusable. Spinner is `aria-hidden` — `aria-busy` already conveys the state, and exposing both says it twice. |
| Toggle | `aria-pressed="true\|false"` | Only when `pressed` is explicitly bound. |
| Disclosure | `aria-expanded`, `aria-controls` | `aria-controls` **must** reference an element that exists; a dangling reference is a real defect that axe fails. |
| Popup trigger | `aria-haspopup` | `menu`, `listbox`, `dialog`, `grid` or `tree`. |
| Described | `aria-describedby` | Consumer-supplied. Descriptive ARIA is permitted; state ARIA is not (PRD §7.11 rule 3). |

## Announcements

| Trigger | Politeness | Text |
|---|---|---|
| `announceLoading()` | polite | `loadingLabel`, or the configured `strings.loading` |

Loading is **not** announced automatically when the `loading` input changes. The component cannot know whether the change is worth interrupting for: a background refresh should be silent, a user-initiated save should not. The consumer calls `announceLoading()` when it is.

## Visual requirements

| Requirement | Implementation | SC |
|---|---|---|
| Target size | `min-block-size: var(--aal-target-comfortable)` (44px); `small` uses `--aal-target-min` (24px) | 2.5.8 |
| Text contrast | Semantic tokens, verified across three themes at build time | 1.4.3 |
| Boundary contrast | `--aal-color-action-border` ≥3:1 against the page | 1.4.11 |
| Focus indicator | Sealed Tier 4 tokens; consumer CSS cannot remove or shrink them | 2.4.7 |
| Not colour alone | Destructive intent is in the label, not only the colour | 1.4.1 |
| Reduced motion | Spinner stops rotating and shows a static indicator | 2.3.1 |
| Forced colors | `ButtonText`/`ButtonFace`; border forced visible, or the button becomes an unmarked patch of text | 1.4.11 |

## WCAG 2.2 success criteria

**Satisfied:** 1.3.1 · 1.4.1 · 1.4.3 · 1.4.11 · 2.1.1 · 2.1.2 · 2.4.7 · 2.4.11 · 2.5.8 · 4.1.2 · 4.1.3

**Not applicable at component scope:** 1.4.10 Reflow and 1.4.4 Resize Text are page-level; the button uses relative units and inherits correct behaviour but does not control layout.

## Known failure this component prevents

Icon-only buttons with no accessible name. A screen-reader user hears "button" with no indication of what it does — one of the most common findings in the WebAIM Million, and the default outcome of any component library that accepts an icon as a child without checking the result.

## Tested with

| Screen reader | Browser | Date | Result |
|---|---|---|---|
| NVDA | Firefox | — | **NOT YET RUN** — no longer blocked (D-002 resolved 2026-08-25); awaiting a human pass |
| NVDA | Chrome | — | **NOT YET RUN** |
| VoiceOver | Safari | — | **NOT YET RUN** |

> Button is **not** Definition-of-Done complete until these rows are filled with real dates. Automated tests cover roughly 20–30% of true WCAG failures (PRD §3.2.4); the manual pass is not a formality.

## Test coverage

| Level | Location | Count |
|---|---|---|
| Unit + axe (all 14 states) | `libs/components/button/src/button.spec.ts` | 49 |
| Keyboard conformance | Native behaviour; covered in unit tests | — |
| E2E accessibility tree | Pending — added when Button appears in the docs app | — |

## Open items

- [ ] Manual NVDA + Firefox pass — unblocked 2026-08-25, not yet performed
- [ ] Manual VoiceOver + Safari pass
- [ ] Playwright accessibility-tree snapshot once Button is used in the docs app
- [ ] Bundle-size measurement against the ≤6 KB gz budget
- [ ] Expert WCAG checklist row (§13.2), during the October review
