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
