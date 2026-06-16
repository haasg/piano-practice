/* Piano Practice — inbound sync relay (slice 2).
 *
 * A PURE TRANSPORT. The iPad app POSTs a session's ratings + "note to your teacher"
 * here; this function lightly validates the shape and commits the payload VERBATIM
 * into the repo at feedback/<sessionDate>-<unique>.json via the GitHub contents API.
 * It does NOT score, interpret, adapt, or rewrite plans — that is the Instructor
 * (slice 3), a separate daily cloud agent. See docs/ARCHITECTURE.md (invariant #4)
 * and docs/adr/0002-instructor-journal-cloud-agent.md.
 *
 * The only secret (a GitHub write token) lives server-side as the GITHUB_TOKEN env
 * var; it is never shipped to the client and never echoed in a response.
 *
 * Deploy/setup runbook: docs/sync-relay.md
 */

'use strict';

// --- Config (env-driven; only GITHUB_TOKEN is required) ----------------------
var REPO = process.env.GITHUB_REPO || 'haasg/piano-practice';
var BRANCH = process.env.GITHUB_BRANCH || 'main';
var FEEDBACK_DIR = process.env.GITHUB_FEEDBACK_DIR || 'feedback';

// Origins allowed to POST (the Pages site + local/LAN testing). Browsers send an
// Origin header; we echo it back when it matches, else fall back to the Pages site.
var ALLOWED_ORIGINS = [
  'https://haasg.github.io'
];
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.indexOf(origin) !== -1) return true;
  // localhost / 127.0.0.1 / LAN 192.168.x / 10.x on any port, http or https — for local testing.
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}

var MAX_BODY_BYTES = 256 * 1024; // cap the payload; a session's ratings are tiny.

function corsHeaders(origin) {
  var allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function send(res, status, headers, bodyObj) {
  res.statusCode = status;
  Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(bodyObj));
}

// --- Light validation: shape only, no interpretation -------------------------
function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  if (!body.ratings || typeof body.ratings !== 'object' || Array.isArray(body.ratings)) return 'missing or invalid "ratings" object';
  // sessionDate is what names the file; require a plausible YYYY-MM-DD.
  if (typeof body.sessionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.sessionDate)) return 'missing or invalid "sessionDate" (YYYY-MM-DD)';
  return null; // ok
}

// Per-call unique suffix so two sessions on one day don't collide. We don't read
// existing files (keeps the function a dumb relay + one API call); random suffix.
function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// --- GitHub commit (contents API PUT) ----------------------------------------
// Separated out and dependency-injectable so a test harness can mock `doFetch`.
function commitFeedback(payloadJson, sessionDate, token, deps) {
  deps = deps || {};
  var doFetch = deps.fetch || fetch;
  var suffix = (deps.uniqueSuffix || uniqueSuffix)();
  var path = FEEDBACK_DIR + '/' + sessionDate + '-' + suffix + '.json';
  var url = 'https://api.github.com/repos/' + REPO + '/contents/' + path;

  // commit the payload verbatim, pretty-printed, base64-encoded as GitHub requires.
  var contentB64 = Buffer.from(payloadJson, 'utf8').toString('base64');

  return doFetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'piano-practice-sync-relay'
    },
    body: JSON.stringify({
      message: 'feedback: session ' + sessionDate,
      content: contentB64,
      branch: BRANCH
    })
  }).then(function (r) {
    return Promise.resolve(r.text ? r.text() : '').then(function (text) {
      return { status: r.status, ok: r.ok, path: path, body: text };
    });
  });
}

// --- Body reader (Vercel may pre-parse req.body; otherwise read the stream) ---
function readBody(req) {
  // Vercel's Node runtime often parses JSON bodies onto req.body already.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) return Promise.reject(new Error('too large'));
      return Promise.resolve(safeParse(req.body));
    }
    return Promise.resolve(req.body); // already an object
  }
  return new Promise(function (resolve, reject) {
    var chunks = [], size = 0, aborted = false;
    req.on('data', function (c) {
      if (aborted) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) { aborted = true; reject(new Error('too large')); return; }
      chunks.push(c);
    });
    req.on('end', function () { if (!aborted) resolve(safeParse(Buffer.concat(chunks).toString('utf8'))); });
    req.on('error', reject);
  });
}
function safeParse(s) { try { return JSON.parse(s); } catch (e) { return { __parseError: true }; } }

// --- Main handler ------------------------------------------------------------
function handler(req, res) {
  var origin = req.headers && (req.headers.origin || req.headers.Origin);
  var cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    // Preflight. No body needed.
    res.statusCode = 200;
    Object.keys(cors).forEach(function (k) { res.setHeader(k, cors[k]); });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return send(res, 405, cors, { ok: false, error: 'method not allowed' });
  }

  var token = process.env.GITHUB_TOKEN;
  if (!token) {
    // Misconfiguration — but never reveal anything about the (missing) secret beyond this.
    return send(res, 500, cors, { ok: false, error: 'relay not configured' });
  }

  return readBody(req).then(function (body) {
    if (body && body.__parseError) {
      return send(res, 400, cors, { ok: false, error: 'invalid JSON' });
    }
    var bad = validatePayload(body);
    if (bad) {
      return send(res, 400, cors, { ok: false, error: bad });
    }

    var payloadJson = JSON.stringify(body, null, 2) + '\n';
    if (Buffer.byteLength(payloadJson, 'utf8') > MAX_BODY_BYTES) {
      return send(res, 413, cors, { ok: false, error: 'payload too large' });
    }

    return commitFeedback(payloadJson, body.sessionDate, token).then(function (result) {
      if (result.ok) {
        return send(res, 201, cors, { ok: true, path: result.path });
      }
      // Don't leak GitHub's (token-bearing context) error verbatim; log it server-side only.
      console.error('github commit failed', result.status, result.body);
      return send(res, 502, cors, { ok: false, error: 'upstream commit failed', status: result.status });
    });
  }).catch(function (err) {
    if (err && err.message === 'too large') {
      return send(res, 413, cors, { ok: false, error: 'payload too large' });
    }
    console.error('relay error', err && err.message);
    return send(res, 500, cors, { ok: false, error: 'internal error' });
  });
}

module.exports = handler;
// Expose internals for the throwaway test harness (and only that).
module.exports.handler = handler;
module.exports._internal = {
  validatePayload: validatePayload,
  commitFeedback: commitFeedback,
  corsHeaders: corsHeaders,
  isAllowedOrigin: isAllowedOrigin
};
