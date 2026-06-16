# The Instructor is a journal-keeping daily cloud agent

**Status:** accepted (2026-06-15)

The daily adapter is a stateful LLM "Instructor" that keeps a git-versioned **journal** (a coaching notebook about the Learner) which it reads and rewrites every run — not a deterministic, stateless on-device rule engine. We chose this because the Learner wants a piano *teacher* that pursues multi-week arcs, remembers what it assigned and what the Learner told it, and reasons toward the 6-month mission — none of which the existing on-device `PracticePlan.adapt` rules can do.

The journal is essential rather than incidental: because every Exercise is freshly authored ABC, the Instructor must record what each Exercise id was in order to interpret tomorrow's ratings of it. State, not just last-night's ratings, is what makes the loop a teaching relationship.

## Considered options

- **Stateless on-device `adapt()` only** — already works with zero infrastructure, but can only nudge rep counts on a fixed plan; no memory, no arc, no judgment. Kept solely as the offline fallback brain.
- **Vercel function computes the new plan deterministically on rating-receipt** (no cron, no agent, no journal) — simplest, but forecloses LLM judgment, which is the whole point. Rejected.

## Consequences

- Requires inbound plumbing the static app can't do alone: a Vercel relay holding the only secret (a GitHub write token) commits ratings to the repo; a daily ~4am `/schedule` cron runs the Instructor.
- The Instructor's "thinking" is legible over time through git history of the journal.
- v1 keeps journal + feedback in the public app repo for simplicity; revisit if the journal feels too exposed (a private data repo is the reversible upgrade).
