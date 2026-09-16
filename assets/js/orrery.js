/* ============================================================
   orrery.js — the landing page.

   A great book turns slowly at the centre; every hall of the
   library has a book of its own in orbit around it. Drag to turn
   the whole thing. Click any book and it comes to you; from then
   on the scroll bar opens it — the cover, then page after page,
   paper-cut figures standing up out of the spread, one of the
   clips playing on a page as you scroll, the live shelf you can
   reserve from, and the way to the next hall.

   The footage is in the scene, not behind it: the reference clip
   of the orbit is the backdrop, moved by the scroll bar like
   everything else.

   LS.Orrery.mount(host, { scroller, onBrowse, onWalk, onReserve })
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;
  var T = global.THREE;
  var L = LS.Living3D;

  var SPAN = 420;                    // vh the hero is pinned for
  var CAM_Z = 9.6, CAM_Y = 0.55;
  var RINGS = [
    { r: 3.25, tiltX: 0.42, tiltZ: -0.18, speed: -0.55 },
    { r: 4.35, tiltX: -0.30, tiltZ: 0.34, speed: 0.40 }
  ];

  function mount(host, opts) {
    opts = opts || {};
    var reduced = global.Motion && Motion.reduced;
    var live = L && L.supported && global.gsap && global.ScrollTrigger && !reduced;
    var scroller = opts.scroller || global;
    var cols = E.db().collections;

    host.classList.add('or');
    host.innerHTML = '';

    var ui = buildUI(host, cols);
    host.appendChild(ui.root);

    if (!live) {
      host.classList.add('or-static');
      host.appendChild(buildFallback(cols, opts));
      return { destroy: function () { host.innerHTML = ''; }, take: function () {}, close: function () {} };
    }
    gsap.registerPlugin(ScrollTrigger);

    /* ---- scene ------------------------------------------------ */
    var ctrl = { slot: null, baseFov: 34, update: update, onFit: onFit, onStolen: deactivate };
    var scene = ctrl.scene = new T.Scene();
    scene.fog = new T.FogExp2(0x050404, 0.026);
    var camera = ctrl.camera = new T.PerspectiveCamera(34, 1, 0.1, 90);
    camera.position.set(0, CAM_Y, CAM_Z);
    camera.lookAt(0, -0.15, 0);
    scene.add(camera);
    L.lightRig(scene);

    var backdrop = buildBackdrop(scene);
    var world = new T.Group();
    scene.add(world);

    /* the great book */
    var giant = new L.Book({ key: 'aurelia', n: 'THE LIVING STACKS', title: 'Aurelia',
      sub: 'Every book in the building', big: true, w: 2.2, h: 3.1, t: 0.34,
      faces: LS.BookFaces.aurelia() });
    var giantHolder = new T.Group();
    giantHolder.add(giant.group);
    giant.group.position.set(-giant.w / 2, 0, -(giant.t + 0.052) / 2);
    world.add(giantHolder);
    L.loadImage(L.BASE + 'giant-book.jpg', function (img) { if (img) giant.setCoverImage(img); });

    /* the halls, in orbit */
    var entries = [{ key: 'aurelia', book: giant, holder: giantHolder, col: null }];
    var rings = RINGS.map(function (rd, ri) {
      var ring = new T.Group();
      ring.rotation.x = rd.tiltX; ring.rotation.z = rd.tiltZ;
      world.add(ring);
      var gold = new T.MeshStandardMaterial({ color: L.GOLD, metalness: 0.9, roughness: 0.28,
        emissive: 0x6a5020, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
      var torus = new T.Mesh(new T.TorusGeometry(rd.r, 0.007, 8, 180), gold);
      torus.rotation.x = Math.PI / 2;
      ring.add(torus);
      var torus2 = new T.Mesh(new T.TorusGeometry(rd.r + 0.06, 0.003, 6, 180), gold);
      torus2.rotation.x = Math.PI / 2;
      ring.add(torus2);
      var group = cols.slice(ri * 5, ri * 5 + 5);
      group.forEach(function (col, i) {
        var pivot = new T.Group();
        pivot.rotation.y = i / group.length * Math.PI * 2;
        ring.add(pivot);
        var holder = new T.Group();
        holder.position.set(rd.r, 0, 0);
        pivot.add(holder);
        var book = new L.Book({ key: col.key, n: col.n, title: col.name, sub: col.hall,
          faces: LS.BookFaces.collection(col) });
        holder.add(book.group);
        book.group.scale.setScalar(0.62);
        book.group.position.set(-book.w / 2 * 0.62, 0, -(book.t + 0.052) / 2 * 0.62);
        var beat = firstBeat(col.key);
        if (beat) L.loadImage(L.BASE + beat + '.jpg', function (img) { if (img) book.setCoverImage(img); });
        entries.push({ key: col.key, book: book, holder: holder, pivot: pivot, col: col, seed: i * 1.37 + ri });
      });
      return { group: ring, def: rd, torus: [torus, torus2] };
    });
    var byKey = {};
    entries.forEach(function (e) { byKey[e.key] = e; });

    var dust = buildDust(scene);
    var reader = L.Reader(scene, camera, { dist: 4.3, tilt: 0.6, y: -0.18 });

    /* ---- state ------------------------------------------------ */
    var state = { p: 0, ps: 0, spin: 0, drift: 0, mode: 'orrery', current: null, hovered: null, trace: [] };
    var drag = { yaw: 0, active: null };
    var ray = new T.Raycaster();
    var ndc = new T.Vector2();
    var tmpQ = new T.Quaternion(), tiltQ = new T.Quaternion(), eul = new T.Euler();
    var st = null;

    function onFit(w, h) {
      var fov = camera.fov * Math.PI / 180;
      var d = CAM_Z + 18;
      var visH = 2 * d * Math.tan(fov / 2), visW = visH * (w / h);
      var bw = Math.max(visW, visH * 2.233) * 1.08;
      backdrop.mesh.scale.set(bw, bw / 2.233, 1);
      reader.fit();
    }

    function update(dt, t) {
      state.ps += (state.p - state.ps) * Math.min(1, dt * 5);
      var p = state.mode === 'orrery' ? state.ps : state.spin;
      if (state.mode === 'orrery') state.drift += dt * 0.05;

      world.rotation.y = p * Math.PI * 1.4 + drag.yaw + state.drift;
      rings.forEach(function (r) { r.group.rotation.y = state.drift * r.def.speed * 2.2 + p * r.def.speed * 2.6; });

      camera.position.z = CAM_Z - p * 2.0;
      camera.position.y = CAM_Y - p * 0.3;
      camera.lookAt(0, -0.15, 0);

      giantHolder.rotation.y = Math.sin(t * 0.25) * 0.26 + p * 0.9 + drag.yaw * 0.25;
      giantHolder.rotation.x = -0.12 + Math.sin(t * 0.4) * 0.04;
      giantHolder.position.y = Math.sin(t * 0.7) * 0.06;

      /* the orbiting books face you, with a little independent life */
      entries.forEach(function (e, i) {
        if (!e.pivot) return;
        e.pivot.getWorldQuaternion(tmpQ).invert();
        eul.set(Math.sin(t * 0.5 + e.seed) * 0.10, Math.sin(t * 0.33 + e.seed) * 0.30 - 0.15, Math.cos(t * 0.4 + e.seed) * 0.06);
        tiltQ.setFromEuler(eul);
        e.holder.quaternion.copy(tmpQ).multiply(camera.quaternion).multiply(tiltQ);
        e.holder.position.y = Math.sin(t * 0.8 + e.seed) * 0.09;
      });

      dust.rotation.y = t * 0.02;
      backdrop.seek(state.ps);

      if (state.mode === 'book' && state.current) {
        var N = state.current.book.sheetCount();
        var a = L.clamp(state.ps / 0.9, 0, 1) * (N + 1);
        state.current.book.setTimeline(a);
        reader.update();
      }
      ui.progress.style.transform = 'scaleX(' + state.ps.toFixed(4) + ')';
    }

    /* ---- pointer ---------------------------------------------- */
    function castAt(e) {
      L.ndc(e, ctrl.slot.canvas, ndc);
      ray.setFromCamera(ndc, camera);
      var targets = [];
      if (state.mode === 'orrery') entries.forEach(function (x) { targets = targets.concat(x.book.hit); });
      else if (state.current) targets = state.current.book.hit;
      var hits = ray.intersectObjects(targets, false);
      return hits.length ? hits[0] : null;
    }
    function entryOf(hit) {
      var b = hit && hit.object.userData.book;
      for (var i = 0; i < entries.length; i++) if (entries[i].book === b) return entries[i];
      return null;
    }
    var moveQueued = false, lastMove = null;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      drag.active = { x: e.clientX, y: e.clientY, yaw0: drag.yaw, moved: false };
      try { ctrl.slot.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (drag.active) {
        var dx = e.clientX - drag.active.x, dy = e.clientY - drag.active.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.active.moved = true;
        if (state.mode === 'orrery' && drag.active.moved) {
          drag.yaw = drag.active.yaw0 + dx * 0.0062;
          ui.root.classList.add('is-dragging');
        }
        return;
      }
      lastMove = e;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(function () {
        moveQueued = false;
        if (!ctrl.slot || !lastMove) return;
        var hit = castAt(lastMove);
        var canvas = ctrl.slot.canvas;
        if (state.mode === 'orrery') {
          var en = entryOf(hit);
          setHover(en);
          canvas.style.cursor = en ? 'pointer' : 'grab';
        } else if (state.mode === 'book') {
          var hs = hit && state.current.book.hotspotAt(hit);
          var hot = hit && state.current.book.hotAt(hit);
          canvas.style.cursor = (hot || hs) ? 'pointer' : 'default';
          ui.tag(hs ? hs.hotspot.label : null, hs ? verb(hs.hotspot.action) : '', hs ? hit.point : null, camera, canvas);
        }
      });
    }
    function onUp(e) {
      var d = drag.active;
      drag.active = null;
      ui.root.classList.remove('is-dragging');
      if (!d || d.moved) return;
      var hit = castAt(e);
      if (state.mode === 'orrery') {
        var en = entryOf(hit);
        if (en) take(en);
      } else if (state.mode === 'book' && hit) {
        var hs = state.current.book.hotspotAt(hit);
        if (hs) { act(hs.hotspot.action); return; }
        var hot = state.current.book.hotAt(hit);
        if (hot) act(hot.action);
      }
    }
    function verb(a) {
      return { turn: 'turn the page', reserve: 'open the record', look: 'look closer', take: 'take it down' }[a.type] || '';
    }
    function onKey(e) {
      if (e.key !== 'Escape' || state.mode !== 'book') return;
      if (document.querySelector('.sw-open.is-in')) return; // an open reservation dialog owns this Escape
      close();
    }
    function setHover(en) {
      if (state.hovered === en) return;
      if (state.hovered) gsap.to(state.hovered.holder.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' });
      state.hovered = en;
      if (en) gsap.to(en.holder.scale, { x: 1.09, y: 1.09, z: 1.09, duration: 0.4, ease: 'power2.out' });
    }

    /* ---- taking a book down ----------------------------------- */
    function fadeOthers(current, o, dur) {
      entries.forEach(function (e) {
        if (e === current) return;
        var pr = { o: e.opacity === undefined ? 1 : e.opacity };
        gsap.to(pr, { o: o, duration: dur, ease: 'power2.inOut', onUpdate: function () { e.book.setOpacity(pr.o); e.opacity = pr.o; } });
      });
      rings.forEach(function (r) { r.torus.forEach(function (m) { gsap.to(m.material, { opacity: o < 1 ? 0.18 : 0.85, duration: dur }); }); });
      gsap.to(dust.material, { opacity: o < 1 ? 0.15 : 0.7, duration: dur });
      var c = o < 1 ? 0.24 : 1;
      gsap.to(backdrop.mesh.material.color, { r: c * backdrop.base.r, g: c * backdrop.base.g, b: c * backdrop.base.b, duration: dur });
    }

    function take(en) {
      if (state.mode !== 'orrery' || reader.busy) return;
      setHover(null);
      state.mode = 'zooming';
      state.current = en;
      state.spin = state.ps;
      if (!en.book.built) en.book.build();
      en.book.loadFilms();
      if (st) st.scroll(st.start + 1);                // exactly the start counts as outside the pin
      fadeOthers(en, 0.12, 0.9);
      ui.reading(en);
      reader.take(en.book, function () { state.mode = 'book'; });
    }

    function close(then) {
      if (state.mode !== 'book' || reader.busy) { if (then && state.mode === 'orrery') then(); return; }
      state.mode = 'zooming';
      var en = state.current;
      var tl = { a: en.book.timeline };
      gsap.to(tl, { a: 0, duration: 0.7, ease: 'power2.inOut',
        onUpdate: function () { en.book.setTimeline(tl.a); reader.update(); },
        onComplete: function () {
          reader.putBack(function () {
            state.mode = 'orrery';
            state.current = null;
            if (then) then();
          });
          fadeOthers(null, 1, 0.9);
          if (st) st.scroll(st.start + 1);
          ui.idle();
        } });
    }

    function act(action) {
      var en = state.current;
      switch (action.type) {
        case 'reserve':
          var bib = action.bib || (LS.Hotspots ? LS.Hotspots.resolveBib(action.match, en && en.col ? en.col.key : null) : null);
          if (!bib) break;
          if (opts.onReserve) opts.onReserve(bib);
          else if (LS.ShelfWalk) LS.ShelfWalk.openBook(bib);
          break;
        case 'turn':
          /* the book turns its own page: scroll on to the next step */
          if (st && en) {
            var N = en.book.sheetCount();
            var step = Math.min(N + 1, Math.floor(en.book.timeline + 0.001) + 1);
            var top = st.start + (st.end - st.start) * Math.min(0.9, (step + 0.5) / (N + 1) * 0.9);
            if (scroller === global) global.scrollTo({ top: top, behavior: 'smooth' });
            else scroller.scrollTo({ top: top, behavior: 'smooth' });
          }
          break;
        case 'look':
          break;
        case 'take':
          if (byKey[action.key] && state.current !== byKey[action.key]) close(function () { take(byKey[action.key]); });
          break;
        case 'browse':
          if (opts.onBrowse) opts.onBrowse(action.key);
          else location.href = 'app.html#/opac?collection=' + action.key;
          break;
        case 'walk':
          if (opts.onWalk) opts.onWalk(action.key);
          break;
        case 'tour':
          if (opts.onWalk) opts.onWalk('reception');
          break;
        case 'app':
          location.href = 'app.html#/' + action.route;
          break;
        case 'next':
          close(function () { if (byKey[action.key]) take(byKey[action.key]); });
          break;
        case 'close':
          close();
          break;
      }
    }

    ui.onPick = function (key) {
      var en = byKey[key];
      if (!en) return;
      if (state.mode === 'orrery') take(en);
      else if (state.mode === 'book' && state.current !== en) close(function () { take(en); });
    };
    ui.onClose = function () { close(); };
    ui.onBrowse = function () {
      if (state.current && state.current.col) act({ type: 'browse', key: state.current.col.key });
      else act({ type: 'app', route: 'overview' });
    };

    /* ---- lifecycle -------------------------------------------- */
    var bound = false;
    function activate() {
      state.trace.push('activate ' + Math.round(global.scrollY) + (ctrl.slot ? ' (already)' : ''));
      if (ctrl.slot) return;
      var slot = ctrl.slot = L.acquire(ctrl);
      host.insertBefore(slot.canvas, ui.root);
      scene.environment = slot.env;
      L.fit(ctrl, host);
      L.run(ctrl);
      slot.canvas.addEventListener('pointerdown', onDown);
      slot.canvas.addEventListener('pointermove', onMove);
      slot.canvas.addEventListener('pointerup', onUp);
      slot.canvas.addEventListener('pointercancel', onUp);
      slot.canvas.style.cursor = 'grab';
      if (!bound) { document.addEventListener('keydown', onKey); bound = true; }
      backdrop.load();
      host.classList.add('is-live');
    }
    function deactivate() {
      state.trace.push('deactivate ' + Math.round(global.scrollY) + (ctrl.slot ? '' : ' (none)') + ' <- ' + String(new Error().stack).split('\n').slice(2, 4).join(' | ').replace(/https?:[^\s)]+\//g, ''));
      if (!ctrl.slot) return;
      var slot = ctrl.slot;
      slot.canvas.removeEventListener('pointerdown', onDown);
      slot.canvas.removeEventListener('pointermove', onMove);
      slot.canvas.removeEventListener('pointerup', onUp);
      slot.canvas.removeEventListener('pointercancel', onUp);
      L.halt(ctrl);
      L.release(slot);
      ctrl.slot = null;
      host.classList.remove('is-live');
    }
    function onResize() { if (ctrl.slot) L.fit(ctrl, host); }
    global.addEventListener('resize', onResize);

    st = ScrollTrigger.create({
      trigger: host,
      scroller: scroller === global ? undefined : scroller,
      start: 'top top',
      end: '+=' + SPAN + '%',
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: function (self) { state.p = self.progress; },
      onToggle: function (self) { if (self.isActive) activate(); else deactivate(); }
    });
    if (st.isActive) activate();

    /* covers redraw once the real fonts are in */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        entries.forEach(function (e) { e.book.coverMat.map.needsUpdate = true; });
      });
    }

    return {
      destroy: function () {
        deactivate();
        st.kill();
        document.removeEventListener('keydown', onKey);
        global.removeEventListener('resize', onResize);
        entries.forEach(function (e) { e.book.dispose(); });
        host.innerHTML = '';
      },
      take: function (key) { ui.onPick(key); },
      close: close,
      state: state, entries: entries, ctrl: ctrl, reader: reader, trigger: function () { return st; }
    };
  }

  function firstBeat(key) {
    var d = LS.Scenes && LS.Scenes.REGISTRY.filter(function (x) { return x.key === key; })[0];
    return d && d.beats && d.beats[0] ? d.beats[0].src : null;
  }

  /* ---- the backdrop: the orbit clip, moved by the scroll bar --- */
  function buildBackdrop(scene) {
    var poster = new T.TextureLoader().load(L.BASE + 'orbit-books.jpg');
    poster.colorSpace = T.SRGBColorSpace;
    var mat = new T.MeshBasicMaterial({ map: poster, fog: false, color: 0x8f8474 });
    var mesh = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
    mesh.position.set(0, 0.6, -18);
    scene.add(mesh);
    var video = el('video', { muted: true, playsinline: true, preload: 'none', 'aria-hidden': 'true' });
    video.muted = true;
    var b = { mesh: mesh, base: mat.color.clone(), ready: false, duration: 8, lastT: -1, loaded: false };
    video.addEventListener('loadedmetadata', function () { var d = video.duration; b.duration = (isFinite(d) && d > 0.5) ? d : 8; });
    video.addEventListener('loadeddata', function () {
      mat.map = L.videoTexture(video); mat.needsUpdate = true;
      b.ready = true;
    });
    b.load = function () {
      if (b.loaded) return;
      b.loaded = true;
      video.preload = 'auto';
      video.src = L.clipSrc('orbit-books');
      video.load();
    };
    b.seek = function (p) {
      if (!b.ready) return;
      var t = p * (b.duration - 0.04);
      if (Math.abs(t - b.lastT) < 1 / 60) return;
      b.lastT = t;
      try { video.currentTime = t; } catch (e) {}
    };
    return b;
  }

  function buildDust(scene) {
    var n = 700, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var r = 2 + Math.random() * 6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({ color: 0xf2dcac, size: 0.028, transparent: true, opacity: 0.7,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    var pts = new T.Points(geo, mat);
    scene.add(pts);
    return pts;
  }

  /* ---- the DOM over the scene -------------------------------- */
  function buildUI(host, cols) {
    var copy = el('div.or-copy', {}, [
      el('div.eyebrow', { text: 'The Living Stacks' }),
      el('h1.or-title', { html: 'Every book in the building,<br>in orbit around <em>one</em>.' }),
      el('p.or-sub', { text: 'Drag to turn the orrery. Click any book and it comes to you; from there the scroll bar opens it — page by page, and everything inside stands up.' })
    ]);
    var barName = el('b'), barHall = el('span');
    var bar = el('div.or-bar', {}, [
      el('button.btn.btn-sm.or-back', { type: 'button', onclick: function () { api.onClose && api.onClose(); } }, '← Put it back'),
      el('div.or-bar-name', {}, [barName, barHall]),
      el('button.btn.btn-sm.btn-primary.or-browse', { type: 'button', 'data-ripple': '', onclick: function () { api.onBrowse && api.onBrowse(); } }, 'Open the shelf →')
    ]);
    var chips = [{ key: 'aurelia', n: '∎', name: 'Aurelia' }].concat(cols.map(function (c) { return { key: c.key, n: c.n, name: c.name }; }))
      .map(function (c) {
        return el('button.or-chip', { type: 'button', 'data-book': c.key, onclick: function () { api.onPick && api.onPick(c.key); } }, [
          el('i', { style: { background: L.CLOTH_CSS[c.key] || L.CLOTH_CSS.aurelia } }),
          el('span.or-chip-n', { text: c.n }),
          el('span.or-chip-name', { text: c.name })
        ]);
      });
    var progress = el('span');
    var tag = el('div.l3-tag', {}, [el('span'), el('b')]);
    var root = el('div.or-ui', {}, [
      copy, bar, tag,
      el('div.or-cue', {}, [el('span', { text: 'Scroll to open the book' }), el('i')]),
      el('div.or-hint', { text: 'Drag to turn · click a book · scroll to read' }),
      el('nav.or-index', { 'aria-label': 'Books' }, chips),
      el('div.or-progress', {}, progress)
    ]);
    var api = {
      root: root, progress: progress,
      tag: function (label, sub, point, camera, canvas) {
        if (!label) { tag.classList.remove('is-in'); return; }
        var v = point.clone().project(camera);
        var r = canvas.getBoundingClientRect(), hr = host.getBoundingClientRect();
        tag.style.left = (r.left - hr.left + (v.x + 1) / 2 * r.width) + 'px';
        tag.style.top = (r.top - hr.top + (1 - v.y) / 2 * r.height) + 'px';
        tag.firstChild.textContent = label; tag.lastChild.textContent = sub;
        tag.classList.add('is-in');
      },
      reading: function (en) {
        root.classList.add('is-reading');
        barName.textContent = en.col ? en.col.name : 'Aurelia';
        barHall.textContent = en.col ? en.col.n + ' · ' + en.col.hall : 'The Great Book';
        chips.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-book') === en.key); });
      },
      idle: function () {
        root.classList.remove('is-reading');
        chips.forEach(function (c) { c.classList.remove('is-active'); });
      }
    };
    return api;
  }

  function buildFallback(cols, opts) {
    return el('div.or-fallback', {}, cols.map(function (c) {
      var beat = firstBeat(c.key);
      return el('a.or-card', { href: 'app.html#/opac?collection=' + c.key, style: { '--cloth': L.CLOTH_CSS[c.key] } }, [
        beat ? el('img', { src: L.BASE + beat + '.jpg', alt: '', loading: 'lazy' }) : null,
        el('span.or-card-n', { text: c.n }),
        el('b', { text: c.name }),
        el('span', { text: c.hall })
      ]);
    }));
  }

  LS.Orrery = { mount: mount, SPAN: SPAN };
})(window);
