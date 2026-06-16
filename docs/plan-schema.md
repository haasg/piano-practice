# Plan schema (the contract the Instructor writes)

The app reads exactly one file — `plans/today.json` — and renders it as today's **Session**. The Instructor (the daily cloud agent) is the author; the app is a generic renderer. See `docs/adr/0001-raw-abc-generic-renderer.md` for why the notation is raw ABC.

```jsonc
{
  "generatedAt": "2026-06-15",        // ISO date the Instructor wrote this Plan
  "coachNote": "string",              // the briefing shown at session start — what today focuses on and why
  "exercises": [
    {
      "id": "string",                 // STABLE unique id. The Learner's rating is keyed by this, and the
                                      //   Instructor must remember what each id was to read tomorrow's ratings.
                                      //   (ARCHITECTURE invariant #6). e.g. "2026-06-15-a-min-rh"
      "label": "string",              // short human title, e.g. "A natural minor — RH"
      "block": "string",              // optional grouping heading, e.g. "Scales" (exercises with the same block render together)
      "abc": "string",                // the engraved exercise as raw ABC, INCLUDING fingering annotations ("^3"note).
                                      //   MUST pass ABCJS.parseOnly with zero warnings (the Instructor self-gates this).
      "fingering": "string",          // optional plain-text line shown under the score (e.g. the LH fingering when the
                                      //   staff shows RH, or chord fingering). Supplements the in-ABC annotations.
      "hand": "RH | LH | HT",         // optional label shown as a pill
      "reps": 4,                      // clean-pass target (integer >= 1)
      "cue": "string",                // coaching cue shown under the prescription
      "tempo": 100                    // optional qpm for the audio "play" button (default 100)
    }
  ]
}
```

## Rules the Instructor must honor

- **`abc` parses clean.** Every exercise's `abc` must return zero warnings from `ABCJS.parseOnly` before the Plan may be committed. The app independently re-checks at load and **silently skips** any exercise that won't render (graceful degradation, ADR-0001).
- **Non-empty.** At least one renderable exercise, or the app keeps serving the last-good Plan.
- **Fits the budget.** The whole Session should be ~30–45 min of work (the Instructor's gate, not enforced by the app).
- **Stable ids.** Never reuse an id for a different exercise; the rating history (`pp-ratings-v1`, keyed `session␟<id>`) and the Instructor's journal both depend on id stability.

## Offline / first-run fallback

If `plans/today.json` can't be fetched and nothing is cached, the app renders a small built-in `DEFAULT_PLAN` so a Session is always available. `plans/today.json` is served **network-first** (see `sw.js`) so a fresh Plan always wins when online.
