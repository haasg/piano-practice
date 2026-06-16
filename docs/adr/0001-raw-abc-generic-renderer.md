# Raw-ABC contract: the app is a generic renderer

**Status:** accepted (2026-06-15)

The Instructor authors each Exercise as a raw ABC notation string (plus fingering, cue, hand, reps, stable id); the iPad app renders whatever it's handed and owns no musical vocabulary of its own. We chose this so the Instructor can assign *any* material it judges helpful (minor scales, arpeggios, reading snippets, an excerpt from a song the Learner is learning) rather than re-weighting a fixed in-page menu.

This **deliberately gives up** the earlier guarantee that "unknown input is silently dropped, so the agent cannot break the app." That guarantee is replaced by: (1) the Instructor self-validates every Exercise with `ABCJS.parseOnly` (zero warnings) before it may commit a Plan, and (2) the app gracefully skips any item that won't render and falls back to the last-good Plan, so malformed output never strands the Learner.

## Considered options

- **Structured exercise spec compiled to ABC by the app** — safer notation correctness, but every new notational feature (tie, triplet, second voice, repeat) requires extending the app's compiler, which re-creates the fixed-vocabulary ceiling we're trying to remove. Rejected.
- **Fixed in-page vocabulary + whitelist (the pre-Instructor "Step 1" design)** — could not express the Learner's actual goals (all 24 scales incl. minors, sight-reading, real pieces). Superseded.

## Consequences

- Fingering correctness is the Instructor's responsibility (trusted against a canonical reference; not machine-verified). A wrong fingering is a minor annoyance the Learner can spot, not a broken app.
- The three separate workout files collapse into one generic Session player.
