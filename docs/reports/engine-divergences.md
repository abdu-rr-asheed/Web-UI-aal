# Browser engine accessibility divergences

Running the same WCAG assertions across Chromium, Firefox and WebKit surfaces
behaviour that differs *by engine*, not by defect. PRD §17 R9 anticipates this
and directs that divergences be **recorded as findings** rather than retried
away or normalised into a passing test.

This register is an input to the barrier register (PRD §13.5) and to the
cross-method gap analysis (RQ5): a barrier that only exists on one engine is
still a barrier for the users of that engine, and it is invisible to any
single-browser audit — which is how most audits are run.

Each entry is dated and states what AAL does about it.

---

## D-001 — WebKit does not Tab to links by default

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session C, `e2e/a11y/docs-site.spec.ts` |
| **Engines** | WebKit (fails) · Chromium, Firefox (pass) |
| **WCAG SC** | 2.4.1 Bypass Blocks · 2.1.1 Keyboard |
| **Severity** | Serious for Safari users |
| **Automation-detectable** | Yes — but only by a cross-engine suite. Single-engine CI misses it entirely. |

**Observed.** Pressing `Tab` on a freshly loaded page in WebKit leaves
`document.activeElement` on `body`; `:focus` matches nothing. The skip link,
which is the first focusable element in the DOM and works in Chromium and
Firefox, is never reached.

**Cause.** Safari/WebKit ships with "Press Tab to highlight each item on a
webpage" **off** by default. In that mode `Tab` cycles only form controls;
links require `Option+Tab`. Playwright's WebKit build reproduces the default.

**Why it matters.** A skip link exists specifically so a keyboard user can
bypass repeated navigation. On default Safari, that affordance is unreachable
by the key users actually press. The page is still conformant — the link is
focusable and operable, and the platform provides an alternative — but the
real-world outcome for a Safari keyboard user is that the mechanism does not
exist unless they have changed a setting they may not know about.

**What AAL does.**
1. Does **not** attempt a workaround. Forcing link focusability against the
   platform's own convention (e.g. `tabindex="0"` on every link) would break
   the expectations of users who have deliberately configured Safari this way,
   and would be a worse outcome than the divergence.
2. The E2E assertion is engine-aware: on WebKit it verifies the link is
   focusable and operable, rather than asserting `Tab` reaches it. The test
   documents the reason inline so it cannot be mistaken for a skipped test.
3. Recorded here, and flagged for the expert review (PRD §13.2) and for
   discussion in the dissertation's limitations section.

**Open question for the usability study.** Worth asking any Safari/VoiceOver
participant whether they have this preference enabled. If AT users routinely
enable it, the practical impact is lower than the raw finding suggests — and
that would itself be a useful empirical result, because it is not something
the literature quantifies.

---

## D-002 — Firefox will not launch in this environment

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session C |
| **Engines** | Firefox |
| **Severity** | **Blocks a project dependency, not a WCAG criterion** |
| **Status** | OPEN — needs resolution before the evaluation phase |

**Observed.** `browserType.launch: spawn UNKNOWN` when Playwright starts the
bundled Firefox on this Windows machine. Chromium and WebKit launch normally.

**Why this is more than a CI annoyance.** PRD §6.6 names **NVDA + Firefox** as
the *primary* screen-reader pairing, both for developer verification (TR-09) and
for the November participant study (§13.3). Firefox is not an optional third
engine here; it is the reference environment for the project's main
accessibility evidence.

**Likely causes, in order of probability.**
1. Windows Defender / SmartScreen or corporate policy blocking an unsigned
   binary under `%LOCALAPPDATA%\ms-playwright`.
2. The repository living under a OneDrive-synced path with a space in it
   (`MSc SE`) — OneDrive placeholder files have caused `spawn UNKNOWN` before.
3. Missing Visual C++ runtime dependency.

**Next steps.** Try `npx playwright install --force firefox`; if that fails,
launch the binary directly to surface the OS-level error; if it is OneDrive,
move the working copy off the synced path. Until resolved, Firefox is excluded
from the local E2E run and CI (Ubuntu) is the only place Firefox coverage
happens — which is acceptable for automation but **not** acceptable for the
manual NVDA passes required by TR-09.

---

## D-003 — jsdom cannot evaluate colour contrast or pseudo-elements

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session C, unit run |
| **Environment** | jsdom (Vitest unit tests) |
| **Severity** | Methodological, not a defect |
| **Automation-detectable** | N/A |

**Observed.** The unit run emits `Not implemented: Window's getComputedStyle()
method: with pseudo-elements` repeatedly while axe executes.

**Consequence.** Unit-level axe silently cannot evaluate `color-contrast`, and
cannot see focus rings drawn with `::before`/`::after`. A component whose only
accessibility defect is insufficient contrast will pass every unit test.

**Why it is recorded rather than fixed.** This is the concrete, local
demonstration of the automation coverage ceiling that PRD §3.2.4 builds its
methodology on. It is the reason TR-04 and TR-08 mandate real browsers, and the
reason `e2e/a11y/docs-site.spec.ts` contains a test asserting the
`color-contrast` rule actually *executed* — a contrast rule that reports nothing
because it could not run is indistinguishable from a pass.

---

## D-004 — Lighthouse CI cannot clean up its Chrome profile on this Windows machine

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session D |
| **Environment** | Windows 11, local only |
| **Severity** | Blocks local TR-06 verification; does not affect CI |
| **Status** | ACCEPTED — CI is the system of record for Lighthouse |

**Observed.** `lhci autorun` completes every audit, then fails during teardown:
`EPERM, Permission denied: \?\C:\Users\...\AppData\Local\Temp\lighthouse.<id>`.
chrome-launcher cannot remove its temporary profile directory, and lhci exits 1
with no report written.

**Assessment.** The audits themselves ran to completion — the failure is in
cleanup, not measurement. Most likely Defender or another watcher holding a
handle on the temp directory, which is the same family of cause as D-002.

**Decision.** Not worked around locally. Lighthouse is a **page-level** gate
that only needs to run somewhere reproducible, and CI (ubuntu-latest) is that
place; a local pass would add no evidence CI does not already provide. The
locally-runnable half of the gate — ESLint, Stylelint, contrast validation,
Vitest/axe, and Playwright on Chromium and WebKit — is unaffected and still
gives fast feedback before pushing.

**Consequence to be honest about.** TR-06 cannot be verified on the author's
machine. Anyone reproducing this work on Windows should expect the same and
read the Lighthouse numbers from CI artefacts rather than from a local run.

---

## D-005 — Headless Firefox does not seed document focus, breaking Tab-walk tests

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session D, CI `keyboard-firefox` |
| **Engines** | Firefox (headless, Playwright) |
| **Severity** | **Test-environment artifact — NOT a user-facing barrier** |
| **Status** | RESOLVED by testing the criterion directly |

**Observed.** The keyboard-trap test pressed `Tab` 25 times and asserted focus
never stayed on one element for 3 consecutive presses. Chromium passed; Firefox
reported a run of **22** — focus never moved off `body`.

**Assessment — and why this one is NOT a finding.** Unlike D-001, this does not
reflect anything a real user would experience. Firefox is the primary NVDA
browser and Tab moves through links there normally; the cause is that headless
Firefox under Playwright starts with focus outside the document, so the first
`Tab` has nowhere to go from. Reporting it as an accessibility barrier would be
a false positive, and a barrier register padded with false positives is worth
less than one that is short and true.

**The distinction matters methodologically.** D-001 is a genuine platform
behaviour affecting real Safari users and is reported as such. D-005 is an
automation artifact and is reported as such. Both were surfaced by the same
cross-engine suite, and telling them apart required reasoning about the cause
rather than trusting the red X. Any cross-browser accessibility suite will
produce both kinds; the dissertation should say so, because "our CI found N
cross-engine failures" is a meaningless number if the two are not separated.

**Resolution (second iteration).** The first attempt — focus every element and assert Tab/Shift+Tab move away — still failed on Firefox, but for a different and more interesting reason: `Shift+Tab` from the FIRST focusable element hands focus to browser chrome, which headless Firefox does not have. Chromium reports `body`; Firefox leaves `activeElement` unchanged. Neither is wrong, and no page-level test can distinguish "focus left the document" from "focus did not move". The final test therefore excludes exactly two cases — Shift+Tab from the first focusable, Tab from the last — and asserts every in-document transition in both directions. That is the largest set of transitions the page can actually control and observe.

**Original resolution note — strictly stronger, not weaker.** The test no longer walks the
tab order. It now focuses *every* focusable element in turn and asserts that
both `Tab` and `Shift+Tab` move focus away from it. That is SC 2.1.2 stated
directly ("focus can be moved away"), it runs identically on all three engines
with no branching, and it covers more than the walk did — the walk only tested
wherever it happened to land, this tests every element in both directions.

**Process note.** This was nearly missed. Moving the keyboard suite out of
`e2e/a11y/` into `e2e/keyboard/` turned main green, but only because
`keyboard-firefox` was not in the CI matrix — the failing assertion had been
moved somewhere Firefox no longer looked. Adding `keyboard-firefox` and
`keyboard-webkit` to the matrix surfaced it. A green pipeline is only evidence
if you know what it is running.

---

## D-006 — jsdom does not implement native radio-group keyboard behaviour

| Field | Value |
|---|---|
| **Discovered** | 2026-08-25, Sprint 2, `libs/components/choice` |
| **Environment** | jsdom (Vitest unit tests) |
| **Severity** | Methodological — determines where a claim can be verified |
| **Status** | RESOLVED by moving the verification, not by weakening it |

**Observed.** Arrow keys in a native radio group do nothing under jsdom.
Focus does not move and selection does not change, so unit tests asserting the
APG Radio Group interaction rows fail.

**Cause.** Roving focus and arrow-key selection within a same-`name` radio
group are implemented by the **browser**, not by the DOM API. jsdom implements
the DOM, not the interaction layer built on top of it.

**Why this one matters more than it looks.** Relying on the platform for that
behaviour is the *central design decision* of `AalRadioGroup` — the component
deliberately does not use `AalRovingTabindex`, on the grounds that
re-implementing platform behaviour assistive technology already understands is
exactly what PRD §6.3.1 warns against. A test that cannot observe the
behaviour cannot verify the decision.

Worse, a jsdom test written to pass anyway would stay green if someone later
replaced the native radios with hand-rolled `div`s and key handlers — the one
regression that would actually break the design.

**Resolution.** The interaction rows moved to
`e2e/keyboard/radio-group.spec.ts`, where a real browser provides the
behaviour. Sixteen tests now cover the full APG table: single tab stop, Down
and Up wrapping with selection, Right and Left, and Tab returning to the
*checked* radio rather than the first.

What stays in jsdom is the **precondition**: every radio shares one name, sits
inside one fieldset, and carries no hand-rolled `tabindex`. Those are the facts
that make the browser behaviour apply, and they are exactly what a refactor
would break first.

**A real defect this uncovered.** Writing the E2E assertion against the
*computed accessibility tree* rather than the markup revealed that
`<fieldset>` maps to role `group`, not `radiogroup` — the markup looked
correct and the tree did not say what kind of group it was. An explicit
`role="radiogroup"` was added. This is precisely the case TR-04 exists for:
asserting DOM attributes would have passed.
