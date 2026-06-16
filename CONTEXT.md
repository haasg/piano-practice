# Piano Practice

A single-user, offline-first PWA that delivers daily piano practice to the learner's iPad, and an automated daily LLM **Instructor** that adapts what's practiced based on how each exercise felt.

## Language

**Learner**:
The single human using the app — a self-directed adult pianist working toward learning pieces faster. There is exactly one Learner; the system is not multi-tenant.
_Avoid_: user (ambiguous with localStorage/device), student (reserve for the Instructor's model of the Learner)

**Instructor**:
The daily LLM agent that acts as the Learner's piano teacher — it reviews how recent practice felt and authors the next session. It has authority to assign **any** material it judges helpful, not just re-weight a fixed menu.
_Avoid_: adapter, brain, bot

**Plan**:
The data file the Instructor writes and the app reads, describing one upcoming **Session** as a list of **Exercises**. The app renders a Plan; it does not invent one.
_Avoid_: lesson, program

**Session**:
One sit-down practice run the app guides the Learner through, one Exercise at a time. ~15–45 min.
_Avoid_: workout (legacy term from the pre-Instructor build), lesson

**Exercise**:
The atomic unit of a Session — a single thing to play, carrying its own engraved notation (authored as raw ABC), fingering, a coaching cue, a hand, a rep target, and a stable id. The Instructor authors Exercises; the app is a generic renderer of them.
_Avoid_: drill, unit (reserve "unit" for nothing — use Exercise)

**Comfort rating**:
The Learner's 1–5 answer to "how comfortable did that feel?" tapped per Exercise. The primary feedback signal the Instructor reads.
_Avoid_: score, grade

**Track**:
A coarse label grouping Exercises (scales / chords / progressions today). Under the Instructor, Tracks are organizational labels, not separate engines.
_Avoid_: path, course

## Flagged ambiguities

- **"workout"** appears throughout the current code/filenames (`0002-workout.html`) but the resolved term is **Session**. Filenames may lag; prose should say Session.
- **"user"** is avoided in domain prose (collides with per-device localStorage identity). Say **Learner**.

## Example dialogue

— "When the Instructor writes tomorrow's Plan, can it add a minor scale we've never practiced?"
— "Yes — the Instructor can author any Exercise as raw ABC. The app renders whatever notation it's handed, so the Plan isn't limited to a fixed vocabulary."
— "And the Comfort ratings from today's Session feed back to it?"
— "Right — each Exercise the Learner rated 1–5 becomes the signal the Instructor reads before authoring the next Session."
