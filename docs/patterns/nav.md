# Navigation Menu — accessibility specification

**Component:** `@aal/components/nav` · **Status:** implemented, awaiting manual screen-reader verification
**PRD reference:** §9.6 · **APG pattern:** [Disclosure Navigation Menu](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
**Decision record:** [ADR-0005](../decisions/ADR-0005-disclosure-navigation-not-role-menu.md)
**Last updated:** 2026-08-25

---

## Element and role

| Aspect | Specification |
|---|---|
| **Element** | `<nav aria-label>` → `<ul>` → `<li>` → `<a href>`, or `<button aria-expanded>` + nested `<ul>` for a section with children. |
| **Role** | Implicit throughout. `navigation` from `<nav>`, `list`/`listitem` from `<ul>`/`<li>`, `link` from `<a href>`, `button` from `<button>`. **Nothing is set explicitly.** |
| **What it is NOT** | No `role="menu"`, no `role="menuitem"`, no `role="menubar"`. See ADR-0005 — this is the defining decision of the component and it is asserted by test, not merely documented. |
| **Landmark name** | `label` is a required input. Two unnamed `<nav>` landmarks are indistinguishable in a screen reader's landmark list, which is how the landmark is most often reached. |

## Accessible name

- **The landmark** is named by `aria-label`, from the required `label` input.
- **Each link** is named by its text content.
- **Each submenu trigger** is named by its text content. The expand marker is a
  `<span aria-hidden="true">`, because `aria-expanded` already conveys the state
  and a screen reader announcing "triangle" adds nothing.
- **Each submenu `<ul>`** is named by `aria-labelledby` pointing at its trigger,
  so the user hears which section they have entered.

## Keyboard interaction

| Key | Context | Result |
|---|---|---|
| `Tab` | anywhere | Moves to the next item. Every top-level item is its own tab stop — see "Focus behaviour". |
| `Enter` / `Space` | on a submenu trigger | Toggles the submenu. Handled by the native `<button>`, not by AAL. |
| `Enter` | on a link | Navigates. Handled by the platform. |
| `Escape` | submenu open | Closes it and returns focus to its trigger. |
| `Escape` | collapsed viewport, panel open | Closes the panel and returns focus to the toggle. |
| `↓` | on a submenu trigger, submenu open | Moves focus to the first link in the submenu. |
| `↓` / `↑` | inside an open submenu | Moves between the submenu's links. Does not wrap. |
| `↓` / `↑` | on a top-level item | **Nothing, deliberately.** Binding arrows across the top level would make the component behave like a menubar, which is the application-menu model ADR-0005 rejects. |

Arrow support inside a submenu is optional in the APG pattern. It is implemented
because the PRD §9.6 keyboard row lists it: without it, reaching the fourth link
of an open submenu takes four `Tab` presses that also pass through the next
top-level trigger.

## Focus behaviour

| Moment | Behaviour |
|---|---|
| Tab order | **Standard document order.** Not roving `tabindex`. |
| On hover | Focus never moves. Hover opens nothing. |
| Submenu opens | Focus stays on the trigger. The user asked to reveal the links, not to jump into them. |
| Submenu closes by `Escape` | Focus returns to the trigger. |
| Focus leaves the `<nav>` | Any open submenu closes. |
| Restore target removed | Not applicable — the trigger is never removed by closing its own submenu. |

**Why standard tab order and not a single tab stop.** `AalTabs` makes the
opposite choice, and the difference is the point. A tab list is one control with
several settings; navigation is a set of destinations. A screen-reader user
expects to reach navigation links exactly as they reach every other link on the
page, and a single-tab-stop composite would hide them from that. The cost —
more `Tab` presses on a long navigation — is what SC 2.4.1 and the skip link
exist to address, and `AalSkipLink` is documented as a required companion.

## States and properties

| State | Attribute | Notes |
|---|---|---|
| Submenu expanded | `aria-expanded` on the trigger | On the trigger, never the panel. On the panel it is announced only once the user has already found their way in. |
| Submenu relationship | `aria-controls` on the trigger | Points at the `<ul>`, which exists only while open, so the reference can never dangle. |
| Current page | `aria-current="page"` on the link | From `AalNavItem.current`. |
| One open at a time | — | Policy held by `AalDisclosureSet` in L3. Two open submenus at a narrow viewport push the rest of the navigation off-screen with no reading benefit. |

## Hidden means hidden

A collapsed submenu is **removed from the DOM** (`@if`), and the collapsed
navigation panel is hidden with `display: none`.

Both remove the content from the accessibility tree. `visibility: hidden` and
`height: 0; overflow: hidden` do not: the links stay readable in browse mode, so
a screen-reader user reads links inside a submenu whose trigger reports itself
closed. This is the single most common failure of the pattern.

## Responsive behaviour

Below 48em the list collapses behind a disclosure trigger.

**There is one implementation, not two.** The same `<ul>`, the same `<li>`, the
same links, the same `aria-current`. Only CSS differs, plus a toggle button that
is `display: none` above the breakpoint — and therefore absent from the
accessibility tree there, so its `aria-expanded` never describes a list that is
permanently visible.

A parallel mobile implementation is how sites end up accessible at one viewport
and not the other, with only one of the two ever tested. The breakpoint is in
`em` rather than `px`, so a user browsing at 200% zoom (SC 1.4.4) gets the
collapsed layout at a wider viewport — which is the behaviour they need.

## Success criteria covered

1.3.1 · 2.1.1 · 2.1.2 · 2.4.1 · 2.4.3 · 2.4.5 · 2.4.7 · 2.4.8 · 2.5.8 · 3.2.3 · 3.2.6 · 4.1.2

## Verification

| Check | Where | Status |
|---|---|---|
| No `menu`/`menuitem` role in the DOM | `libs/components/nav/src/navigation.spec.ts` | PASS |
| No `menu`/`menuitem` in the **computed accessibility tree** | `e2e/keyboard/nav.spec.ts` | PASS (Chromium, Firefox, WebKit) |
| Escape closes and restores focus | unit + E2E | PASS |
| Focus leaving closes the submenu | unit | PASS |
| Submenu arrows | unit + E2E | PASS |
| Arrows NOT bound at top level | unit + E2E | PASS |
| Responsive collapse at 375px | `e2e/keyboard/nav.spec.ts` | PASS (Chromium, Firefox, WebKit) |
| Reflow at 320px, no horizontal scroll | `e2e/a11y/reflow.spec.ts` | PASS (Chromium — project is Chromium-only) |
| forced-colors: current page keeps a border | `e2e/forced-colors/navigation.spec.ts` | PASS (Chromium — Playwright emulates forced colours nowhere else) |
| axe, every documented state | `libs/components/nav/src/navigation.spec.ts` | PASS |
| Contrast, all themes | `tools/contrast-validator` | PASS |
| RTL | — | **NOT YET RUN** |
| SSR render + hydration | — | **NOT YET RUN** |
| NVDA + Firefox | — | **NOT YET RUN** — no longer blocked (D-002 resolved 2026-08-25); awaiting a human pass |
| VoiceOver + Safari | — | **NOT YET RUN** — no macOS device available |

The last four rows are open. They are listed rather than omitted because PRD
§18.2 requires reporting what is actually true.
