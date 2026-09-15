/* ============================================================
   motion.js — the animation layer
   Scroll reveals, counters, SVG draw-on, marquees, tilt,
   magnetic buttons, spotlight cursor, parallax, typewriter.
   No dependencies. Honours prefers-reduced-motion.
   ============================================================ */
(function (global) {
  'use strict';

  var reduced = global.matchMedia &&
                global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var Motion = {};
  Motion.reduced = reduced;

  /* ---------------------------------------------------------
     reveal — fade/slide elements in as they enter the viewport
     Markup: <div data-reveal>            (default: rise)
             <div data-reveal="left">     (rise|left|right|scale|blur)
             <div data-reveal data-delay="120">
             <div data-reveal-group>      (staggers direct children)
     --------------------------------------------------------- */
  function initReveal(root) {
    root = root || document;
    var groups = root.querySelectorAll('[data-reveal-group]');
    groups.forEach(function (g) {
      var step = parseInt(g.getAttribute('data-stagger') || '85', 10);
      Array.prototype.forEach.call(g.children, function (child, i) {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '');
        if (!child.hasAttribute('data-delay')) child.setAttribute('data-delay', String(i * step));
      });
    });

    var items = root.querySelectorAll('[data-reveal]:not(.is-revealed)');
    if (!items.length) return;

    if (reduced || !('IntersectionObserver' in global)) {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
        setTimeout(function () { el.classList.add('is-revealed'); }, delay);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     countUp — animate a number from 0 to its target
     Markup: <span data-count="1284" data-decimals="0"
                   data-prefix="₹" data-suffix="+">
     --------------------------------------------------------- */
  function animateNumber(el, to, opts) {
    opts = opts || {};
    var from = typeof opts.from === 'number' ? opts.from : 0;
    var dur = opts.duration || 1500;
    var dec = opts.decimals || 0;
    var pre = opts.prefix || '';
    var suf = opts.suffix || '';
    var fmt = function (v) {
      var n = dec ? v.toFixed(dec) : String(Math.round(v));
      if (opts.group !== false) {
        var parts = n.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        n = parts.join('.');
      }
      return pre + n + suf;
    };
    if (reduced) { el.textContent = fmt(to); return; }
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initCounters(root) {
    root = root || document;
    var els = root.querySelectorAll('[data-count]:not(.is-counted)');
    if (!els.length) return;

    function run(el) {
      el.classList.add('is-counted');
      animateNumber(el, parseFloat(el.getAttribute('data-count')), {
        decimals: parseInt(el.getAttribute('data-decimals') || '0', 10),
        prefix: el.getAttribute('data-prefix') || '',
        suffix: el.getAttribute('data-suffix') || '',
        duration: parseInt(el.getAttribute('data-duration') || '1600', 10)
      });
    }

    if (reduced || !('IntersectionObserver' in global)) {
      els.forEach(run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     drawSVG — stroke-dash draw-on for architecture diagrams
     Markup: <path data-draw data-draw-dur="1400">
     --------------------------------------------------------- */
  function initDraw(root) {
    root = root || document;
    var paths = root.querySelectorAll('[data-draw]:not(.is-drawn)');
    if (!paths.length) return;

    paths.forEach(function (p) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) { len = 600; }
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = reduced ? 0 : len;
    });

    if (reduced || !('IntersectionObserver' in global)) {
      paths.forEach(function (p) { p.classList.add('is-drawn'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var p = e.target;
        var dur = p.getAttribute('data-draw-dur') || '1400';
        var delay = p.getAttribute('data-draw-delay') || '0';
        p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.16,1,.3,1) ' + delay + 'ms';
        p.style.strokeDashoffset = '0';
        p.classList.add('is-drawn');
        io.unobserve(p);
      });
    }, { threshold: 0.2 });
    paths.forEach(function (p) { io.observe(p); });
  }

  /* ---------------------------------------------------------
     marquee — seamless infinite ticker
     Markup: <div data-marquee data-speed="40"><ul>…</ul></div>
     The inner track is duplicated so the loop never shows a seam.
     --------------------------------------------------------- */
  function initMarquee(root) {
    root = root || document;
    root.querySelectorAll('[data-marquee]:not(.is-marquee)').forEach(function (el) {
      el.classList.add('is-marquee');
      var track = el.firstElementChild;
      if (!track) return;
      var clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      el.appendChild(clone);
      var speed = parseFloat(el.getAttribute('data-speed') || '38');
      el.style.setProperty('--marquee-dur', speed + 's');
      if (el.getAttribute('data-dir') === 'reverse') el.classList.add('marquee-reverse');
    });
  }

  /* ---------------------------------------------------------
     tilt — subtle 3D tilt toward the pointer
     Markup: <div data-tilt data-tilt-max="7">
     --------------------------------------------------------- */
  function initTilt(root) {
    if (reduced) return;
    root = root || document;
    root.querySelectorAll('[data-tilt]:not(.is-tilt)').forEach(function (el) {
      el.classList.add('is-tilt');
      var max = parseFloat(el.getAttribute('data-tilt-max') || '6');
      var raf = null;

      function move(e) {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform =
            'perspective(900px) rotateX(' + (-py * max).toFixed(2) + 'deg) rotateY(' +
            (px * max).toFixed(2) + 'deg) translateZ(0)';
          el.style.setProperty('--mx', (px * 100 + 50).toFixed(1) + '%');
          el.style.setProperty('--my', (py * 100 + 50).toFixed(1) + '%');
        });
      }
      function leave() {
        if (raf) cancelAnimationFrame(raf);
        el.style.transform = '';
      }
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
    });
  }

  /* ---------------------------------------------------------
     magnetic — element drifts toward the cursor when near
     Markup: <a data-magnetic data-magnet-strength="0.28">
     --------------------------------------------------------- */
  function initMagnetic(root) {
    if (reduced) return;
    root = root || document;
    root.querySelectorAll('[data-magnetic]:not(.is-magnetic)').forEach(function (el) {
      el.classList.add('is-magnetic');
      var k = parseFloat(el.getAttribute('data-magnet-strength') || '0.26');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (dx * k).toFixed(1) + 'px,' + (dy * k).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------
     parallax — translate on scroll
     Markup: <div data-parallax="0.18">   (positive = slower)
     --------------------------------------------------------- */
  var parallaxItems = [];
  function initParallax(root) {
    if (reduced) return;
    root = root || document;
    root.querySelectorAll('[data-parallax]:not(.is-parallax)').forEach(function (el) {
      el.classList.add('is-parallax');
      parallaxItems.push({ el: el, k: parseFloat(el.getAttribute('data-parallax')) || 0.15 });
    });
    if (parallaxItems.length && !initParallax._bound) {
      initParallax._bound = true;
      var ticking = false;
      function update() {
        var vh = global.innerHeight;
        parallaxItems.forEach(function (it) {
          var r = it.el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          var mid = r.top + r.height / 2 - vh / 2;
          it.el.style.transform = 'translate3d(0,' + (-mid * it.k).toFixed(1) + 'px,0)';
        });
        ticking = false;
      }
      global.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }, { passive: true });
      update();
    }
  }

  /* ---------------------------------------------------------
     splitText — wrap each word in a span so it can rise in
     Markup: <h1 data-split>Some headline</h1>
     --------------------------------------------------------- */
  function initSplit(root) {
    root = root || document;
    root.querySelectorAll('[data-split]:not(.is-split)').forEach(function (el) {
      el.classList.add('is-split');
      var step = parseInt(el.getAttribute('data-split-stagger') || '58', 10);
      var base = parseInt(el.getAttribute('data-split-delay') || '0', 10);
      var html = '';
      var i = 0;
      el.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok.trim()) { html += tok; return; }
            html += '<span class="split-w"><i style="animation-delay:' +
                    (base + i * step) + 'ms">' + tok + '</i></span>';
            i++;
          });
        } else if (node.nodeType === 1) {
          if (node.tagName === 'BR') {
            // a line break inside an inline-block wrapper never breaks — emit it raw
            html += '<br>';
            return;
          }
          // keep inline markup (e.g. <em>) but still stagger it as one unit
          html += '<span class="split-w"><i style="animation-delay:' +
                  (base + i * step) + 'ms">' + node.outerHTML + '</i></span>';
          i++;
        }
      });
      el.innerHTML = html;
      if (reduced) el.classList.add('split-instant');
    });
  }

  /* ---------------------------------------------------------
     typeLines — cycle a list of phrases with a caret
     Markup: <span data-typer data-words="one|two|three"></span>
     --------------------------------------------------------- */
  function initTyper(root) {
    root = root || document;
    root.querySelectorAll('[data-typer]:not(.is-typer)').forEach(function (el) {
      el.classList.add('is-typer');
      var words = (el.getAttribute('data-words') || '').split('|').filter(Boolean);
      if (!words.length) return;
      if (reduced) { el.textContent = words[0]; return; }
      var wi = 0, ci = 0, deleting = false;
      (function tick() {
        var w = words[wi];
        ci += deleting ? -1 : 1;
        el.textContent = w.slice(0, ci);
        var wait = deleting ? 34 : 68;
        if (!deleting && ci === w.length) { deleting = true; wait = 1700; }
        else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; wait = 320; }
        setTimeout(tick, wait);
      })();
    });
  }

  /* ---------------------------------------------------------
     scrollProgress — fills [data-progress-bar] as the page scrolls,
     and adds .is-stuck to [data-sticky-header] past a threshold.
     --------------------------------------------------------- */
  function initScrollChrome() {
    var rail = document.querySelector('[data-progress-bar]');
    /* the rail is the track; its first child is the fill that gets scaled */
    var bar = rail ? (rail.firstElementChild || rail) : null;
    var header = document.querySelector('[data-sticky-header]');
    if (!bar && !header) return;
    var ticking = false;
    function update() {
      var y = global.scrollY || document.documentElement.scrollTop;
      if (bar) {
        var h = document.documentElement.scrollHeight - global.innerHeight;
        bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(y / h, 1) : 0) + ')';
      }
      if (header) header.classList.toggle('is-stuck', y > 24);
      ticking = false;
    }
    global.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------------------------------------------------
     spotlight — a soft light that follows the pointer
     Markup: <section data-spotlight>  (uses --sx/--sy in CSS)
     --------------------------------------------------------- */
  function initSpotlight(root) {
    if (reduced) return;
    root = root || document;
    root.querySelectorAll('[data-spotlight]:not(.is-spotlight)').forEach(function (el) {
      el.classList.add('is-spotlight');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--sy', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------------------------------------------------------
     scrollSpy — highlights nav links for the section in view
     Markup: <a data-spy href="#modules">
     --------------------------------------------------------- */
  /* Sections here are taller than the viewport, which makes threshold-based
     observation pick the wrong one. Track the last section whose top has
     crossed a line a third of the way down the screen instead. */
  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-spy]'));
    if (!links.length) return;
    var pairs = links.map(function (a) {
      return { link: a, sec: document.getElementById(a.getAttribute('href').slice(1)) };
    }).filter(function (p) { return p.sec; });
    if (!pairs.length) return;

    var ticking = false;
    function update() {
      var line = global.innerHeight * 0.34;
      var active = null;
      pairs.forEach(function (p) {
        if (p.sec.getBoundingClientRect().top <= line) active = p;
      });
      pairs.forEach(function (p) {
        p.link.classList.toggle('is-active', p === active);
      });
      ticking = false;
    }
    global.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    global.addEventListener('resize', update);
    update();
  }

  /* ---------------------------------------------------------
     ripple — material-ish click feedback on [data-ripple]
     --------------------------------------------------------- */
  function initRipple() {
    if (initRipple._bound || reduced) return;
    initRipple._bound = true;
    document.addEventListener('pointerdown', function (e) {
      var host = e.target.closest ? e.target.closest('[data-ripple]') : null;
      if (!host) return;
      var r = host.getBoundingClientRect();
      var span = document.createElement('span');
      span.className = 'ripple-ink';
      var size = Math.max(r.width, r.height) * 2;
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left - size / 2) + 'px';
      span.style.top = (e.clientY - r.top - size / 2) + 'px';
      host.appendChild(span);
      setTimeout(function () { span.remove(); }, 640);
    });
  }

  /* ---------------------------------------------------------
     flash — briefly highlight an element that just changed.
     Used by the app to show cross-module updates landing.
     --------------------------------------------------------- */
  function flash(el, tone) {
    if (!el) return;
    var cls = 'flash-' + (tone || 'gold');
    el.classList.remove(cls);
    void el.offsetWidth;                  // force reflow so it re-triggers
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 1400);
  }

  /* ---------------------------------------------------------
     enter — play an entrance on freshly rendered app content
     --------------------------------------------------------- */
  function enter(container, selector, step) {
    if (!container) return;
    if (reduced) return;
    var els = container.querySelectorAll(selector || '[data-enter]');
    step = step || 45;
    Array.prototype.forEach.call(els, function (el, i) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'enterUp 520ms cubic-bezier(.16,1,.3,1) ' + (i * step) + 'ms both';
    });
  }

  /* --------------------------------------------------------- */
  Motion.reveal    = initReveal;
  Motion.counters  = initCounters;
  Motion.draw      = initDraw;
  Motion.marquee   = initMarquee;
  Motion.tilt      = initTilt;
  Motion.magnetic  = initMagnetic;
  Motion.parallax  = initParallax;
  Motion.split     = initSplit;
  Motion.typer     = initTyper;
  Motion.spotlight = initSpotlight;
  Motion.number    = animateNumber;
  Motion.flash     = flash;
  Motion.enter     = enter;

  /* Run every scroll/pointer-driven effect over a subtree. */
  Motion.scan = function (root) {
    initReveal(root);
    initCounters(root);
    initDraw(root);
    initMarquee(root);
    initTilt(root);
    initMagnetic(root);
    initParallax(root);
    initSplit(root);
    initTyper(root);
    initSpotlight(root);
  };

  Motion.boot = function () {
    Motion.scan(document);
    initScrollChrome();
    initScrollSpy();
    initRipple();
    document.documentElement.classList.add('motion-ready');
  };

  global.Motion = Motion;
})(window);
