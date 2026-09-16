/* ============================================================
   clipbudget.js — how many clips may hold a decoder at once.

   The tour has around seventy clips in it. A paused <video> with a
   source still holds a decoder and a buffer, and a browser asked to
   keep seventy of those alive drops frames while you scroll. So a clip
   does not own its source: it asks for one.

   Every frame, whatever is on screen calls want(). That is a cheap
   note of the time. A sweep runs a few times a second and, only when
   more clips are loaded than the budget allows, releases the ones that
   have not been wanted for a while. Nothing is released the moment it
   goes off screen, so scrolling back and forth over a boundary cannot
   make a clip load, unload and load again.

   LS.ClipBudget.want(rec)  rec = { key, video, src, drive }
   LS.ClipBudget.drop(rec)  give it up now, whatever the budget says
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS = global.LS || {};

  var MAX = 20;            // a safety net; what you cannot see is dropped by name
  var GRACE = 2000;        // ms a clip must go unwanted before it can be released
  var SWEEP = 400;         // ms between sweeps

  var live = [];           // records that currently hold a source
  var timer = 0;
  var tally = { loads: 0, releases: 0, wants: 0, denied: 0, peak: 0, byKey: {} };

  function now() { return Date.now(); }

  function load(rec) {
    if (rec.__live) return;
    rec.__live = true;
    rec.loaded = true;
    try {
      rec.video.preload = 'auto';
      rec.video.src = rec.src;
      rec.video.load();
    } catch (e) {}
    live.push(rec);
    tally.loads++; tally.byKey[rec.key] = (tally.byKey[rec.key] || 0) + 1;
    if (live.length > tally.peak) tally.peak = live.length;
    if (!timer) timer = setInterval(sweep, SWEEP);
  }

  function release(rec) {
    if (!rec.__live) return;
    rec.__live = false;
    rec.loaded = false;
    rec.ready = false;
    rec.lastT = -1;
    rec.pendingT = undefined;
    if (rec.drive) { try { rec.drive.stop(); } catch (e) {} }
    if (rec.node && rec.node.classList) rec.node.classList.remove('is-ready');
    try { rec.video.pause(); rec.video.removeAttribute('src'); rec.video.load(); } catch (e) {}
    tally.releases++;
    var i = live.indexOf(rec);
    if (i > -1) live.splice(i, 1);
    if (!live.length && timer) { clearInterval(timer); timer = 0; }
  }

  /* Who gives way. A clip is fair game if its wish has gone stale, or if it
     matters less than the clip now asking. Between candidates the least
     important goes first, then the coldest. Two clips wanted in the same
     breath at the same rank never evict each other, so no pair can load and
     unload forever. */
  function makeRoom(t, pri) {
    var victim = null;
    for (var i = 0; i < live.length; i++) {
      var r = live[i];
      if (t - (r.wanted || 0) <= GRACE && (r.pri || 0) >= pri) continue;
      if (!victim ||
          (r.pri || 0) < (victim.pri || 0) ||
          ((r.pri || 0) === (victim.pri || 0) && (r.wanted || 0) < (victim.wanted || 0))) victim = r;
    }
    if (!victim) return false;
    release(victim);
    return true;
  }

  /** this clip is on screen, or about to be: keep it, and load it if there is
      room. pri 3 the frame you are looking at, 2 the one you are about to
      see, 1 a guess ahead of the scroll. */
  function want(rec, pri) {
    tally.wants++;
    pri = pri || 0;
    var t = now();
    rec.wanted = t;
    /* a rank only rises at once; it decays once the higher claim goes stale */
    if (pri > (rec.pri || 0) || t - (rec.priAt || 0) > GRACE) { rec.pri = pri; rec.priAt = t; }
    if (rec.__live) return;
    /* over budget and nothing to give way: stay on the poster and ask again
       next frame, rather than adding a decoder we cannot afford */
    if (live.length >= MAX && !makeRoom(t, pri)) { tally.denied++; return; }
    load(rec);
  }

  function drop(rec) { release(rec); }

  function sweep() {
    if (live.length <= MAX) return;
    var t = now();
    /* oldest wish first, and only wishes that have gone cold */
    var cold = live.filter(function (r) { return t - (r.wanted || 0) > GRACE; })
                   .sort(function (a, b) { return (a.wanted || 0) - (b.wanted || 0); });
    var over = live.length - MAX;
    for (var i = 0; i < cold.length && i < over; i++) release(cold[i]);
  }

  LS.ClipBudget = {
    want: want, drop: drop, sweep: sweep, live: live, tally: tally,
    get max() { return MAX; },
    set max(v) { MAX = Math.max(1, v | 0); },
    get grace() { return GRACE; },
    set grace(v) { GRACE = Math.max(0, v | 0); },
    count: function () { return live.length; }
  };
})(window);
