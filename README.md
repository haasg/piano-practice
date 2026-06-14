# Piano Practice

A small, installable web app for learning piano faster — scales, interactive fingering
trainers, live music notation with playback, and a home for your own sheet music.
Built to live on an iPad on the music stand: add it to the home screen and it runs
full-screen and **works offline**.

**Live site:** https://haasg.github.io/piano-practice/

## What's inside

- **Lessons** — short, self-contained interactive lessons. Currently:
  - *Five Scales, One Fingering* — the white-key "home" fingering (C G D A E).
  - *Twelve Scales, Three Shapes* — all 12 major scales as three fingering shapes, with an all-12 fingering trainer.
- **Notation Studio** (`notation-studio.html`) — renders scales as real engraved notation
  with fingerings above each note, plus audio playback. The engine for generated exercises.
- **Reference** — a printable chart of all 12 major-scale fingerings.

## Install on an iPad

1. Open the live site in **Safari**.
2. **Share → Add to Home Screen.**
3. Launch from the icon — full-screen, and offline once it has loaded once.

## Add your own sheet music

Drop PDFs into the `practice-material/` folder and add an entry to the `MATERIAL`
array near the bottom of `index.html`. They'll appear as cards on the home screen.

## Run locally

```sh
python -m http.server 8000
# then open http://localhost:8000
```
A service worker (offline cache) needs `http://localhost` or `https://` — it won't
register from a `file://` path.

## Tech

Plain HTML/CSS/JS — no build step. PWA via `manifest.webmanifest` + `sw.js`.
Notation and audio by [abcjs](https://www.abcjs.net/) (MIT), vendored in `vendor/`
so the app works offline.

When adding a lesson or asset, also add it to the `CORE` list in `sw.js` and bump the
`CACHE` version string, so it gets cached for offline use.
