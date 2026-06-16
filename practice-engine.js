/* Piano Practice — shared comfort-rating + gentle adaptation engine.
   Used by every daily workout (scales, chords, progressions).

   What it does:
   - Stores a 1–5 "how comfortable did that feel?" score per exercise unit,
     keyed by (track, unitId) in localStorage, with a short history.
   - At the start of the next session, GENTLY reshapes the authored plan from
     those scores — without inventing exercises:
       1–2  → "boost": +1 rep, and surfaced to the front of its block.
       3    → unchanged.
       4    → "trim": one fewer rep (min 2).
       5    → "rest" it for a single day (the day after you nailed it);
              otherwise "light" (one fewer rep) so it stays alive.
   - Never empties a block: if every unit in a block would rest, they stay (light).

   The authored PLAN in each workout remains the backbone. This only prunes,
   reorders, and nudges rep counts — so the pedagogy you wrote stays intact.

   Storage is per-device (no backend) — your iPad and PC keep separate histories.
*/
window.PracticePlan = (function () {
  var STORE = 'pp-ratings-v1';

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveAll(o) {
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
  }
  function k(track, unitId) { return track + '␟' + unitId; } // unit separator, won't collide

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(isoA, isoB) {
    if (!isoA || !isoB) return null;
    var a = new Date(isoA + 'T00:00:00'), b = new Date(isoB + 'T00:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  /* The stored score for a unit, or null. */
  function record(track, unitId) { return loadAll()[k(track, unitId)] || null; }
  function lastScore(track, unitId) {
    var r = record(track, unitId);
    return r && typeof r.last === 'number' ? r.last : null;
  }

  /* Save a 1–5 score for a unit (called the moment the user taps it). */
  function rate(track, unitId, score) {
    score = Math.max(1, Math.min(5, parseInt(score, 10) || 0));
    if (!score) return;
    var all = loadAll(), key = k(track, unitId);
    var r = all[key] || { recent: [] };
    r.last = score;
    r.date = today();
    r.recent = (r.recent || []).concat(score).slice(-8);
    all[key] = r;
    saveAll(all);
  }

  /* Gentle adaptation. `units` is the authored, flattened plan:
       [{ id, label, block, reps }, ...]
     Returns { units: adjusted[], notes: string[] }.
     Each adjusted unit keeps its original fields plus { reps, status, lastScore }.
     status ∈ null | 'boost' | 'trim' | 'light' | 'rest' (rested units are removed). */
  function adapt(track, units) {
    var now = today();
    var annotated = units.map(function (u) {
      var r = record(track, u.id);
      var last = r && typeof r.last === 'number' ? r.last : null;
      var age = r ? daysBetween(r.date, now) : null;
      var reps = u.reps, status = null;
      if (last != null) {
        if (last <= 2) { reps = u.reps + 1; status = 'boost'; }
        else if (last === 3) { status = null; }
        else if (last === 4) { reps = Math.max(2, u.reps - 1); status = 'trim'; }
        else { // 5
          if (age === 1) { status = 'rest'; }            // nailed it yesterday → rest one day
          else { reps = Math.max(2, u.reps - 1); status = 'light'; }
        }
      }
      return Object.assign({}, u, { reps: reps, status: status, lastScore: last });
    });

    // Guardrail: a block must never become empty. If all its units rest, keep them (light).
    var byBlock = {};
    annotated.forEach(function (u) { (byBlock[u.block] = byBlock[u.block] || []).push(u); });
    Object.keys(byBlock).forEach(function (b) {
      var list = byBlock[b];
      if (list.length && list.every(function (u) { return u.status === 'rest'; })) {
        list.forEach(function (u) {
          u.status = 'light';
          u.reps = Math.max(2, (u.reps || 2) - 1);
        });
      }
    });

    // Drop rested units; within each block, surface boosted units to the front (stable otherwise).
    var kept = annotated.filter(function (u) { return u.status !== 'rest'; });
    var order = {}, n = 0;
    units.forEach(function (u) { if (!(u.block in order)) order[u.block] = n++; });
    kept.sort(function (a, b) {
      if (order[a.block] !== order[b.block]) return order[a.block] - order[b.block];
      var ab = a.status === 'boost' ? 0 : 1, bb = b.status === 'boost' ? 0 : 1;
      return ab - bb; // stable within Array.prototype.sort for equal keys in modern engines
    });

    // Human-readable summary for the banner.
    var rested = annotated.filter(function (u) { return u.status === 'rest'; }).map(function (u) { return u.label; });
    var boosted = kept.filter(function (u) { return u.status === 'boost'; }).map(function (u) { return u.label; });
    var notes = [];
    if (rested.length) notes.push('Resting ' + listOf(rested) + ' — you nailed ' + (rested.length > 1 ? 'them' : 'it') + ' last time.');
    if (boosted.length) notes.push('Extra focus on ' + listOf(boosted) + '.');

    return { units: kept, notes: notes };
  }

  function listOf(arr) {
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
  }

  /* Wipe all ratings (used by a "start fresh" control, if one is added). */
  function clearAll() { saveAll({}); }

  return {
    lastScore: lastScore,
    rate: rate,
    adapt: adapt,
    clearAll: clearAll
  };
})();
