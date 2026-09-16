/* ============================================================
   hall3d.js — the room.

   Inside every hall of the tour the footage is not behind the
   scene, it is the scene: the clip is wrapped round you as the
   floor and a curved wall, so dragging turns your head inside the
   shot and scrolling walks you into it while the film scrubs. The
   things in the footage are hotspots (hotspots.js): the book on the
   table turns the page, the whale opens its record, the door walks
   you on. The titles on the hall's shelf float in the room in front
   of the wall; click one and it comes down to you, click it again
   and it opens, with the hall's own clip standing up out of the
   page. Escape, or a click away, puts it back.

   LS.Hall3D.create(stageEl, { def, col, beats }, { onReserve, goBeat, go, poster })
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;
  var T = global.THREE;
  var L = LS.Living3D;

  /* the room: a cylinder wall of radius RW spanning PHI radians, the
     lower VF of every frame laid on the floor in front of it */
  var RW = 5.5, PHI = 2.4, VF = 0.38, FRAME = 2.234;
  var HW = (RW * PHI / FRAME) * (1 - VF);
  var EYE = 1.05;
  var CAM_REST = 2.2, CAM_WALK = 1.6;     // you stand back from the room, and scrolling walks you in
  var NEAR_W = 5.2;                       // width of the floor where it passes under you
  var XFADE = 0.10;
  var FOV = 42, FOV_LOOK = 28;
  /* the surface runs a little past the frame on every side, repeating the
     edge pixels, so a turn of the head never finds the end of the picture */
  var EXT_U = 0.10, EXT_V0 = -0.35, EXT_V1 = 1.2;
  /* where the books hang: heading (rad), height above the eye, distance */
  var SLOTS = [[-0.50, 0.55, 3.0], [-0.18, 0.30, 3.6], [0.14, 0.64, 2.9], [0.46, 0.36, 3.4], [-0.34, -0.02, 4.0], [0.62, 0.02, 3.1]];

  /* the wall is a cylinder; the floor runs from a straight line under your
     feet to the foot of the wall, so nothing pinches to a point */
  function surf(u, v, out) {
    var phi = (u - 0.5) * PHI;
    var wx = RW * Math.sin(phi), wz = -RW * Math.cos(phi);
    if (v >= VF) return out.set(wx, HW * (v - VF) / (1 - VF), wz);
    var t = v <= 0 ? v / VF : Math.pow(v / VF, 0.9);
    var nx = (u - 0.5) * NEAR_W, nz = CAM_REST - 0.7;
    return out.set(nx + (wx - nx) * t, 0, nz + (wz - nz) * t);
  }
  function roomGeometry() {
    var geo = new T.PlaneGeometry(1, 1, 128, 72);
    var pos = geo.attributes.position, uv = geo.attributes.uv, tmp = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      var u = -EXT_U + (pos.getX(i) + 0.5) * (1 + 2 * EXT_U);
      var v = EXT_V0 + (pos.getY(i) + 0.5) * (EXT_V1 - EXT_V0);
      surf(u, v, tmp);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      uv.setXY(i, Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)));
    }
    pos.needsUpdate = true; uv.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  /** crop a clip of another aspect to the room's frame instead of stretching it */
  function fitTexture(tex, aspect) {
    if (!aspect || !isFinite(aspect)) return;
    tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
    if (aspect < FRAME) { tex.repeat.set(1, aspect / FRAME); tex.offset.set(0, (1 - aspect / FRAME) / 2); }
    else { tex.repeat.set(FRAME / aspect, 1); tex.offset.set((1 - FRAME / aspect) / 2, 0); }
  }

  function create(stageEl, hall, opts) {
    opts = opts || {};
    if (!L || !L.supported || !global.gsap) return null;
    var def = hall.def, col = hall.col || null, beats = hall.beats || [];
    var n = beats.length;

    var ctrl = { slot: null, baseFov: FOV, update: update, onFit: onFit, onStolen: deactivate };
    var scene = ctrl.scene = new T.Scene();
    var camera = ctrl.camera = new T.PerspectiveCamera(FOV, 1, 0.05, 60);
    camera.position.set(0, EYE, 0);
    scene.add(camera);
    var lights = L.lightRig(scene);
    lights.key.position.set(2.5, 4.5, -1.5);
    lights.fill.position.set(0, 1.6, -1.5);

    /* ---- the footage, wrapped round you --------------------------- */
    var geo = roomGeometry();
    var matA = new T.MeshBasicMaterial({ transparent: true, opacity: 1, toneMapped: false, side: T.DoubleSide });
    var matB = new T.MeshBasicMaterial({ transparent: true, opacity: 0, toneMapped: false, side: T.DoubleSide, depthWrite: false });
    var roomA = new T.Mesh(geo, matA), roomB = new T.Mesh(geo, matB);
    roomB.renderOrder = 1;
    scene.add(roomA, roomB);
    var dim = { v: 1 };                         // the room steps back while a book is down
    var tint = new T.Color();

    var films = beats.map(function (b) {
      var f = { beat: b, tex: null, video: b.video, ready: false };
      var poster = new T.TextureLoader().load(L.BASE + b.def.src + '.jpg', function (t) {
        t.colorSpace = T.SRGBColorSpace;
        fitTexture(t, t.image.width / t.image.height);
        if (!f.ready) { f.tex = t; }
      });
      poster.colorSpace = T.SRGBColorSpace;
      f.tex = poster;
      function useVideo() {
        if (f.ready || !f.video || f.video.readyState < 2) return;
        f.ready = true;
        var vt = L.videoTexture(f.video);
        fitTexture(vt, f.video.videoWidth / f.video.videoHeight);
        f.tex = vt;
      }
      if (f.video) {
        f.video.addEventListener('loadeddata', useVideo);
        useVideo();
      }
      return f;
    });

    /* ---- what you can click in the footage ----------------------- */
    var spotGroup = new T.Group();
    scene.add(spotGroup);
    var spotSets = {};                          // beat index -> [{ quad, ring, h, centre }]
    var ringGeo = new T.RingGeometry(0.05, 0.064, 40);
    var dotGeo = new T.CircleGeometry(0.018, 24);
    function spotsFor(i) {
      if (spotSets[i]) return spotSets[i];
      var list = (LS.Hotspots ? LS.Hotspots.of(beats[i].def.src) : []).map(function (h) {
        var c = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
        surf(h.x, 1 - h.y, c[0]); surf(h.x + h.w, 1 - h.y, c[1]);
        surf(h.x + h.w, 1 - h.y - h.h, c[2]); surf(h.x, 1 - h.y - h.h, c[3]);
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute([
          c[0].x, c[0].y, c[0].z, c[1].x, c[1].y, c[1].z, c[2].x, c[2].y, c[2].z,
          c[0].x, c[0].y, c[0].z, c[2].x, c[2].y, c[2].z, c[3].x, c[3].y, c[3].z], 3));
        var quad = new T.Mesh(g, new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide }));
        quad.userData.hotspot = h;
        var centre = surf(h.x + h.w / 2, 1 - h.y - h.h / 2, new T.Vector3());
        var ring = new T.Group();
        var rm = new T.MeshBasicMaterial({ color: L.GOLD, transparent: true, opacity: 0.8, depthTest: false });
        ring.add(new T.Mesh(ringGeo, rm), new T.Mesh(dotGeo, rm));
        ring.position.copy(centre).multiplyScalar(0.985);
        ring.renderOrder = 3;
        ring.userData.hotspot = h;
        var s = { quad: quad, ring: ring, mat: rm, h: h, centre: centre, phi: (h.x + h.w / 2 - 0.5) * PHI };
        spotGroup.add(quad, ring);
        return s;
      });
      spotSets[i] = list;
      return list;
    }
    var liveSpots = [];
    function showSpots(i) {
      Object.keys(spotSets).forEach(function (k) { spotSets[k].forEach(function (s) { s.quad.visible = false; s.ring.visible = false; }); });
      liveSpots = i >= 0 && i < n ? spotsFor(i) : [];
      liveSpots.forEach(function (s) { s.quad.visible = true; s.ring.visible = true; });
    }

    /* ---- the shelf, floating in the room ------------------------- */
    var bibs = col ? E.db().bibs.filter(function (b) { return b.collection === col.key; }).slice(0, SLOTS.length) : [];
    var poster0 = beats[0] ? L.BASE + beats[0].def.src + '.jpg' : null;
    var entries = bibs.map(function (b, i) {
      var holder = new T.Group();
      var book = new L.Book({ key: col.key, title: b.title, author: b.author, n: b.dewey,
        faces: LS.BookFaces.bib(b, col, beats[0] ? beats[0].def.src : null) });
      holder.add(book.group);
      book.group.scale.setScalar(0.5);
      book.group.position.set(-book.w / 2 * 0.5, 0, -(book.t + 0.052) / 2 * 0.5);
      scene.add(holder);
      return { bib: b, book: book, holder: holder, seed: i * 1.7, slot: SLOTS[i] };
    });
    if (poster0) L.loadImage(poster0, function (img) {
      if (img) entries.forEach(function (e) { e.book.setCoverImage(img); });
    });

    var reader = L.Reader(scene, camera, { dist: 3.3, tilt: 0.58, y: -0.12 });
    var hint = el('div.l3-hint', {}, [el('span')]);
    var tag = el('div.l3-tag', {}, [el('span'), el('b')]);
    stageEl.appendChild(hint);
    stageEl.appendChild(tag);

    var state = { p: 0, ps: 0, yaw: 0, pitch: 0, yawT: 0, pitchT: 0, par: 0, look: null, fov: FOV,
                  beat: -1, taken: null, opened: false, busy: false, hovered: null, hoverSpot: null };
    var ray = new T.Raycaster();
    var ndc = new T.Vector2();
    var tmpV = new T.Vector3(), tgt = new T.Vector3();

    function onFit(w, h) { reader.fit(); }

    /* ---- every frame ---------------------------------------------- */
    function update(dt, t) {
      state.ps += (state.p - state.ps) * Math.min(1, dt * 5);
      if (!isFinite(state.ps)) state.ps = state.p || 0;
      var k = Math.min(1, dt * 6);
      var camZ = CAM_REST - state.ps * CAM_WALK;
      var halfH = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
      var edge = PHI / 2 + EXT_U * PHI;
      var wallHalf = Math.atan2(RW * Math.sin(edge), RW * Math.cos(edge) + camZ);
      state.maxYaw = Math.max(0.12, wallHalf - halfH - 0.02);
      state.yawT = L.clamp(state.yawT, -state.maxYaw, state.maxYaw);
      var lookYaw = state.look ? state.look.phi : state.yawT;
      state.yaw += (lookYaw + (state.taken ? 0 : state.par) - state.yaw) * k;
      state.pitch += ((state.look ? state.look.pitch : state.pitchT) - state.pitch) * k;
      var fov = state.look ? FOV_LOOK : FOV;
      if (Math.abs(fov - state.fov) > 0.05) {
        state.fov += (fov - state.fov) * k;
        camera.fov = ctrl.height && ctrl.width / ctrl.height < 1 ? Math.min(70, state.fov * Math.pow(ctrl.height / ctrl.width, 0.72)) : state.fov;
        camera.updateProjectionMatrix();
      }
      camera.position.set(0, EYE, camZ);
      var cp = Math.cos(state.pitch * 0.6), sp = Math.sin(state.pitch * 0.6 - 0.04);
      tgt.set(camZ * 0 + Math.sin(state.yaw) * cp * 6, EYE + sp * 6, camZ - Math.cos(state.yaw) * cp * 6);
      camera.lookAt(tgt);

      /* the film: which beat is on the wall, and the crossfade to the next */
      if (n) {
        var x = state.ps * n, cur = Math.min(n - 1, Math.floor(x)), frac = x - cur;
        var nxt = cur + 1 < n ? cur + 1 : -1;
        var oB = nxt >= 0 ? Math.max(0, 1 - (1 - frac) / XFADE) : 0;
        var fA = films[cur], fB = nxt >= 0 ? films[nxt] : null;
        if (fA && matA.map !== fA.tex) { matA.map = fA.tex; matA.needsUpdate = true; }
        if (fB && matB.map !== fB.tex) { matB.map = fB.tex; matB.needsUpdate = true; }
        matB.opacity = oB;
        roomB.visible = oB > 0.001;
        dim.v += ((state.taken ? 0.28 : 1) - dim.v) * Math.min(1, dt * 4);
        tint.setScalar(dim.v);
        matA.color.copy(tint); matB.color.copy(tint);
        var shown = oB > 0.5 && nxt >= 0 ? nxt : cur;
        if (shown !== state.beat) { state.beat = shown; showSpots(state.taken ? -1 : shown); }
      }
      /* the markers face you and keep their size */
      var pulse = 0.55 + 0.3 * Math.sin(t * 2.6);
      liveSpots.forEach(function (s) {
        var d = camera.position.distanceTo(s.ring.position);
        s.ring.scale.setScalar(d * (s === state.hoverSpot ? 0.05 : 0.034));
        s.ring.lookAt(camera.position);
        s.mat.opacity = s === state.hoverSpot ? 1 : pulse;
        var b = beats[state.beat];
        if (s.h.t && b) {
          var lt = (state.ps * n - state.beat) * (b.duration || 8);
          var on = lt >= s.h.t[0] && lt <= s.h.t[1];
          s.ring.visible = on; s.quad.visible = on;
        }
      });
      if (state.hoverSpot) placeTag(state.hoverSpot.centre);

      entries.forEach(function (e) {
        if (e === state.taken) return;
        var s = e.slot, a = s[0];
        e.holder.position.set(Math.sin(a) * s[2], EYE + s[1] + Math.sin(t * 0.7 + e.seed) * 0.06, -Math.cos(a) * s[2]);
        e.holder.rotation.set(Math.sin(t * 0.5 + e.seed) * 0.08, -a + Math.sin(t * 0.35 + e.seed) * 0.22, Math.cos(t * 0.3 + e.seed) * 0.05);
      });
      reader.update();
    }

    function placeTag(p3) {
      if (!ctrl.slot) return;
      tmpV.copy(p3).project(camera);
      var r = ctrl.slot.canvas.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
      tag.style.left = (r.left - sr.left + (tmpV.x + 1) / 2 * r.width) + 'px';
      tag.style.top = (r.top - sr.top + (1 - tmpV.y) / 2 * r.height) + 'px';
    }
    function showTag(label, sub) {
      tag.firstChild.textContent = label;
      tag.lastChild.textContent = sub || '';
      tag.classList.add('is-in');
    }
    function hideTag() { tag.classList.remove('is-in'); }

    /* ---- pointer ---------------------------------------------------- */
    function castAt(e) {
      L.ndc(e, ctrl.slot.canvas, ndc);
      ray.setFromCamera(ndc, camera);
      var targets = [];
      entries.forEach(function (x) { targets = targets.concat(x.book.hit); });
      if (!state.taken) liveSpots.forEach(function (s) { targets.push(s.quad); });
      var hits = ray.intersectObjects(targets, false);
      return hits.length ? hits[0] : null;
    }
    function entryOf(hit) {
      var b = hit && hit.object.userData.book;
      for (var i = 0; i < entries.length; i++) if (entries[i].book === b) return entries[i];
      return null;
    }
    function spotOf(hit) {
      var h = hit && hit.object.userData.hotspot;
      if (!h) return null;
      for (var i = 0; i < liveSpots.length; i++) if (liveSpots[i].h === h) return liveSpots[i];
      return null;
    }
    var drag = null, moveQueued = false, lastMove = null;
    function onDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, yaw: state.yawT, pitch: state.pitchT, moved: false };
      try { ctrl.slot.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) drag.moved = true;
        if (drag.moved && !state.taken) {
          state.look = null;
          state.yawT = L.clamp(drag.yaw - dx * 0.0032, -(state.maxYaw || 0.5), state.maxYaw || 0.5);
          state.pitchT = L.clamp(drag.pitch + dy * 0.0016, -0.22, 0.30);
          stageEl.classList.add('is-dragging');
        }
        return;
      }
      lastMove = e;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(function () {
        moveQueued = false;
        if (!ctrl.slot || !lastMove) return;
        var r = ctrl.slot.canvas.getBoundingClientRect();
        state.par = ((lastMove.clientX - r.left) / r.width - 0.5) * 0.06;   // a little look-around under the pointer
        var hit = castAt(lastMove), canvas = ctrl.slot.canvas;
        var en = entryOf(hit), sp = spotOf(hit);
        if (!state.taken) {
          setHover(en);
          setHoverSpot(sp);
          canvas.style.cursor = (en || sp) ? 'pointer' : 'grab';
        } else {
          var hs = hit && en === state.taken && state.opened ? state.taken.book.hotspotAt(hit) : null;
          var hot = hit && en === state.taken && state.opened ? state.taken.book.hotAt(hit) : null;
          if (hs) { showTag(hs.hotspot.label, 'in the film'); placeTagAtHit(hit); } else hideTag();
          canvas.style.cursor = (hot || hs || (en === state.taken && !state.opened)) ? 'pointer' : 'default';
        }
      });
    }
    function placeTagAtHit(hit) {
      var r = ctrl.slot.canvas.getBoundingClientRect(), sr = stageEl.getBoundingClientRect();
      tmpV.copy(hit.point).project(camera);
      tag.style.left = (r.left - sr.left + (tmpV.x + 1) / 2 * r.width) + 'px';
      tag.style.top = (r.top - sr.top + (1 - tmpV.y) / 2 * r.height) + 'px';
    }
    function onUp(e) {
      var d = drag; drag = null;
      stageEl.classList.remove('is-dragging');
      if (!d || d.moved) return;
      var hit = castAt(e), en = entryOf(hit), sp = spotOf(hit);
      if (!state.taken) {
        if (en) { take(en); return; }
        if (sp) { actSpot(sp); return; }
        if (state.look) state.look = null;
        return;
      }
      if (en === state.taken) {
        if (!state.opened) { open(); return; }
        var hs = state.taken.book.hotspotAt(hit);
        if (hs) { act(hs.hotspot.action, hs); return; }
        var hot = state.taken.book.hotAt(hit);
        if (hot) act(hot.action);
        return;
      }
      putBack();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.sw-open.is-in')) return; // an open reservation dialog owns this Escape
      if (state.taken) putBack();
      else if (state.look) state.look = null;
    }
    function setHover(en) {
      if (state.hovered === en) return;
      if (state.hovered) gsap.to(state.hovered.holder.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' });
      state.hovered = en;
      if (en) {
        gsap.to(en.holder.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.4, ease: 'power2.out' });
        showTag(en.bib.title, 'take it down'); placeTag(en.holder.position);
      } else if (!state.hoverSpot) hideTag();
    }
    function setHoverSpot(sp) {
      if (state.hoverSpot === sp) return;
      state.hoverSpot = sp;
      if (sp) { showTag(sp.h.label, verb(sp.h.action)); placeTag(sp.centre); }
      else if (!state.hovered) hideTag();
    }
    function verb(a) {
      return { turn: 'turn the page', reserve: 'open the record', look: 'look closer', book: 'take one down', hall: 'walk there' }[a.type] || '';
    }

    /* ---- what a click does ------------------------------------------ */
    function actSpot(sp) {
      var a = sp.h.action;
      if (a.type === 'look') {
        state.look = state.look && state.look.spot === sp ? null : { spot: sp, phi: L.clamp(sp.phi, -(state.maxYaw || 0.5), state.maxYaw || 0.5), pitch: L.clamp((sp.centre.y - EYE) / 2.4, -0.22, 0.3) };
        return;
      }
      act(a, null);
    }
    function act(a, hs) {
      switch (a.type) {
        case 'turn':
          if (opts.goBeat) opts.goBeat(state.beat + 1);
          break;
        case 'reserve':
          var bib = LS.Hotspots.resolveBib(a.match, col && col.key);
          if (opts.onReserve) opts.onReserve(bib);
          else if (LS.ShelfWalk) LS.ShelfWalk.openBook(bib);
          break;
        case 'book':
          if (entries.length && !state.taken) take(entries[0]);
          break;
        case 'hall':
          if (opts.go) opts.go(a.key);
          break;
        case 'look':
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
    function fadeOthers(current, o) {
      entries.forEach(function (e) {
        if (e === current) return;
        var pr = { o: e.opacity === undefined ? 1 : e.opacity };
        gsap.to(pr, { o: o, duration: 0.8, ease: 'power2.inOut', onUpdate: function () { e.book.setOpacity(pr.o); e.opacity = pr.o; } });
      });
    }
    function take(en) {
      if (state.busy || reader.busy) return;
      setHover(null); setHoverSpot(null); hideTag();
      state.busy = true;
      state.taken = en;
      state.look = null;
      showSpots(-1);
      if (!en.book.built) en.book.build();
      en.book.loadFilms();
      stageEl.classList.add('is-reading');
      fadeOthers(en, 0.16);
      say('Click the book to open it');
      reader.take(en.book, function () { state.busy = false; });
    }
    function open() {
      if (state.busy || state.opened) return;
      state.opened = true;
      state.busy = true;
      var tl = { a: 0 };
      stageEl.classList.add('is-open');
      say('Click a title to reserve it · click the film · Esc puts it back');
      gsap.to(tl, { a: 1, duration: 1.7, ease: 'power2.inOut',
        onUpdate: function () { state.taken.book.setTimeline(tl.a); reader.update(); },
        onComplete: function () { state.busy = false; } });
    }
    function putBack(instant) {
      var en = state.taken;
      if (!en) return;
      hideTag();
      if (instant) {
        en.book.setTimeline(0);
        reader.drop();
        state.taken = null; state.opened = false; state.busy = false;
        entries.forEach(function (e) { e.book.setOpacity(1); e.opacity = 1; });
        stageEl.classList.remove('is-reading', 'is-open');
        showSpots(state.beat);
        say('');
        return;
      }
      if (state.busy || reader.busy) return;
      state.busy = true;
      var tl = { a: en.book.timeline };
      say('');
      stageEl.classList.remove('is-open');
      gsap.to(tl, { a: 0, duration: 0.6, ease: 'power2.inOut',
        onUpdate: function () { en.book.setTimeline(tl.a); reader.update(); },
        onComplete: function () {
          reader.putBack(function () {
            state.taken = null; state.opened = false; state.busy = false;
            showSpots(state.beat);
          });
          fadeOthers(null, 1);
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
      scene.environment = slot.env;
      if (poster0) L.envFrom(slot, poster0, function (env) { if (ctrl.slot === slot) scene.environment = env; });
      L.fit(ctrl, stageEl);
      L.run(ctrl);
      slot.canvas.addEventListener('pointerdown', onDown);
      slot.canvas.addEventListener('pointermove', onMove);
      slot.canvas.addEventListener('pointerup', onUp);
      slot.canvas.addEventListener('pointercancel', onUp);
      if (!bound) { document.addEventListener('keydown', onKey); bound = true; }
      stageEl.classList.add('is-room');
      say('Drag to look round · click what you see');
      setTimeout(function () { if (!state.taken) say(''); }, 3600);
    }
    function deactivate() {
      if (!ctrl.slot) return;
      var slot = ctrl.slot;
      if (state.taken) putBack(true);
      state.look = null;
      slot.canvas.removeEventListener('pointerdown', onDown);
      slot.canvas.removeEventListener('pointermove', onMove);
      slot.canvas.removeEventListener('pointerup', onUp);
      slot.canvas.removeEventListener('pointercancel', onUp);
      L.halt(ctrl);
      L.release(slot);
      ctrl.slot = null;
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
      destroy: function () {
        deactivate();
        document.removeEventListener('keydown', onKey);
        global.removeEventListener('resize', onResize);
        entries.forEach(function (e) { e.book.dispose(); });
        geo.dispose();
        if (hint.parentNode) hint.parentNode.removeChild(hint);
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      },
      state: state, entries: entries, ctrl: ctrl, reader: reader, spots: function () { return liveSpots; }
    };
  }

  LS.Hall3D = { create: create, surf: surf };
})(window);
