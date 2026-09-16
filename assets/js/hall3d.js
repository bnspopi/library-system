/* ============================================================
   hall3d.js — the room.

   Inside every hall of the tour the footage fills the frame, flat
   and whole, and moves as you scroll. Dragging turns your head a
   little: the film slides, and anything near you slides more. The
   things in the footage are hotspots (hotspots.js): the shelves
   hold the hall's titles, the whale opens its record, the door
   walks you on. Click a book on a shelf and it comes out of the
   picture to you, opens on its own, and turns through every page:
   the story, the people in it standing up out of the paper, its
   places, and the shelf it lives on. The wheel, the arrow keys or a
   click on a page turn the pages; Escape, or a click away, puts
   it back.

   LS.Hall3D.create(stageEl, { def, col, beats }, { onReserve, goBeat, go })
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;
  var T = global.THREE;
  var L = LS.Living3D;

  var FRAME = 2.234;        // aspect of the cropped clips; each clip's own aspect is read once it loads
  var FOCUS_Y = 0.42;       // object-position of the film (scenes.css)
  var EYE = 1.05;
  var FOV = 42;
  var ZOOM = 1.10;          // the film is a touch larger than the frame so a turn of the head never finds its edge
  var ZOOM_LOOK = 1.45;     // looking closer at something in it
  var SWAY = 0.55;          // how far the camera slides for a full turn: what is near you moves more than the film
  var DEPTH = 6.5;          // where the picture stands, for the books that come out of it
  var XFADE = 0.10;
  var LEAF_MS = 3200;       // an opened book turns a page this often until you touch it

  function create(stageEl, hall, opts) {
    opts = opts || {};
    if (!L || !L.supported || !global.gsap) return null;
    var def = hall.def, col = hall.col || null, beats = hall.beats || [];
    var n = beats.length;
    var film = stageEl.querySelector('.jr-film');

    var ctrl = { slot: null, baseFov: FOV, update: update, onFit: onFit, onStolen: deactivate };
    var scene = ctrl.scene = new T.Scene();
    var camera = ctrl.camera = new T.PerspectiveCamera(FOV, 1, 0.05, 60);
    camera.position.set(0, EYE, 0);
    scene.add(camera);
    var lights = L.lightRig(scene);
    lights.key.position.set(2.5, 4.5, 3);
    lights.fill.position.set(0, 1.6, 2.6);

    /* ---- what you can click in the footage ----------------------- */
    var spotsLayer = el('div.jr-spots');
    var spotSets = {}, liveSpots = [];
    var aspects = beats.map(function () { return FRAME; });
    beats.forEach(function (b, i) {
      var v = b.video;
      if (!v) return;
      function read() { if (v.videoWidth) { aspects[i] = v.videoWidth / v.videoHeight; layoutSpots(i); } }
      v.addEventListener('loadedmetadata', read);
      read();
    });
    /** a point of the clip (fractions) to a point of the stage (fractions), the way object-fit: cover lays it */
    function frameToStage(u, v, aspect) {
      var W = ctrl.width || stageEl.clientWidth || 1, H = ctrl.height || stageEl.clientHeight || 1, A = W / H;
      if (A >= aspect) { var k = A / aspect; return { x: u, y: v * k - (k - 1) * FOCUS_Y }; }
      var k2 = aspect / A;
      return { x: u * k2 - (k2 - 1) * 0.5, y: v };
    }
    function spotsFor(i) {
      if (spotSets[i]) return spotSets[i];
      var list = (LS.Hotspots ? LS.Hotspots.of(beats[i].def.src) : []).map(function (h) {
        var node = el('button.jr-spot.jr-spot-' + h.action.type, { type: 'button', 'aria-label': h.label }, [el('i'), el('span', { text: h.label })]);
        node.style.display = 'none';
        spotsLayer.appendChild(node);
        var s = { h: h, el: node, beat: i, cx: 0.5, cy: 0.5 };
        node.__spot = s;
        return s;
      });
      spotSets[i] = list;
      layoutSpots(i);
      return list;
    }
    function layoutSpots(only) {
      Object.keys(spotSets).forEach(function (k) {
        if (only !== undefined && +k !== only) return;
        var a = aspects[k];
        spotSets[k].forEach(function (s) {
          var h = s.h, p0 = frameToStage(h.x, h.y, a), p1 = frameToStage(h.x + h.w, h.y + h.h, a);
          s.el.style.left = (p0.x * 100).toFixed(2) + '%';
          s.el.style.top = (p0.y * 100).toFixed(2) + '%';
          s.el.style.width = ((p1.x - p0.x) * 100).toFixed(2) + '%';
          s.el.style.height = ((p1.y - p0.y) * 100).toFixed(2) + '%';
          s.cx = (p0.x + p1.x) / 2; s.cy = (p0.y + p1.y) / 2;
        });
      });
    }
    function showSpots(i) {
      liveSpots.forEach(function (s) { s.el.style.display = 'none'; });
      liveSpots = i >= 0 && i < n ? spotsFor(i) : [];
      liveSpots.forEach(function (s) { s.el.style.display = ''; });
    }
    function spotOf(target) {
      var node = target && target.closest ? target.closest('.jr-spot') : null;
      return node && node.__spot ? node.__spot : null;
    }

    /* ---- the shelf: this hall's titles, each a book that comes out of the picture ---- */
    var bibs = col ? E.db().bibs.filter(function (b) { return b.collection === col.key; }) : [];
    var books = {};
    function bookOf(b) {
      if (books[b.id]) return books[b.id];
      var book = new L.Book({ key: col ? col.key : 'aurelia', title: b.title, author: b.author, n: b.dewey,
        faces: LS.BookFaces.bib(b, col) });
      var holder = new T.Group();
      holder.add(book.group);
      book.group.position.set(-book.w / 2, 0, -(book.t + 0.052) / 2);
      holder.visible = false;
      scene.add(holder);
      var en = { bib: b, book: book, holder: holder };
      books[b.id] = en;
      return en;
    }
    /** a point of the stage (fractions) on the picture, in the room */
    function planePoint(sx, sy, out) {
      var fov = camera.fov * Math.PI / 180;
      var visH = 2 * DEPTH * Math.tan(fov / 2), visW = visH * camera.aspect;
      return out.set(camera.position.x + (sx - 0.5) * visW, camera.position.y + (0.5 - sy) * visH, camera.position.z - DEPTH);
    }

    var reader = L.Reader(scene, camera, { dist: 3.3, tilt: 0.58, y: -0.12 });
    var hint = el('div.l3-hint', {}, [el('span')]);
    var tag = el('div.l3-tag', {}, [el('span'), el('b')]);
    stageEl.appendChild(hint);
    stageEl.appendChild(tag);

    var state = { p: 0, ps: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, par: 0, look: null,
                  zoom: ZOOM, fx: 0, fy: 0, fov: FOV,
                  beat: -1, taken: null, opened: false, busy: false, hoverSpot: null,
                  tl: 0, tlT: 0, auto: false };
    var ray = new T.Raycaster();
    var ndc = new T.Vector2();
    var tmpV = new T.Vector3();
    var leafTimer = 0, snapTimer = 0;

    function onFit(w, h) { reader.fit(); layoutSpots(); }
    function baseFov() {
      var w = ctrl.width || 1, h = ctrl.height || 1;
      return w / h < 1 ? Math.min(62, FOV * Math.pow(h / w, 0.72)) : FOV;
    }

    /* ---- every frame ---------------------------------------------- */
    function update(dt, t) {
      state.ps += (state.p - state.ps) * Math.min(1, dt * 5);
      if (!isFinite(state.ps)) state.ps = state.p || 0;
      var k = Math.min(1, dt * 6);

      /* the head: the film slides a little, the camera slides more */
      state.yaw += (state.yawT + (state.taken ? 0 : state.par) - state.yaw) * k;
      state.pitch += (state.pitchT - state.pitch) * k;
      var zoomT = state.look ? ZOOM_LOOK : ZOOM;
      state.zoom += (zoomT - state.zoom) * k;
      var lim = (state.zoom - 1) / 2;
      var fxT, fyT;
      if (state.look) { fxT = -(state.look.cx - 0.5) * state.zoom; fyT = -(state.look.cy - 0.5) * state.zoom; }
      else { fxT = -state.yaw * lim; fyT = -state.pitch * lim * 0.6; }
      state.fx += (L.clamp(fxT, -lim, lim) - state.fx) * k;
      state.fy += (L.clamp(fyT, -lim, lim) - state.fy) * k;
      if (film) {
        var tr = 'translate(' + (state.fx * 100).toFixed(3) + '%,' + (state.fy * 100).toFixed(3) + '%) scale(' + state.zoom.toFixed(4) + ')';
        film.style.transform = tr;
        spotsLayer.style.transform = tr;
      }
      camera.position.set(state.yaw * SWAY, EYE + state.pitch * 0.2, 0);
      var fov = 2 * Math.atan(Math.tan(baseFov() * Math.PI / 360) / state.zoom) * 180 / Math.PI;
      if (Math.abs(fov - state.fov) > 0.02) { state.fov = fov; camera.fov = fov; camera.updateProjectionMatrix(); }

      /* which beat is on the wall */
      if (n) {
        var x = state.ps * n, cur = Math.min(n - 1, Math.floor(x)), frac = x - cur;
        var nxt = cur + 1 < n ? cur + 1 : -1;
        var shown = (nxt >= 0 && frac > 1 - XFADE / 2) ? nxt : cur;
        if (shown !== state.beat) { state.beat = shown; showSpots(state.taken ? -1 : shown); }
        var b = beats[state.beat];
        liveSpots.forEach(function (s) {
          if (!s.h.t || !b) return;
          var lt = (state.ps * n - state.beat) * (b.duration || 8);
          s.el.classList.toggle('is-off', !(lt >= s.h.t[0] && lt <= s.h.t[1]));
        });
      }

      /* the open book turns its pages */
      if (state.taken) {
        if (Math.abs(state.tlT - state.tl) > 1e-4) {
          state.tl += (state.tlT - state.tl) * Math.min(1, dt * 4.5);
          if (Math.abs(state.tlT - state.tl) < 1e-3) state.tl = state.tlT;
          state.taken.book.setTimeline(state.tl);
        }
      }
      reader.update();
    }

    /* ---- the tag ----------------------------------------------------- */
    function placeTagAt(x, y) {
      var sr = stageEl.getBoundingClientRect();
      tag.style.left = (x - sr.left) + 'px';
      tag.style.top = (y - sr.top) + 'px';
    }
    function placeTagOnSpot(sp) {
      var r = sp.el.getBoundingClientRect();
      placeTagAt(r.left + r.width / 2, r.top + r.height * 0.5);
    }
    function showTag(label, sub) {
      tag.firstChild.textContent = label;
      tag.lastChild.textContent = sub || '';
      tag.classList.add('is-in');
    }
    function hideTag() { tag.classList.remove('is-in'); }
    function verb(a) {
      return { turn: 'turn the page', reserve: 'take it down', look: 'look closer', book: 'take one down', hall: 'walk there' }[a.type] || '';
    }
    /** which title a click along a shelf lands on */
    function bibAtSpot(sp, e) {
      if (!bibs.length) return null;
      var r = sp.el.getBoundingClientRect();
      var u = r.width ? L.clamp((e.clientX - r.left) / r.width, 0, 0.999) : 0;
      return bibs[Math.floor(u * bibs.length)];
    }

    /* ---- pointer ---------------------------------------------------- */
    function isChrome(t) {
      return !!(t && t.closest && t.closest('.jr-rail, .jr-hud, .jr-cta, .jr-caption, .l3-hint, .tour-skip, a, .btn, .rc-doorlist'));
    }
    function castAt(e) {
      if (!ctrl.slot || !state.taken) return null;
      L.ndc(e, ctrl.slot.canvas, ndc);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(state.taken.book.hit, false);
      return hits.length ? hits[0] : null;
    }
    var drag = null, moveQueued = false, lastMove = null;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (isChrome(e.target)) return;
      drag = { x: e.clientX, y: e.clientY, yaw: state.yawT, pitch: state.pitchT, tl: state.tlT, moved: false, target: e.target };
      try { stageEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
        if (!drag.moved) return;
        if (state.taken) {
          /* a vertical drag over the open book turns its pages */
          if (state.opened) { state.auto = false; state.tlT = L.clamp(drag.tl + (drag.y - e.clientY) / 240, 1, state.taken.book.sheetCount() + 1); }
          return;
        }
        state.look = null;
        state.yawT = L.clamp(drag.yaw - dx * 0.0035, -1, 1);
        state.pitchT = L.clamp(drag.pitch + dy * 0.0022, -1, 1);
        stageEl.classList.add('is-dragging');
        return;
      }
      lastMove = e;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(function () {
        moveQueued = false;
        if (!ctrl.slot || !lastMove) return;
        var ev = lastMove, r = stageEl.getBoundingClientRect();
        state.par = ((ev.clientX - r.left) / r.width - 0.5) * 0.08;   // a little look-around under the pointer
        if (!state.taken) {
          var sp = spotOf(ev.target);
          setHoverSpot(sp);
          if (sp && sp.h.action.type === 'book') {
            var b = bibAtSpot(sp, ev);
            if (b) { showTag(b.title, 'take it down'); placeTagAt(ev.clientX, ev.clientY); }
          }
          stageEl.style.cursor = sp ? 'pointer' : 'grab';
          return;
        }
        var hit = castAt(ev);
        var hot = hit && state.opened ? state.taken.book.hotAt(hit) : null;
        stageEl.style.cursor = hit ? 'pointer' : 'default';
        if (hot && hot.action.type !== 'close') { showTag(hot.action.type === 'next' ? 'The next title' : 'Reserve it', ''); placeTagAt(ev.clientX, ev.clientY); }
        else hideTag();
      });
    }
    function onUp(e) {
      var d = drag; drag = null;
      stageEl.classList.remove('is-dragging');
      if (!d) return;
      if (d.moved) { if (state.taken) snapPages(); return; }
      if (!state.taken) {
        var sp = spotOf(d.target);
        if (sp) { actSpot(sp, e); return; }
        if (state.look) state.look = null;
        return;
      }
      var hit = castAt(e);
      if (hit) {
        if (!state.opened) { open(); return; }
        var hot = state.taken.book.hotAt(hit);
        if (hot) { act(hot.action); return; }
        /* a page: the right one turns forward, the left one back */
        var local = state.taken.book.group.worldToLocal(hit.point.clone());
        turnPage(local.x >= 0 ? 1 : -1);
        return;
      }
      putBack();
    }
    function onWheel(e) {
      if (!state.taken) return;
      e.preventDefault();
      if (!state.opened) return;
      state.auto = false;
      state.tlT = L.clamp(state.tlT + e.deltaY / 420, 1, state.taken.book.sheetCount() + 1);
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapPages, 220);
    }
    function snapPages() { state.tlT = Math.round(state.tlT); }
    function turnPage(dir) {
      if (!state.taken || !state.opened) return;
      state.auto = false;
      var N = state.taken.book.sheetCount();
      state.tlT = L.clamp((dir > 0 ? Math.floor(state.tlT + 1e-6) : Math.ceil(state.tlT - 1e-6)) + dir, 1, N + 1);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        if (document.querySelector('.sw-open.is-in')) return; // an open reservation dialog owns this Escape
        if (state.taken) putBack();
        else if (state.look) state.look = null;
        return;
      }
      if (!state.taken) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); turnPage(1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); turnPage(-1); }
    }
    function setHoverSpot(sp) {
      if (state.hoverSpot === sp) return;
      if (state.hoverSpot) state.hoverSpot.el.classList.remove('is-hover');
      state.hoverSpot = sp;
      if (sp) { sp.el.classList.add('is-hover'); showTag(sp.h.label, verb(sp.h.action)); placeTagOnSpot(sp); }
      else hideTag();
    }

    /* ---- what a click does ------------------------------------------ */
    function actSpot(sp, e) {
      var a = sp.h.action;
      switch (a.type) {
        case 'look':
          state.look = state.look && state.look.spot === sp ? null : { spot: sp, cx: sp.cx, cy: sp.cy };
          return;
        case 'book':
          var b = bibAtSpot(sp, e) || bibs[0];
          if (b) take(b, sp.cx, sp.cy);
          return;
        case 'reserve':
          var rb = LS.Hotspots.resolveBib(a.match, col && col.key);
          if (rb && rb.collection === (col && col.key)) { take(rb, sp.cx, sp.cy); return; }
          if (rb && opts.onReserve) opts.onReserve(rb);
          else if (rb && LS.ShelfWalk) LS.ShelfWalk.openBook(rb);
          return;
      }
      act(a);
    }
    function act(a) {
      switch (a.type) {
        case 'turn':
          if (opts.goBeat) opts.goBeat(state.beat + 1);
          break;
        case 'reserve':
          var bib = a.bib || LS.Hotspots.resolveBib(a.match, col && col.key);
          if (!bib) break;
          if (opts.onReserve) opts.onReserve(bib);
          else if (LS.ShelfWalk) LS.ShelfWalk.openBook(bib);
          break;
        case 'hall':
          if (opts.go) opts.go(a.key);
          break;
        case 'next':
          var i = bibs.indexOf(state.taken ? state.taken.bib : null);
          var nb = bibs.length ? bibs[(i + 1) % bibs.length] : null;
          if (!nb || bibs.length < 2) { putBack(); break; }
          var sx = state.hoverSpot ? state.hoverSpot.cx : 0.5, sy = state.hoverSpot ? state.hoverSpot.cy : 0.55;
          putBack(false, function () { take(nb, sx, sy); });
          break;
        case 'close':
          putBack();
          break;
      }
    }

    /* ---- take, open, put back ---------------------------------------- */
    function say(text) {
      hint.firstChild.textContent = text;
      hint.classList.toggle('is-in', !!text);
    }
    function take(b, sx, sy) {
      if (state.busy || reader.busy || state.taken) return;
      var en = bookOf(b);
      setHoverSpot(null); hideTag();
      state.busy = true;
      state.taken = en;
      state.look = null;
      state.tl = state.tlT = 0;
      state.auto = false;
      showSpots(-1);
      if (!en.book.built) en.book.build();
      en.book.setTimeline(0);
      /* it starts on the shelf, in the picture, where you clicked */
      planePoint(sx === undefined ? 0.5 : sx, sy === undefined ? 0.55 : sy, en.holder.position);
      en.holder.rotation.set(0, 0, 0);
      en.holder.scale.setScalar(0.42);
      en.holder.visible = true;
      en.book.setOpacity(1);
      stageEl.classList.add('is-reading');
      say('It opens on its own · scroll, click or use the arrows to turn the pages · Esc puts it back');
      reader.take(en.book, function () {
        state.busy = false;
        open();
      });
    }
    function open() {
      if (!state.taken || state.busy || state.opened) return;
      state.opened = true;
      stageEl.classList.add('is-open');
      state.tlT = 1;
      state.auto = true;
      clearInterval(leafTimer);
      leafTimer = setInterval(function () {
        if (!state.auto || !state.taken || !state.opened) return;
        var N = state.taken.book.sheetCount();
        if (state.tlT < N + 1 - 1e-6) state.tlT = Math.floor(state.tlT + 1e-6) + 1;
        else state.auto = false;
      }, LEAF_MS);
    }
    function putBack(instant, then) {
      var en = state.taken;
      if (!en) { if (then) then(); return; }
      hideTag();
      clearInterval(leafTimer); leafTimer = 0;
      state.auto = false;
      if (instant) {
        en.book.setTimeline(0);
        reader.drop();
        en.holder.visible = false;
        state.taken = null; state.opened = false; state.busy = false; state.tl = state.tlT = 0;
        stageEl.classList.remove('is-reading', 'is-open');
        showSpots(state.beat);
        say('');
        if (then) then();
        return;
      }
      if (state.busy || reader.busy) return;
      state.busy = true;
      var tl = { a: state.tl };
      say('');
      stageEl.classList.remove('is-open');
      gsap.to(tl, { a: 0, duration: 0.7, ease: 'power2.inOut',
        onUpdate: function () { en.book.setTimeline(tl.a); state.tl = state.tlT = tl.a; reader.update(); },
        onComplete: function () {
          reader.putBack(function () {
            en.holder.visible = false;
            state.taken = null; state.opened = false; state.busy = false;
            showSpots(state.beat);
            if (then) then();
          });
          stageEl.classList.remove('is-reading');
        } });
    }

    /* ---- lifecycle ---------------------------------------------------- */
    var bound = false;
    function activate() {
      if (ctrl.slot) return;
      var slot = ctrl.slot = L.acquire(ctrl);
      var before = stageEl.querySelector('.jr-rail') || stageEl.querySelector('.jr-hud') || hint;
      stageEl.insertBefore(slot.canvas, before);
      stageEl.insertBefore(spotsLayer, before);
      scene.environment = slot.env;
      var poster0 = beats[0] ? L.BASE + beats[0].def.src + '.jpg' : null;
      if (poster0) L.envFrom(slot, poster0, function (env) { if (ctrl.slot === slot) scene.environment = env; });
      L.fit(ctrl, stageEl);
      L.run(ctrl);
      stageEl.addEventListener('pointerdown', onDown);
      stageEl.addEventListener('pointermove', onMove);
      stageEl.addEventListener('pointerup', onUp);
      stageEl.addEventListener('pointercancel', onUp);
      stageEl.addEventListener('wheel', onWheel, { passive: false });
      if (!bound) { document.addEventListener('keydown', onKey); bound = true; }
      stageEl.classList.add('is-room');
      showSpots(state.beat);
      say(bibs.length ? 'Drag to look round · click a book on the shelf' : 'Drag to look round · click what you see');
      setTimeout(function () { if (!state.taken) say(''); }, 3600);
    }
    function deactivate() {
      if (!ctrl.slot) return;
      var slot = ctrl.slot;
      if (state.taken) putBack(true);
      state.look = null;
      stageEl.removeEventListener('pointerdown', onDown);
      stageEl.removeEventListener('pointermove', onMove);
      stageEl.removeEventListener('pointerup', onUp);
      stageEl.removeEventListener('pointercancel', onUp);
      stageEl.removeEventListener('wheel', onWheel);
      L.halt(ctrl);
      L.release(slot);
      ctrl.slot = null;
      if (spotsLayer.parentNode) spotsLayer.parentNode.removeChild(spotsLayer);
      if (film) film.style.transform = '';
      stageEl.style.cursor = '';
      stageEl.classList.remove('is-room', 'is-dragging');
      hideTag();
    }
    function onResize() { if (ctrl.slot) L.fit(ctrl, stageEl); }
    global.addEventListener('resize', onResize);

    return {
      activate: activate,
      deactivate: deactivate,
      onStolen: deactivate,
      setProgress: function (p) { state.p = p; },
      take: function (b) { take(b, 0.5, 0.55); },
      putBack: putBack,
      turnPage: turnPage,
      destroy: function () {
        deactivate();
        clearInterval(leafTimer);
        document.removeEventListener('keydown', onKey);
        global.removeEventListener('resize', onResize);
        Object.keys(books).forEach(function (k) { books[k].book.dispose(); });
        if (hint.parentNode) hint.parentNode.removeChild(hint);
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      },
      state: state, ctrl: ctrl, reader: reader, bibs: bibs,
      entries: function () { return Object.keys(books).map(function (k) { return books[k]; }); },
      spots: function () { return liveSpots; }
    };
  }

  LS.Hall3D = { create: create };
})(window);
