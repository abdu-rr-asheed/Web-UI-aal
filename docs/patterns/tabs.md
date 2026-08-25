# Tabs — accessibility specification

**Component:** `@aal/components/tabs` · **Status:** implemented, awaiting manual screen-reader verification
**PRD reference:** §9.7 · **APG pattern:** [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
**Decision record:** [ADR-0008](../decisions/ADR-0008-manual-tab-activation-by-default.md)
**Last updated:** 2026-08-25

---

## Element and role

| Aspect | Specification |
|---|---|
| **Tab list** | `<div role="tablist">` with `aria-label` or `aria-labelledby`, and `aria-orientation`. |
| **Tab** | `<button type="button" role="tab">`. A real button, so `Enter` and `Space` activation come from the platform. |
| **Panel** | `<div role="tabpanel">` with `aria-labelledby` pointing at its tab. |
| **Composition** | `<aal-tabs>` builds the tab list from projected `<aal-tab label="…">` children; each `<aal-tab>` renders its own panel. Panel content is **projected**, never a string input (PRD §7.11 rule 4) — a tab panel usually holds a form. |

## Accessible name

- **The tab list** is named by `label` → `aria-label`, or by `labelledBy` →
  `aria-labelledby` when the name already exists on the page as a heading.
- **Each tab** is named by its `label` input.
- **Each panel** is named by `aria-labelledby` pointing at its tab, so entering
  the panel announces which tab it belongs to.

## Keyboard interaction

One row per APG interaction-table row. Each has a `describe` block named after
it in `libs/components/tabs/src/tabs.spec.ts`.

| Key | Result | Implemented by |
|---|---|---|
| `Tab` | Moves focus into the tab list at the selected tab, then out of it to the page. The list is **one** tab stop. | `AalRovingTabindex` (L2) |
| `→` / `←` | Move focus between tabs, horizontally. Wraps. Skips disabled tabs. | `AalRovingTabindex` (L2) |
| `↓` / `↑` | The same, when `orientation="vertical"`. | `AalRovingTabindex` (L2) |
| `Home` / `End` | First / last tab. | `AalRovingTabindex` (L2) |
| `Enter` / `Space` | Activates the focused tab. | The native `<button>` |
| `Delete` | Closes a closeable tab and moves focus to a neighbour. | `AalTabsState` (L3) |
| RTL | `→` and `←` invert; `↓` and `↑` do not. | `AalRovingTabindex` (L2) |

**`AalTabsState` claims exactly one key.** Everything else already has a correct
implementation one layer down or in the platform, and re-implementing it here
would put the same behaviour in two places — which is the duplication the layer
split exists to prevent (PRD §7.2).

## Activation mode

**Manual by default.** See ADR-0008 for the full argument. In short: under
automatic activation, arrowing from the first tab to the fourth renders two
panels the user never asked for, and a screen-reader user hears each announced
on the way past.

`activation="automatic"` is available. The APG permits it only when panel
content displays instantly, and that condition is stated wherever the option is.

## Focus behaviour

| Moment | Behaviour |
|---|---|
| Tab order | Single tab stop, roving `tabindex`. |
| Re-entering the list | Lands on the tab the user left, not the first one. |
| Arrow keys, manual activation | Focus moves; selection does not change. |
| Tab from the list | Moves into the selected panel, or past it — see below. |
| Closing a tab | Focus moves to the following tab, or the preceding one if the last was closed. Never to `<body>`. |
| Selected tab becomes disabled | Selection re-resolves to the nearest enabled tab, so `aria-selected` is never true on nothing. |

### Panel focusability

`tabindex="0"` is applied to the panel **only when it contains nothing
focusable**, measured from the rendered DOM rather than declared by the author.

- A **prose panel** without it is unreachable by keyboard: the user tabs out of
  the list, straight past the content they just selected, with no way to scroll
  it without a mouse.
- A **panel containing a form** with it is an extra press before every field,
  forever.

Whether the content is focusable is a property of the content. Asking the author
to declare it is asking them to get it wrong, and to keep getting it wrong as
the content changes.

## States and properties

| State | Attribute | Notes |
|---|---|---|
| Selected | `aria-selected` on the tab | Exactly one tab at a time. |
| Panel relationship | `aria-controls` on the tab, `aria-labelledby` on the panel | Both from `AalTabsState`; ids never hand-written. |
| Orientation | `aria-orientation` on the tablist | Announced, so the user learns which arrows to reach for rather than discovering it by trial. |
| Disabled | `aria-disabled` on the tab | Not the native `disabled` attribute: a natively-disabled tab is unfocusable, so a screen-reader user cannot discover it exists. It is skipped by arrow keys and refuses selection. |
| Closeable | visually-hidden ", press Delete to close" | An icon alone tells a screen-reader user nothing about which key to press. |

## Hidden means hidden

An unselected panel carries the **`hidden` attribute**, which removes it from
the accessibility tree. `visibility: hidden` and `height: 0` do not — the
content stays readable in browse mode, so the user reads panels the tab list
says are not selected.

The panel stays in the DOM rather than being removed, so scroll position and
component state survive a round trip through another tab. Losing a
half-completed form because the user glanced at a neighbouring tab is a real
failure and a far less obvious one. `.aal-tabs__panel[hidden] { display: none }`
is declared explicitly, because `hidden` is only a presentation hint that any
`display` declaration would override — leaving the screen and the accessibility
tree disagreeing, which is worse than either failure alone.

## Reflow and overflow

The tab list **wraps**; it never becomes a horizontal scroller. A scroller is
operable with a pointer and with nothing else: the overflowed tabs stay
reachable by arrow key, but a sighted keyboard user cannot see where focus has
gone. Verified at 320px in `e2e/a11y/reflow.spec.ts`.

## Success criteria covered

1.3.1 · 1.4.10 · 1.4.11 · 2.1.1 · 2.4.3 · 2.4.7 · 2.5.7 · 2.5.8 · 4.1.2

## Verification

| Check | Where | Status |
|---|---|---|
| Every APG keyboard row | `libs/components/tabs/src/tabs.spec.ts` | PASS |
| Single tab stop, in a real tab order | `e2e/keyboard/tabs.spec.ts` | PASS (Chromium) |
| Manual activation renders no extra panel | unit + E2E | PASS |
| Panel focusability, both cases | unit + E2E | PASS |
| Selection re-resolves when a tab is disabled | unit + primitive | PASS |
| Focus after closing a tab | `libs/primitives/tabs/src/tabs.spec.ts` | PASS |
| Computed accessibility tree | `e2e/keyboard/tabs.spec.ts` | PASS (Chromium) |
| axe: default, vertical, automatic, panel-with-control | unit | PASS |
| Reflow at 320px, list wraps | `e2e/a11y/reflow.spec.ts` | PASS (Chromium) |
| forced-colors: selected tab keeps a border | `e2e/forced-colors/navigation.spec.ts` | PASS (Chromium) |
| Contrast, all themes | `tools/contrast-validator` | PASS |
| RTL arrow inversion, in a browser | — | **NOT YET RUN** (covered at L2 in jsdom only) |
| SSR render + hydration | — | **NOT YET RUN** |
| Text-spacing override | — | **NOT YET RUN** |
| NVDA + Firefox | — | **NOT YET RUN** — blocked by D-002 |
| VoiceOver + Safari | — | **NOT YET RUN** — no macOS device available |
