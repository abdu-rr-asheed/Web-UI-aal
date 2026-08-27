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

## D-002 — Firefox would not launch in this environment (RESOLVED)

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session C |
| **Engines** | Firefox |
| **Severity** | **Blocked a project dependency, not a WCAG criterion** |
| **Status** | **RESOLVED 2026-08-25** — `npx playwright install --force firefox` |

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

**Resolution — 2026-08-25.** `npx playwright install --force firefox`
re-downloaded the browser and it now launches (Firefox 153.0). The first of the
three hypotheses above was therefore wrong in an instructive way: nothing was
blocking the binary, the download itself was **incomplete or corrupt**, and
every symptom pointed at the environment rather than at the artifact. The
OneDrive path — the hypothesis that felt most likely, because it is the unusual
thing about this machine — was irrelevant.

All 90 Firefox tests (`a11y-firefox` + `keyboard-firefox`) pass on the first
run, and the full eight-project matrix is green at **286/286**.

**What this unblocks.** TR-09's manual **NVDA + Firefox** pass, which had
accumulated as a gating item across all eighteen components, and the §13.3
participant study environment. Those are human tasks and remain outstanding —
but they are now possible.

**What it invalidates.** D-005 was recorded while Firefox was in this state.
It has been re-verified and largely retracted; see the correction there. A
divergence observed through a broken tool is a claim about the tool.

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

## D-005 — Headless Firefox and the document-boundary Tab case

| Field | Value |
|---|---|
| **Discovered** | 2026-08-22, Phase 2 Session D, CI `keyboard-firefox` |
| **Revised** | **2026-08-25 — the primary claim is RETRACTED** |
| **Engines** | Firefox (headless, Playwright) |
| **Severity** | **Test-environment artifact — NOT a user-facing barrier** |
| **Status** | RESOLVED by testing the criterion directly; entry corrected below |

> ### Correction — 2026-08-25
>
> **The headline claim of this entry was wrong, and it is retracted.**
>
> This was recorded while Firefox was unlaunchable locally (D-002), so it could
> only ever be observed through CI, and never re-checked directly. With Firefox
> reinstalled and working (153.0), the behaviour was measured against the real
> docs site on all three engines:
>
> | Engine | First five `Tab` presses from page load |
> |---|---|
> | Chromium | skip link → Home → Components → Audit reports → Save changes |
> | **Firefox** | **identical to Chromium** |
> | WebKit | Components → Save changes → Cancel → Delete → Saving (every link skipped) |
>
> Firefox seeds document focus correctly and walks the tab order exactly like
> Chromium. "Focus never moved off `body`" **does not reproduce**.
>
> **What does survive** is the narrower second observation, re-verified: at the
> *document boundary*, `Tab` from the last focusable element leaves
> `activeElement` unchanged in Firefox where Chromium reports `body`. That is
> genuinely unobservable from inside the page, and it still justifies the
> boundary exclusions in the current test.
>
> **Why this matters more than the correction itself.** The original entry
> attributed a broken tool's behaviour to an engine, and it read as a confident
> finding for three days. A cross-engine register is only as good as the
> environment it was gathered in — and a divergence observed through a
> malfunctioning browser is a claim about the browser installation, not about
> the browser. Anything recorded against Firefox before 2026-08-25 deserves the
> same scrutiny; D-005 was the only such entry.

**Originally observed.** The keyboard-trap test pressed `Tab` 25 times and
asserted focus never stayed on one element for 3 consecutive presses. Chromium
passed; Firefox reported a run of **22**.

**Assessment — and why this one is NOT a finding.** Unlike D-001, it reflects
nothing a real user would experience. Reporting it as an accessibility barrier
would have been a false positive, and a barrier register padded with false
positives is worth less than one that is short and true. That reasoning was
right; the diagnosis attached to it was not.

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

---

## D-007 — Playwright's project-level `forcedColors` does not reach the default `page` fixture

| Field | Value |
|---|---|
| **Date** | 2026-08-25 |
| **Environment** | Playwright 1.62.1, Chromium 151, Windows 11 |
| **Severity** | **High — a configured quality gate was silently testing the wrong mode** |
| **Status** | WORKED AROUND, with a guard test that makes recurrence impossible |

**Observed.** A project declared as

```ts
{ name: 'forced-colors', use: { ...devices['Desktop Chrome'], forcedColors: 'active' } }
```

runs its tests with `matchMedia('(forced-colors: active)').matches === false`.
Every `@media (forced-colors: active)` rule in the page is inert.

**Isolated.** Within the same project and the same test:

| How the mode is requested | `matches` |
|---|---|
| `use: { forcedColors: 'active' }` on the project | `false` |
| `browser.newContext({ forcedColors: 'active' })` | `true` |
| `page.emulateMedia({ forcedColors: 'active' })` | `true` |

`testInfo.project.use` contains `"forcedColors": "active"`, so the option is
resolved and simply not applied to the fixture's context. Two sibling options
behave differently from each other on the same project: `colorScheme: 'dark'`
**does** propagate, `reducedMotion: 'reduce'` does **not**. That asymmetry is
what rules out a config mistake on our side.

**Why this is worse than an ordinary bug.** A forced-colors media block is
*inert* outside forced-colors mode. It changes nothing, breaks nothing, and
raises no error. A suite running in normal rendering therefore has nothing to
trip over: it passes, reports green, and proves nothing whatsoever about the
mode it claims to cover. There is no failure to notice.

Every forced-colors assertion written against this project before 2026-08-25
would have been in that state — but the project was matching **no test files at
all**, so the question never arose. It was empty for four sprints. A configured
Playwright project with zero matching tests exits zero, which is indistinguishable
from a passing suite in CI.

**Resolution.**

1. `e2e/forced-colors/navigation.spec.ts` calls
   `page.emulateMedia({ forcedColors: 'active' })` in `beforeEach`.
2. Its first test asserts `matchMedia('(forced-colors: active)').matches` is
   `true` and fails with "forced-colors emulation is not on — this suite proves
   nothing" otherwise. **That guard is the only reason any of this was
   visible.** The pattern is now used in the reflow suite too, which asserts its
   own viewport width before asserting anything about layout.
3. The project's `forcedColors` option is kept, because it correctly scopes the
   project and records intent, with a comment pointing here.

**A real defect this uncovered.** With the mode genuinely on, the suite found
`forced-color-adjust: none` in `button.css` and `select.css`. The property is
**inherited** and means "do not force colours in this subtree", so it
re-admitted every author colour declared *outside* the media block — including
`.aal-button:hover`'s background — into the one mode whose entire purpose is to
replace author colours with the user's palette. It had been shipped since
Sprint 1 in the belief that it was needed to keep the button's boundary
visible; it is not, because the system colour keywords in the same block are
honoured without it. Both declarations were removed, and a test now asserts the
button still has a rendered border.

**Methodological note.** D-007 is not an engine divergence — it is a **tooling**
divergence, and it is the more dangerous kind. An engine divergence produces a
failing test on one engine, which is loud. A tooling divergence produces a
passing test everywhere, which is silent. For RQ5 the distinction matters: this
is evidence that "the CI gate covers X" is a claim requiring its own evidence,
not something inferable from the presence of a job named after X.

**Generalised into a rule.** Any suite whose assertions depend on an emulated
environment — forced colours, a viewport, a colour scheme, reduced motion —
must assert that the environment is in effect before asserting anything about
it. Two such guards exist now; more are needed as the emulated suites grow.

---

## D-008 — WebKit does not focus a button or a link on click

| Field | Value |
|---|---|
| **Date** | 2026-08-25 |
| **Environment** | Playwright WebKit (Safari engine), all platforms |
| **Severity** | Methodological — determines how focus assertions must be written |
| **Status** | RESOLVED by driving focus assertions with the keyboard; extends D-001 |

**Observed.** Against plain markup, no AAL involved:

```html
<button id=a>A</button><a href="#x" id=l>L</a><input id=i>
```

| Action | `document.activeElement` |
|---|---|
| `click('#a')` (button) | **`<body>`** — not focused |
| `click('#l')` (link) | **`<body>`** — not focused |
| `document.getElementById('a').focus()` | the button — programmatic focus works |

**Tab order, measured against the live docs site** (`link, button, input, link, button`):

| Engine | Sequence |
|---|---|
| Chromium | link → button → input → link → button |
| Firefox | link → button → input → link → button |
| **WebKit** | **button → input → button** — every link skipped |

> **Correction, 2026-08-25.** This entry originally said WebKit excludes
> *buttons and links* from the tab sequence. That is wrong about buttons, and
> the error came from misreading an earlier probe: `Tab` from the last
> focusable element reached `<body>` simply because it was the end of the
> document, and I read it as the button being skipped. Re-measured with the
> elements ordered so the two cases are distinguishable, **buttons are in
> WebKit's tab sequence and links are not.** The click behaviour below was
> directly observed and stands — and applies to links as well as buttons.

**Cause.** WebKit's default keyboard-navigation model omits links, reachable on
macOS only when "Press Tab to highlight each item" is enabled, and clicking
neither a button nor a link focuses it. Long-standing Safari behaviour that
Playwright's WebKit inherits on every platform. D-001 recorded the link half of
the tab-order story; the **click** half is the new and more consequential
finding.

**Why the click half matters more.** A test that clicks a trigger and then
asserts something about focus is, on WebKit, asserting the engine's pointer
behaviour rather than the component's focus management. The trigger never held
focus, so there is nothing for the component to restore *to*. Three separate
assertions failed this way in Sprint 4:

| Test | What it looked like | What it was |
|---|---|---|
| Dialog returns focus to its trigger after Escape | focus restoration broken | the trigger was never focused |
| Pagination keeps focus on the pressed control | focus stolen on page change | the button was never focused |
| Docs-shell keyboard-trap sweep | a trap | budget exhaustion — unrelated, see below |

**Resolution.** Every focus-restoration assertion is now driven by the keyboard:
focus the trigger, press `Enter`. This is not a workaround for a failure — it
tests strictly more of the requirement. SC 3.2.2 and SC 2.4.3 are about what
happens to a keyboard user's position, and a pointer user who loses focus does
not notice. The keyboard path is the case that strands someone.

**Not a defect in AAL, and not a barrier for users.** A Safari user operating by
pointer does not need the button focused; a Safari user operating by keyboard
gets the correct behaviour, because they arrived by keyboard. The register
records this as an *artifact of how the test drove the browser*, distinct from
D-009 below, which is a real behavioural difference users experience. Pooling
the two would make "our CI found N cross-engine failures" meaningless.

**Cross-checked against Firefox, 2026-08-25.** With Firefox working (D-002
resolved), all 90 Firefox tests pass unmodified — no engine-aware branching
needed anywhere. WebKit is the only engine requiring it, which is worth stating
plainly: the cross-engine cost of this project is concentrated in one engine
rather than spread across three.

**Unrelated finding in the same run.** The docs-shell keyboard-trap sweep is
O(focusables on the page) with four browser round trips each, and Sprint 4
roughly doubled the docs shell's control count by dogfooding five components
into it. It passes in 30s in isolation and exceeded 90s under six-worker
contention. Given an explicit 240s budget rather than reduced coverage: a trap
on the one control that was not swept is exactly what it exists to find, and
with `retries: 0` a slow pass can never be a flake being absorbed.

---

## D-009 — Native radio-group arrow keys wrap in Chromium and clamp in WebKit

| Field | Value |
|---|---|
| **Date** | 2026-08-25 |
| **Environment** | Playwright Chromium 151 vs WebKit, plain HTML |
| **Severity** | **Real behavioural divergence — users experience this** |
| **Status** | RECORDED; assertion split per engine, neither branch weakened |

**Observed.** With three native radios in one group and no JavaScript at all:

| Engine | `↓` from the last radio | `↑` from the first radio |
|---|---|---|
| Chromium | wraps to the first | wraps to the last |
| WebKit | **stays on the last** | **stays on the first** |

**Cause.** Arrow-key navigation within a same-`name` radio group is implemented
by the browser. The APG specifies wrapping; WebKit clamps. Neither engine is
violating a WCAG criterion — SC 2.1.1 requires the group be operable by
keyboard, which it is on both — but the interaction differs, and a user moving
between browsers will notice.

**Why this one is important to the research.** `AalRadioGroup` deliberately
delegates to the platform rather than using `AalRovingTabindex`, on the grounds
that re-implementing behaviour assistive technology already understands is what
PRD §6.3.1 warns against (recorded in D-006). D-009 is the **measurable cost of
that decision**: delegation buys correct AT integration and gives up
cross-engine consistency.

That trade is real in both directions, and the dissertation should report both
halves. It is also a concrete example of something no single-browser audit can
find — the component is conformant on every engine and behaves differently on
each, which is precisely the class of finding PRD §17 R9 anticipates.

**Resolution.** `e2e/keyboard/radio-group.spec.ts` asserts per engine. **Not
skipped:** both branches verify the same underlying requirement — that arrow
keys move focus and selection *together*, which is what makes a radio group one
control rather than three — and each states what its engine actually does at the
boundary. On WebKit the clamped press moves nothing and therefore selects
nothing, and the test asserts exactly that.

**Open question for the AT study.** Whether screen-reader users of Safari
experience the clamping as a barrier is not answerable from here. It is a
candidate probe for the November sessions (PRD §13.3) and is logged in the
barrier register as an unverified hypothesis rather than a finding.
