#!/usr/bin/env node
/* Piano Practice — plan validator (the Instructor's daily gate).
 *
 * The Instructor (instructor/MISSION.md) runs this on the plan it just wrote BEFORE
 * committing. If it exits non-zero, the Instructor must NOT ship that plan — it keeps
 * the last-good plans/today.json instead and records the failure in its journal.
 *
 * Gates (all must pass):
 *   - shape:    generatedAt YYYY-MM-DD, non-empty coachNote, non-empty exercises[]
 *   - ids:      every exercise has a non-empty, UNIQUE id (ratings + journal key on it)
 *   - abc:      every exercise's abc parses with ZERO warnings via ABCJS.parseOnly
 *   - reps:     integer >= 1
 *   - budget:   total estimated minutes within ~25–50 (target 30–45; ~28s per clean pass)
 *
 * Usage: node instructor/validate-plan.js [path-to-plan.json]
 *        (defaults to plans/today.json next to this script's repo root)
 */
'use strict';

var path = require('path');
var fs = require('fs');

var REPO = path.join(__dirname, '..');
var ABCJS = require(path.join(REPO, 'vendor', 'abcjs-basic-min.js'));

var SECONDS_PER_PASS = 28;          // matches session.html estMinutes()
var MIN_MINUTES = 25, MAX_MINUTES = 50;

function fail(msg) { errors.push(msg); }
var errors = [];
var warnings = [];

var planPath = process.argv[2] || path.join(REPO, 'plans', 'today.json');

var plan;
try {
  plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
} catch (e) {
  console.error('FATAL: cannot read/parse ' + planPath + ' — ' + e.message);
  process.exit(1);
}

// --- shape ---
if (typeof plan.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.generatedAt)) {
  fail('generatedAt missing or not YYYY-MM-DD');
}
if (typeof plan.coachNote !== 'string' || !plan.coachNote.trim()) {
  fail('coachNote missing or empty');
}
if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) {
  fail('exercises must be a non-empty array');
  report();
}

// --- per-exercise ---
var seen = {};
var totalPasses = 0;

plan.exercises.forEach(function (ex, i) {
  var where = 'exercise[' + i + ']' + (ex && ex.id ? ' "' + ex.id + '"' : '');
  if (!ex || typeof ex !== 'object') { fail(where + ' is not an object'); return; }

  if (typeof ex.id !== 'string' || !ex.id.trim()) fail(where + ': id missing/empty');
  else if (seen[ex.id]) fail(where + ': duplicate id "' + ex.id + '"');
  else seen[ex.id] = true;

  var reps = parseInt(ex.reps, 10);
  if (!(reps >= 1)) fail(where + ': reps must be an integer >= 1');
  else totalPasses += reps;

  if (typeof ex.abc !== 'string' || !ex.abc.trim()) {
    fail(where + ': abc missing/empty');
  } else {
    var w;
    try {
      var t = ABCJS.parseOnly(ex.abc);
      w = (t && t[0] && t[0].warnings) || [];
    } catch (e) {
      fail(where + ': abc threw in parseOnly — ' + e.message);
      w = null;
    }
    if (w && w.length) {
      fail(where + ': abc has ' + w.length + ' parse warning(s): ' + w.join(' | '));
    }
  }

  if (ex.tempo != null && !(parseInt(ex.tempo, 10) >= 1)) {
    warnings.push(where + ': tempo present but not a positive integer (will default to 100)');
  }
});

// --- budget ---
var minutes = Math.round(totalPasses * SECONDS_PER_PASS / 60);
if (minutes < MIN_MINUTES) fail('session too short: ~' + minutes + ' min (' + totalPasses + ' passes); want ' + MIN_MINUTES + '–' + MAX_MINUTES);
if (minutes > MAX_MINUTES) fail('session too long: ~' + minutes + ' min (' + totalPasses + ' passes); want ' + MIN_MINUTES + '–' + MAX_MINUTES);

report();

function report() {
  console.log('Plan: ' + planPath);
  if (plan && Array.isArray(plan.exercises)) {
    console.log('Exercises: ' + plan.exercises.length + '  ·  passes: ' + totalPasses + '  ·  est ~' + minutes + ' min');
  }
  warnings.forEach(function (w) { console.log('  warn: ' + w); });
  if (errors.length) {
    console.error('\nINVALID — ' + errors.length + ' error(s):');
    errors.forEach(function (e) { console.error('  ✗ ' + e); });
    console.error('\nKeep the last-good plan; do not ship this one.');
    process.exit(1);
  }
  console.log('\nVALID ✓  — safe to commit.');
  process.exit(0);
}
