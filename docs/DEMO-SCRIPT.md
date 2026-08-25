# 3-Minute Demo Script — Angular Aria Library (AAL)

**For:** coordinator / supervisor progress check
**Date:** 22 August 2026
**Speaker:** M R A Rasheed (K2635673)

---

## Before you start (2 minutes of setup)

Open a terminal in the project folder and run these two commands in **two separate terminals**:

```bash
npm run start:docs
```

```bash
npm run storybook
```

Then open these three tabs in your browser, in this order:

| Tab | Address | What it shows |
|---|---|---|
| 1 | http://localhost:4200 | The live components |
| 2 | http://localhost:6006 | The documentation site |
| 3 | https://github.com/abdu-rr-asheed/Web-UI-aal/actions | The automated tests |

Put your browser in **light mode** to start. You will switch to dark mode during the demo.

---

## THE SCRIPT

Read the **bold** parts out loud. The *italic* parts tell you what to do.

---

### Part 1 — What the project is (30 seconds)

*Stay on Tab 1 (localhost:4200).*

> **My project is an accessible component library for Angular. It is called AAL.**
>
> **The problem is this. Almost ninety-six percent of websites fail accessibility rules. Developers use component libraries to build faster. But those libraries are not fully accessible. So the same mistakes repeat in every application.**
>
> **My library is different. Accessibility is not optional in it. It is built in, and it is checked automatically.**

---

### Part 2 — The components work (45 seconds)

*Point at the buttons on the screen.*

> **These are real components from my library. Four so far: Button, Link, Skip Link, and Visually Hidden.**

*Now press the `Tab` key slowly, about five times. A box will appear around each item.*

> **I am using only the keyboard. No mouse. You can see a clear outline on every item. This is important. Many users cannot use a mouse. If they cannot see where they are, they cannot use the site.**

*Press `Tab` once more from the top of the page. The "Skip to main content" link appears.*

> **This is a skip link. It lets a keyboard user jump past the menu. Without it, a user must press Tab thirty times on every single page.**

*Press `Enter`.*

> **Now focus has moved to the main content. Many websites only scroll the page and forget to move the focus. My component does both.**

---

### Part 3 — It adapts to the user (30 seconds)

*Switch your computer to dark mode. Windows: Settings → Personalisation → Colours → Dark.*

> **The library follows the user's own settings. I did not click a button here. I changed my operating system, and the colours changed with it.**
>
> **There are three themes: light, dark, and high contrast. All the colours in all three themes are checked automatically. One hundred and twenty colour checks. If any colour is too hard to read, the build fails and I cannot release it.**

---

### Part 4 — The documentation (20 seconds)

*Switch to Tab 2 (localhost:6006). Click "Components" then "Button".*

> **This is the documentation site. Every component has a page. Every page lists the keyboard keys, the screen reader behaviour, and which accessibility rules it follows.**

*Click the "Accessibility" tab at the bottom of the panel.*

> **This panel runs a real accessibility test on the component while you look at it. Green means it passed.**

---

### Part 5 — The automated testing (45 seconds)

*Switch to Tab 3 (GitHub Actions).*

> **This is the most important part of my research. Every time I save my work, the system runs the accessibility tests automatically.**

*Point at the green ticks.*

> **It tests in three different browsers: Chrome, Firefox, and Safari. Two hundred and forty-six tests in total.**
>
> **I also did an important experiment. I wrote a component on purpose with accessibility mistakes. Then I tried to add it to the project.**
>
> **The system rejected it. Five different checks caught it. But — and this is the interesting part — the normal build was successful. The code compiled perfectly.**
>
> **That is the whole point of my research. A broken, inaccessible component still compiles. Only an accessibility check will stop it.**

---

### Part 6 — Close (20 seconds)

> **So, to summarise. The foundation is complete. The automated checking works, and I have proved it works.**
>
> **Four components are finished. Next I will build the form controls, then the dialogs, then the data table.**
>
> **One thing I have found already. My tests found a problem that no automatic tool can see. If a button shows the word "Cancel" but is labelled "Close" in the code, a screen reader user is fine. But a person using voice control says "click Cancel", and nothing happens. The button does not work for them. My library now catches this automatically.**
>
> **The code is on GitHub. Thank you.**

---

## If they ask questions

**"Is it finished?"**
> **No. The foundation and four components are done. Twenty components are planned. Implementation finishes at the end of October, then evaluation in November.**

**"How do you know it is actually accessible?"**
> **Three ways. Automatic tests on every save. Then an expert review against the WCAG checklist. Then testing with real people who use screen readers. Automatic tools only find about twenty to thirty percent of real problems, so all three are needed.**

**"What is different from Angular Material?"**
> **Angular Material has some accessibility, but it does not guarantee it. Their documentation says the developer is responsible. In my library the developer cannot get it wrong — the build stops them.**

**"Are you on schedule?"**
> **Yes for the code. One thing is behind: I need ethics approval before I can test with disabled participants, and I need to start recruiting now because it takes several weeks.**

---

## Numbers you can quote

| Thing | Number |
|---|---|
| Components finished | 4 |
| Tests passing | 246 |
| Colour checks (3 themes) | 120 |
| Browsers tested | 3 |
| Commits | 15 |
| Accessibility checks that caught the bad component | 5 |

---

## Two honest points to mention

Say these. They show good research practice, not weakness.

1. > **I have not yet done the manual screen reader testing. Firefox will not start on my laptop, and Firefox with NVDA is my main test setup. I need to fix this before November.**

2. > **I have kept a record of problems that are caused by the browser, not by my code. For example, Safari does not move focus to links with the Tab key by default. I did not hide this. I wrote it down as a finding.**

---

## Backup plan

If the servers do not start, or the internet fails, show these files instead:

| File | What to say |
|---|---|
| `PRD.md` | **My full specification. Twenty sections.** |
| `docs/patterns/button.md` | **The accessibility specification for one component.** |
| `docs/reports/engine-divergences.md` | **Problems I found in the browsers themselves.** |
| `reports/contrast/latest.json` | **The colour checking results.** |

---

## Practice note

Read it once out loud with a timer. Aim for **2 minutes 30 seconds** of talking. That leaves 30 seconds for the demo to be slow, and time for one question.

If you are running out of time, cut **Part 4** (documentation). Keep Part 5 — the automated testing is the part that matters most.
