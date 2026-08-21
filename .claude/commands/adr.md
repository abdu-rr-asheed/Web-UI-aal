---
description: Create the next-numbered Architecture Decision Record in docs/decisions/
argument-hint: <short decision title>
---

Create an ADR for: **$ARGUMENTS**

1. List `docs/decisions/` and take the next free number (the index in `PRD.md` Appendix D reserves ADR-0001 … ADR-0011).
2. Write `docs/decisions/ADR-NNNN-<kebab-title>.md` using the template below.
3. Add the row to the ADR index in `PRD.md` Appendix D.

```markdown
# ADR-NNNN — <Title>

- **Status:** Accepted | Proposed | Superseded by ADR-XXXX
- **Date:** <YYYY-MM-DD>
- **Decider:** M R A Rasheed
- **PRD sections:** §x.y
- **Requirements affected:** FR-xx, AR-xx

## Context

The forces at play. What made a decision necessary. Include the accessibility
constraint driving it — an ADR in this project should almost always cite a WCAG
success criterion or an APG pattern.

## Options considered

### Option A — <name>
Description. **Pros.** … **Cons.** … **Accessibility consequence.** …

### Option B — <name>
(at least two real options; "do nothing" counts when it is genuinely viable)

## Decision

What was chosen, stated plainly.

## Rationale

Why, in terms of the research objectives. If accessibility and developer
convenience conflicted, say so and say which won.

## Consequences

**Positive.** …
**Negative / accepted cost.** …
**Follow-up required.** …

## Verification

How we will know the decision was right — the test, gate or measurement that
would reveal it as wrong.
```

## Rules

- **Record real alternatives.** An ADR listing one option is documentation, not a decision record, and an examiner will notice.
- Be honest about costs. "Accepted cost: consumers cannot override the focus ring" is a stronger record than pretending there is no downside.
- If the decision reverses or narrows an earlier ADR, mark that one **Superseded** and link both ways.
- Keep it under a page. ADRs that sprawl stop being read.
