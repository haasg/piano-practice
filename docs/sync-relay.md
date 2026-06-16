# Sync relay — deploy & setup runbook

The **inbound sync relay** is a tiny Vercel serverless function (`api/feedback.js`) that
carries the iPad's session ratings + "note to your teacher" off-device and commits them
into this repo. It is a **pure transport**: it validates the payload's shape and writes it
verbatim to `feedback/<sessionDate>-<unique>.json`. It does no scoring or adaptation — that's
the Instructor (a later slice).

It holds the **only secret in the whole system**: a GitHub write token, kept server-side as
a Vercel env var. The static iPad app never sees it.

```
iPad app  ──POST ratings+note──▶  Vercel /api/feedback  ──commit──▶  haasg/piano-practice
 (no secret)                       (holds GITHUB_TOKEN)               feedback/<date>-*.json
```

You only need to do this once. After it's deployed you'll have a URL ending in
`/api/feedback` — paste that into `session.html` (one line) and the loop is live.

---

## 1. Create a fine-grained GitHub token (the secret)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `piano-practice-sync-relay`. Expiration: your choice (set a reminder to rotate).
3. **Resource owner:** `haasg`. **Repository access:** *Only select repositories* → **`haasg/piano-practice`** (just this one).
4. **Permissions → Repository permissions → Contents: Read and write.** (Leave everything else "No access".)
5. Generate, then **copy the token now** (`github_pat_…`) — GitHub won't show it again. Treat it like a password; never commit it.

Why fine-grained + single-repo + contents-only: if the token ever leaked, the blast radius is
limited to writing files in this one public repo — nothing else.

---

## 2. Create the Vercel project (serves only the function)

The function lives in this same repo under `api/feedback.js`. GitHub **Pages** keeps serving
the static site at `haasg.github.io`; Vercel will serve **only** the `/api` function from its
own `*.vercel.app` host. The two don't conflict.

1. Go to **vercel.com**, sign in with GitHub.
2. **Add New… → Project → Import** `haasg/piano-practice`.
3. Framework preset: **Other** (it's a static repo with an `api/` folder — no build needed).
   Leave Build/Output settings empty/default. Vercel auto-detects `api/*.js` as functions.
4. Before clicking Deploy, open **Environment Variables** and add:

   | Name             | Value                          | Required |
   |------------------|--------------------------------|----------|
   | `GITHUB_TOKEN`   | the `github_pat_…` from step 1 | **yes**  |
   | `GITHUB_REPO`    | `haasg/piano-practice`         | no (default) |
   | `GITHUB_BRANCH`  | `main`                         | no (default) |
   | `GITHUB_FEEDBACK_DIR` | `feedback`                | no (default) |

   Only `GITHUB_TOKEN` is mandatory; the rest already default to the values above in the code.
   Apply to **Production** (and Preview if you like).
5. **Deploy.** When it finishes, your function URL is:

   ```
   https://<your-project>.vercel.app/api/feedback
   ```

   (Open `https://<your-project>.vercel.app/api/feedback` in a browser — a `GET` returns
   `{"ok":false,"error":"method not allowed"}` with status 405. That 405 means it's live;
   the app only ever POSTs.)

> If you later change the env vars, hit **Redeploy** so they take effect.

---

## 3. Wire the app to the relay

1. In `session.html`, find near the top of the script:

   ```js
   var SYNC_ENDPOINT = '';   // <-- paste your deployed relay URL here
   ```

   Paste your full URL:

   ```js
   var SYNC_ENDPOINT = 'https://<your-project>.vercel.app/api/feedback';
   ```

2. **Bump the cache** so the iPad pulls the edited `session.html`: in `sw.js`, increment the
   `CACHE` string (e.g. `piano-practice-v7` → `piano-practice-v8`). *Do not* add the Vercel URL
   to `CORE` — it's a different origin, not a Pages asset.
3. Commit & push (Pages redeploys automatically). On the iPad, open the app, pull to refresh /
   reopen so the new service worker activates.

---

## 4. End-to-end test

1. On the iPad (or any browser at the live site), open **Today's Practice**, run a session to
   the end, optionally type a note, and tap **Send to your teacher & finish**.
2. The sync line at the top should flip to **"synced just now"** (green dot). If it says
   *"saved — will send when you're back online"*, the POST failed — see Troubleshooting.
3. In `haasg/piano-practice`, a new file appears at **`feedback/<today>-<random>.json`**
   containing exactly the payload (track, sessionDate, exercises, note, ratings).
4. Quick check without the app — from a terminal (replace the URL):

   ```bash
   curl -i -X POST https://<your-project>.vercel.app/api/feedback \
     -H 'Content-Type: application/json' \
     -d '{"track":"session","sessionDate":"2026-06-15","planGeneratedAt":null,"exercises":["demo"],"note":"hello","ratings":{"session_demo":{"last":4,"date":"2026-06-15","recent":[4]}}}'
   ```

   Expect `HTTP/.. 201` and `{"ok":true,"path":"feedback/2026-06-15-xxxxxx.json"}`, and a new
   file in the repo. (Delete that test file afterward.)

---

## Troubleshooting

- **405 on GET** — normal/healthy; the relay only accepts `POST`/`OPTIONS`.
- **500 `relay not configured`** — `GITHUB_TOKEN` env var isn't set on the Vercel project (or you set it but didn't redeploy).
- **502 `upstream commit failed`** — the token is wrong, expired, or lacks **Contents: write** on `haasg/piano-practice`; or `GITHUB_REPO`/`GITHUB_BRANCH` point somewhere that doesn't exist. Check the Vercel function logs (status code is logged server-side; the token is never logged or returned).
- **400 `invalid "ratings"` / `invalid "sessionDate"`** — the client sent a malformed body; shouldn't happen from the app.
- **Browser CORS error** — the relay allows `https://haasg.github.io` plus `localhost`/LAN origins. If you serve the app from a different host, add it to `ALLOWED_ORIGINS` in `api/feedback.js`.
- **Two sessions same day** — fine; each gets a unique random suffix, so they never overwrite.

## What the relay deliberately does *not* do

No scoring, no plan-writing, no adaptation (that's the Instructor, a separate daily cloud agent —
see `docs/adr/0002-instructor-journal-cloud-agent.md`). It commits the raw payload and stops.
The only secret is its env var; it is never returned to the client or written into a commit.
