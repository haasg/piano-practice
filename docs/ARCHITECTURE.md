# Architecture

How the automated daily-adaptation loop fits together. High-level processes and the channels between them; the invariants every change must preserve.

## Processes & channels

```
┌─────────────────────────────────────────────────────────────────────┐
│ iPad PWA  (generic Session player — abcjs renderer + stepper)        │
│   • fetches today's Plan (raw-ABC Exercises) over GitHub Pages        │
│   • shows the Instructor's coach briefing + a sync/freshness badge    │
│   • Learner steps through, taps clean reps, rates each Exercise 1–5   │
│   • session end: optional "note to your teacher"                      │
└───────────┬──────────────────────────────────┬──────────────────────┘
            │ fetch Plan (network-first,        │ POST {ratings + note + stamp}
            │ cached; last-good offline)        │ (fire-and-forget; re-sends
            ▼                                    ▼  unsynced on next load)
┌───────────────────────┐          ┌────────────────────────────────────┐
│ GitHub Pages (public) │          │ Vercel function (holds GitHub PAT)  │
│  serves app + Plan     │          │  validates lightly, commits raw     │
└───────────▲───────────┘          │  feedback into the repo             │
            │ commit Plan + journal └───────────────┬────────────────────┘
            │                                        │ commit feedback
            │            ┌───────────────────────────▼───────────────────┐
            │            │ GitHub repo  haasg/piano-practice  (PUBLIC)    │
            └────────────┤  app + plans/  +  the student model:          │
                         │   journal (coach's notebook) + raw feedback   │
                         └───────────────▲───────────────────────────────┘
                                         │ read journal+feedback+mission,
                                         │ write tomorrow's Plan + journal entry
                         ┌───────────────┴───────────────────────────────┐
                         │ Instructor  — daily ~4am cron (/schedule)      │
                         │  LLM piano teacher. Reads everything since its │
                         │  last run; authors the next Session as raw ABC │
                         │  (notation + fingering + cue + reps + id);     │
                         │  self-validates with ABCJS.parseOnly; updates  │
                         │  its journal. Gates: parses / fits 30–45 min / │
                         │  non-empty, else keep last-good Plan.          │
                         └────────────────────────────────────────────────┘
```

## Ownership

- **App (iPad)** is a *generic renderer*. It owns no musical knowledge — no scale/chord libraries. It renders whatever ABC the Plan carries and collects ratings. One player, not three tracks.
- **Instructor** owns all musical intelligence: what to practice, how it's notated, fingering, sequencing, progression, the daily mix, and its own longitudinal memory of the Learner.
- **Plan** (`plans/…`, public repo) is the single channel from Instructor → app. Latest-wins.
- **Student model** (journal + raw feedback, same public repo for v1) is the Instructor's private working memory — read and rewritten every run.
- **Vercel function** is a pure relay holding the only secret (a GitHub write token). It does not adapt anything.

## Invariants

1. **The app can render any Plan the Instructor ships, or fail gracefully.** Every Exercise's ABC must parse before it can be committed (Instructor self-gates with `ABCJS.parseOnly`, zero warnings); the app skips any item that won't render rather than showing garbage. The old "silently drop unknown vocabulary" guarantee is gone — replaced by this.
2. **A broken or missing run never leaves the Learner stranded.** If generation fails a gate or the cron doesn't run, the app keeps serving the **last-good Plan** (network-first fetch, cached; `adapt()` survives only as the offline reshaping fallback).
3. **The session fits the time budget.** A Plan is bounded to ~30–45 min of estimated work; it can never hand over a 2-hour session.
4. **The only secret lives server-side.** The GitHub write token exists only in the Vercel function's env. The static app holds no credentials.
5. **The loop is observable.** The app shows plan freshness + sync status; unsynced ratings re-send on next load. Silent breakage is not acceptable.
6. **Feedback is per-Exercise and id-stable.** Because every Exercise is freshly authored ABC, the Instructor must assign each a stable id and remember (in the journal) what that id was, so a rating can be tied back to what was actually played.
7. **Cache discipline.** Any changed asset is added to `CORE` in `sw.js` and the `CACHE` version is bumped; `/plans/` stays network-first.

## Status

Design agreed (grill session 2026-06-15). Not yet built. The pre-Instructor "Step 1" fixed-vocabulary refactor is **superseded** by the generic-renderer + raw-ABC direction and will not be shipped as-is.
