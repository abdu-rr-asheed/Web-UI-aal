# ADR-0005 — Disclosure Navigation Menu rather than `role="menu"` for site navigation

**Status:** Accepted
**Date:** 2026-08-25
**PRD reference:** §9.6, Appendix D
**Supersedes / superseded by:** —

---

## Context

Site navigation with expandable sections is one of the most common components on
the web, and it has two competing implementations that look identical on screen:

1. **Disclosure Navigation Menu** — a `<nav>` containing a `<ul>` of `<li>`, where
   each item is either an `<a href>` or a `<button aria-expanded>` that reveals a
   nested `<ul>` of links.
2. **`role="menu"`** — the WAI-ARIA application-menu pattern, with
   `role="menubar"`, `role="menuitem"`, and roving `tabindex`.

The second is widespread. It appears in production sites, in tutorials, and in
several component libraries, and it is chosen largely because "menu" is the word
people use for the thing on screen.

The two produce completely different experiences for a screen-reader user, and
the choice cannot be deferred to the consumer: it is baked into the markup a
component emits, and PRD §7.11 rule 7 makes any change to it semver-major.

## Decision

**`AalNav` implements the APG Disclosure Navigation Menu pattern. It emits no
`role="menu"` and no `role="menuitem"`, ever.**

`role="menu"` is used in exactly one AAL component — `AalMenu`, the Menu Button
— where the contents are *actions on the current page* rather than destinations.

## Rationale

### What `role="menu"` costs a screen-reader user

Screen readers operate in two modes. In **browse mode** the user moves through
the document with reading keys — next heading, next link, next landmark, read
line — which is how most of the web is consumed. In **application mode** those
keys are handed to the page, on the assumption that the page has its own
keyboard model. `role="menu"` is one of the roles that triggers the switch.

Applying it to site navigation therefore costs, concretely:

| | Effect |
|---|---|
| **Reading keys stop working** | Inside the navigation, the keys the user navigates the rest of the page with do nothing. |
| **The links stop being links** | `role="menuitem"` **overrides** the implicit link role. The user is not told that activating one will navigate. |
| **"List all links" loses the navigation** | Pulling up the links list is a primary orientation strategy, and the site's own navigation vanishes from it. |
| **The list stops being a list** | `<ul>` semantics are replaced, so "list, 5 items" and the position within it are gone. |
| **Tab no longer steps through the items** | A menubar is one tab stop; the user must know to switch to arrow keys. |

What is gained is a keyboard model borrowed from desktop application menu bars.
For a menu of actions that model is genuinely useful. For a list of links to
other pages, it replaces conventions the user already knows with conventions
they must discover.

### Why the disclosure pattern is not a compromise

It is not a weaker version of the menu pattern; it is a correct description of
what the component actually is. Site navigation is a list of links, some of
which reveal more links. `<nav>`, `<ul>`, `<a>` and `aria-expanded` say exactly
that, and every screen-reader convention continues to work because nothing has
overridden it.

The APG says so directly. Its Disclosure Navigation Menu example carries the
note that the `menu` role and its relatives are intended for menus that behave
like application menus, and that using them for site navigation is a common
mistake.

### The distinction, stated as a rule

> Does activating an item **navigate**, or does it **act on the current page**?
>
> Navigate → links in a list. Act → `role="menu"`.

`AalNav` and `AalMenu` sit on either side of that line, and their doc comments
cross-reference each other so the distinction is visible from either component.

## Consequences

### Accepted

- **Standard document tab order.** Every top-level item is its own tab stop.
  For a navigation of ten items that is ten `Tab` presses — more than a menubar
  would need. This is the right trade: a screen-reader user expects navigation
  links to be reachable exactly like every other link on the page, and the skip
  link (SC 2.4.1, shipped as `AalSkipLink` and documented as a required
  companion) is the mechanism WCAG provides for bypassing them.
- **Arrow keys are only bound inside an open submenu**, never across the top
  level. Binding them at the top level would reintroduce menubar behaviour by
  the back door.
- **No submenu-of-submenu support.** The disclosure pattern handles one level
  cleanly. Deeper nesting is a signal that the information architecture needs
  work, not that the component needs a feature.

### Enforced

The claim is asserted, not just documented:

- `libs/components/nav/src/navigation.spec.ts` asserts that `AalNav` exposes
  **zero** elements with role `menu` or `menuitem`, and that `AalMenu` exposes
  both.
- `e2e/keyboard/nav.spec.ts` asserts the same against the **computed
  accessibility tree** in a real browser, because a DOM-attribute assertion
  passes on markup the browser maps to something else — the mistake that let a
  `<fieldset>` masquerade as a `radiogroup` in Sprint 2.

### Rejected alternatives

| Alternative | Why not |
|---|---|
| `role="menu"` for both components | Costs the user everything in the table above, for navigation that gains nothing. |
| A `pattern: 'disclosure' \| 'menu'` input | Makes the wrong answer available and equally easy to reach. PRD §7.11 rule 3 exists because a library's job is to remove that choice, not to surface it. |
| `role="navigation"` on the `<ul>` | Redundant — the `<nav>` element already provides the landmark — and a second landmark is worse than none. |

## References

- W3C WAI-ARIA APG, [Disclosure Navigation Menu pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
- W3C WAI-ARIA APG, [Menu and Menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- WCAG 2.2 SC 1.3.1, 2.1.1, 2.4.1, 2.4.3, 2.4.5, 2.4.8, 3.2.3, 3.2.6, 4.1.2
- PRD §9.6, §7.11
