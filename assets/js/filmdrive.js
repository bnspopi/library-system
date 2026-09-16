/* ============================================================
   filmdrive.js — a clip that goes where the scroll bar points.

   Every clip on the site is driven by scrolling; none of them plays
   on its own. Seeking a paused video to each scroll position works,
   but it shows one still after another. A drive instead keeps a
   target time for the clip and lets it PLAY there: a short way
   forward is played through at a rate that catches up with the
   scroll, so the footage moves; a step back, or a long leap, is a
   seek. Once the clip has caught up it pauses and waits for the next
   turn of the wheel.

   LS.FilmDrive.of(video)   -> { to(t), stop(), destroy() }
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS = global.LS || {};

  var MAX_RATE = 3.0;      // the fastest a clip is played to catch up
  var MIN_RATE = 0.55;     // the slowest: the last stretch of a catch-up
  var LEAP = 2.4;          // seconds; further than this and it seeks instead
  var EPS = 0.045;         // seconds; closer than this and it has arrived

  var live = [];           // drives with somewhere to go
  var raf = 0;
  var gestured = false;    // play() is allowed once the visitor has touched the page

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function of(video) {
    var d = {
      video: video, target: -1, playing: false, active: false, noPlay: false,
      seekWanted: false
    };
    function onPause() { d.playing = false; }
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onPause);
    video.addEventListener('seeked', function () { if (d.active) wake(); });
    video.addEventListener('loadeddata', function () { if (d.active) wake(); });

    d.to = function (t) {
      if (!isFinite(t)) return;
      d.target = Math.max(0, t);
      if (!d.active) { d.active = true; live.push(d); }
      wake();
    };
    d.stop = function () {
      if (d.playing) { try { video.pause(); } catch (e) {} d.playing = false; }
      drop(d);
    };
    d.destroy = function () {
      d.stop();
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onPause);
    };
    return d;
  }

  function drop(d) {
    d.active = false;
    var i = live.indexOf(d);
    if (i > -1) live.splice(i, 1);
  }

  function wake() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick() {
    raf = 0;
    for (var i = live.length - 1; i >= 0; i--) step(live[i]);
    if (live.length) raf = requestAnimationFrame(tick);
  }

  function step(d) {
    var v = d.video;
    if (v.readyState < 2) return;                       // not decodable yet: wait for loadeddata
    var t = d.target, cur = v.currentTime, gap = t - cur;
    if (Math.abs(gap) < EPS) {                          // arrived
      if (d.playing) { try { v.pause(); } catch (e) {} d.playing = false; }
      drop(d);
      return;
    }
    if (gap < 0 || gap > LEAP || d.noPlay) {            // back, or a leap: seek
      if (d.playing) { try { v.pause(); } catch (e) {} d.playing = false; }
      if (v.seeking) return;                            // one seek at a time; 'seeked' wakes us
      try { v.currentTime = t; } catch (e2) {}
      return;
    }
    /* a short way forward: play it there, faster the further it is */
    var rate = clamp(gap * 2.2, MIN_RATE, MAX_RATE);
    if (!d.playing) play(d, rate);
    else if (Math.abs(v.playbackRate - rate) > 0.12) v.playbackRate = rate;
  }

  function play(d, rate) {
    var v = d.video;
    try { v.playbackRate = rate; } catch (e) {}
    d.playing = true;
    var p;
    try { p = v.play(); } catch (e2) { p = null; }
    if (p && p.catch) {
      p.catch(function () {
        /* not allowed to play (no gesture yet): fall back to seeking until
           the visitor has touched the page */
        d.playing = false;
        d.noPlay = !gestured;
        wake();
      });
    }
  }

  function onGesture() {
    gestured = true;
    live.forEach(function (d) { d.noPlay = false; });
  }
  document.addEventListener('pointerdown', onGesture, { once: true, passive: true });
  document.addEventListener('touchstart', onGesture, { once: true, passive: true });
  document.addEventListener('wheel', onGesture, { once: true, passive: true });
  document.addEventListener('keydown', onGesture, { once: true, passive: true });

  LS.FilmDrive = { of: of, live: live };
})(window);
