/* ============================================================
   living3d.js — the 3D layer of the Living Stacks.

   One pool of WebGL renderers (two contexts, handed to whichever
   pinned stage is on screen), a book you can take off the shelf,
   open and read: every page is a canvas, and the films on the pages
   are the clips themselves, as textures, standing up out of the
   spread like pop-ups and moved by the scroll bar. The things in
   them are clickable (see hotspots.js).

   Nothing here is a video playing on its own: the clips are
   textures inside the scene and they move with the scroll bar.

   LS.Living3D.supported
   LS.Living3D.acquire(owner) / release(slot)        renderer pool
   LS.Living3D.run(ctrl) / halt(ctrl)                render loop
   LS.Living3D.fit(ctrl, host)                       size to a host
   LS.Living3D.lightRig(scene)                       lights
   LS.Living3D.Book(spec)                            a book
   LS.Living3D.Reader(scene, camera, opts)           take, open, put back
   LS.Living3D.pages                                 canvas typesetting
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;
  var T = global.THREE;

  var BASE = 'public/scenes/';
  var MOBILE = !!(global.matchMedia && global.matchMedia('(max-width: 720px)').matches);
  function clipSrc(slug) { return BASE + slug + (MOBILE ? '-m' : '') + '.mp4'; }

  var lite = false;
  var supported = (function () {
    if (!T) return false;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      lite = /swiftshader|llvmpipe|software/i.test(name) || /lite=1/.test(location.search);
      return true;
    } catch (e) { return false; }
  })();

  /* ---------- palette ------------------------------------------ */
  var GOLD = 0xd6b774;
  var PAPER = '#f1e9d9';
  var INK = '#2a2420';
  var INK_SOFT = '#6a6054';
  var GOLD_INK = '#8a6a2a';
  var FONT_D = '"Cormorant Garamond","Iowan Old Style","Palatino Linotype",Georgia,serif';
  var FONT_U = 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  var FONT_M = '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace';

  var CLOTH = {
    kids: 0x2f6f9f, adult: 0x4a2b2b, voyages: 0x1f4f5a, science: 0x2c3f5e,
    technology: 0x2b2f38, history: 0x5a3a22, ancient: 0x6a4b1e, civilization: 0x3f2d4d,
    mythology: 0x2d4a3a, horror: 0x1a1216, aurelia: 0x3a2515
  };
  var CLOTH_CSS = {};
  Object.keys(CLOTH).forEach(function (k) { CLOTH_CSS[k] = '#' + ('000000' + CLOTH[k].toString(16)).slice(-6); });

  function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ============================================================
     renderer pool + loop
     ============================================================ */
  var pool = [];
  var MAX = 2;

  function makeSlot() {
    var canvas = document.createElement('canvas');
    canvas.className = 'l3-canvas';
    var r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true,
                                  powerPreference: 'high-performance' });
    r.setPixelRatio(lite ? 1 : Math.min(global.devicePixelRatio || 1, 1.75));
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = !lite;
    r.shadowMap.type = T.PCFShadowMap;
    r.setClearColor(0x000000, 0);
    var pm = new T.PMREMGenerator(r);
    var env = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    return { renderer: r, canvas: canvas, env: env, pmrem: pm, owner: null, envCache: {} };
  }

  function acquire(owner) {
    var slot = null;
    for (var i = 0; i < pool.length; i++) if (!pool[i].owner) { slot = pool[i]; break; }
    if (!slot) {
      if (pool.length < MAX) { slot = makeSlot(); pool.push(slot); }
      else {
        slot = pool[0];                              // least recently used
        if (slot.owner && slot.owner.onStolen) slot.owner.onStolen();
        slot.owner = null;
      }
    }
    pool.splice(pool.indexOf(slot), 1);
    pool.push(slot);
    slot.owner = owner;
    return slot;
  }
  function release(slot) {
    if (!slot) return;
    slot.owner = null;
    if (slot.canvas.parentNode) slot.canvas.parentNode.removeChild(slot.canvas);
  }

  /** a reflection environment tinted by one of the clips' posters, so the
      leather and gilt of the books pick up the light of the hall they float in */
  function envFrom(slot, src, done) {
    if (slot.envCache[src]) { done(slot.envCache[src]); return; }
    new T.TextureLoader().load(src, function (tex) {
      tex.mapping = T.EquirectangularReflectionMapping;
      tex.colorSpace = T.SRGBColorSpace;
      var env = slot.pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      slot.envCache[src] = env;
      done(env);
    }, undefined, function () { done(slot.env); });
  }

  var active = [];
  var raf = 0, last = 0;
  function run(ctrl) {
    if (active.indexOf(ctrl) === -1) active.push(ctrl);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function halt(ctrl) {
    var i = active.indexOf(ctrl);
    if (i > -1) active.splice(i, 1);
    if (!active.length && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (var i = 0; i < active.length; i++) {
      var c = active[i];
      if (!c.slot) continue;
      if (c.update) c.update(dt, now / 1000);
      c.slot.renderer.render(c.scene, c.camera);
    }
  }

  function fit(ctrl, host) {
    var w = host.clientWidth || 1, h = host.clientHeight || 1;
    ctrl.slot.renderer.setSize(w, h, false);
    var aspect = w / h;
    ctrl.camera.aspect = aspect;
    var base = ctrl.baseFov || 34;
    ctrl.camera.fov = aspect < 1 ? Math.min(62, base * Math.pow(1 / aspect, 0.72)) : base;
    ctrl.camera.updateProjectionMatrix();
    ctrl.width = w; ctrl.height = h;
    if (ctrl.onFit) ctrl.onFit(w, h);
  }

  function lightRig(scene) {
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.5;
    var hemi = new T.HemisphereLight(0xffe6c0, 0x1a1410, 0.42);
    var key = new T.DirectionalLight(0xffdcae, 1.55);
    key.position.set(3.5, 5.5, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(lite ? 256 : 1024, lite ? 256 : 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 40;
    key.shadow.bias = -0.0006;
    key.shadow.radius = 4;
    var rim = new T.DirectionalLight(GOLD, 1.1);
    rim.position.set(-5, 2.5, -4);
    var fill = new T.PointLight(GOLD, 9, 22, 2);
    fill.position.set(0, 1.4, 3.2);
    scene.add(hemi, key, rim, fill);
    return { hemi: hemi, key: key, rim: rim, fill: fill };
  }

  /** a clip as a texture. THREE.VideoTexture uploads a frame only when the
      browser presents one (requestVideoFrameCallback), so a seeked, paused
      clip costs nothing between seeks; it also keeps the sRGB decode on the
      video path, which a plain Texture over a video element does not. */
  function videoTexture(video) {
    var tex = new T.VideoTexture(video);
    tex.colorSpace = T.SRGBColorSpace;
    tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function canvasTexture(canvas) {
    var tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /* ============================================================
     typesetting on paper
     ============================================================ */
  var pages = {
    W: 1024, H: 1448,

    paper: function (ctx, W, H, o) {
      o = o || {};
      ctx.fillStyle = o.color || PAPER;
      ctx.fillRect(0, 0, W, H);
      /* fibre */
      ctx.fillStyle = 'rgba(90,70,40,.05)';
      for (var i = 0; i < 900; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1 + Math.random() * 2);
      }
      /* gutter shade on the spine side */
      var g = o.side === 'L'
        ? ctx.createLinearGradient(W, 0, W - 160, 0)
        : ctx.createLinearGradient(0, 0, 160, 0);
      g.addColorStop(0, 'rgba(60,40,20,.20)');
      g.addColorStop(1, 'rgba(60,40,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      /* frame */
      ctx.strokeStyle = 'rgba(138,106,42,.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(58, 58, W - 116, H - 116);
      /* running head + folio */
      if (o.head) {
        pages.text(ctx, o.head, W / 2, 96, { font: FONT_U, size: 17, color: GOLD_INK,
          align: 'center', spacing: '0.28em', weight: 500, maxW: W - 200 });
      }
      if (o.folio) {
        pages.text(ctx, o.folio, W / 2, H - 78, { font: FONT_M, size: 18, color: INK_SOFT,
          align: 'center', maxW: 300 });
      }
    },

    /** word-wrapped text; returns the y just below the last line */
    text: function (ctx, str, x, y, o) {
      o = o || {};
      var size = o.size || 30;
      ctx.font = (o.italic ? 'italic ' : '') + (o.weight || 400) + ' ' + size + 'px ' + (o.font || FONT_U);
      ctx.fillStyle = o.color || INK;
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'alphabetic';
      try { ctx.letterSpacing = o.spacing || '0px'; } catch (e) {}
      var maxW = o.maxW || 1e9;
      var lh = o.lh || Math.round(size * 1.28);
      var lines = [];
      String(str).split('\n').forEach(function (para) {
        var words = para.split(/\s+/), line = '';
        words.forEach(function (w) {
          var test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
          else line = test;
        });
        lines.push(line);
      });
      if (o.upper) lines = lines.map(function (l) { return l.toUpperCase(); });
      lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
      try { ctx.letterSpacing = '0px'; } catch (e) {}
      return y + lines.length * lh;
    },

    rule: function (ctx, x, y, w, color) {
      ctx.fillStyle = color || 'rgba(138,106,42,.5)';
      ctx.fillRect(x, y, w, 2);
    },

    pill: function (ctx, label, x, y, kind) {
      ctx.font = '500 18px ' + FONT_U;
      var w = ctx.measureText(label).width + 30;
      var colors = { ok: ['rgba(60,120,80,.16)', '#2f6b4f'], warn: ['rgba(200,140,60,.18)', '#8a5a1a'],
                     gold: ['rgba(214,183,116,.28)', GOLD_INK], muted: ['rgba(0,0,0,.06)', INK_SOFT] }[kind || 'muted'];
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.roundRect(x, y - 21, w, 30, 15);
      ctx.fill();
      ctx.fillStyle = colors[1];
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 15, y);
      return w;
    },

    button: function (ctx, label, x, y, w, primary) {
      var h = 64;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      if (primary) {
        var g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#c9a45c'); g.addColorStop(1, '#e8cf94');
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = '#1b1510';
      } else {
        ctx.strokeStyle = 'rgba(42,36,32,.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = INK;
      }
      ctx.font = '500 22px ' + FONT_U;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      return { x0: x, y0: y, x1: x + w, y1: y + h };
    },

    image: function (ctx, img, x, y, w, h) {
      if (!img || !img.naturalWidth) {
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x, y, w, h); return;
      }
      var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      var sw = w / s, sh = h / s;
      ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    }
  };

  /* ============================================================
     a book
     ============================================================ */
  var CT = 0.026;          // board thickness
  var CURL = 0.55;

  /**
   * spec: { key, w, h, t, cloth, cover: canvas|null, coverImage: src|null,
   *         title, author, faces: [face...] }
   * face: { draw(ctx, W, H) -> hot[], film: 'slug'|null, filmRect, pop }
   * faces.length = 2 + 2 * sheets: [inside front cover, s0 front, s0 back, s1 front, ..., inside back]
   */
  function Book(spec) {
    var self = this;
    this.spec = spec;
    this.key = spec.key;
    var w = this.w = spec.w || 1.0, h = this.h = spec.h || 1.42, t = this.t = spec.t || 0.10;
    var cloth = spec.cloth || CLOTH[spec.key] || CLOTH.aurelia;

    var g = this.group = new T.Group();
    g.userData.book = this;
    this.hit = [];

    var edge = this.edgeMat = new T.MeshStandardMaterial({ color: cloth, roughness: 0.62, metalness: 0.04 });
    var paperEdge = new T.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.92 });
    var inside = new T.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });

    var coverMat = this.coverMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.06 });
    var backMat = new T.MeshStandardMaterial({ color: cloth, roughness: 0.6, metalness: 0.04 });
    var insideFront = this.insideFrontMat = new T.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });

    /* cover art */
    this.coverCanvas = spec.cover || makeCover(spec, cloth);
    coverMat.map = canvasTexture(this.coverCanvas);
    coverMat.needsUpdate = true;

    /* spine art */
    var spineMat = new T.MeshStandardMaterial({ map: canvasTexture(makeSpine(spec, cloth)), roughness: 0.6 });

    var back = new T.Mesh(new T.BoxGeometry(w, h, CT), [edge, edge, edge, edge, inside, backMat]);
    back.position.set(w / 2, 0, CT / 2);
    var block = new T.Mesh(new T.BoxGeometry(w * 0.965, h * 0.955, t), paperEdge);
    block.position.set(w * 0.4825 + w * 0.012, 0, CT + t / 2);
    var hinge = this.hinge = new T.Group();
    hinge.position.set(0, 0, CT + t);
    var front = new T.Mesh(new T.BoxGeometry(w, h, CT), [edge, edge, edge, edge, coverMat, insideFront]);
    front.position.set(w / 2, 0, CT / 2);
    hinge.add(front);
    var spine = new T.Mesh(new T.BoxGeometry(CT, h, t + 2 * CT), [spineMat, edge, edge, edge, edge, edge]);
    spine.position.set(-CT / 2, 0, (t + 2 * CT) / 2);

    [back, block, front, spine].forEach(function (m) {
      m.castShadow = true; m.receiveShadow = true; m.userData.book = self;
      self.hit.push(m);
    });
    g.add(back, block, hinge, spine);
    this.meshes = [back, block, front, spine];
    this.front = front;

    /* the top of the page block: the last right-hand page */
    var pw = this.pw = w * 0.955, ph = this.ph = h * 0.94;
    var topGeo = new T.PlaneGeometry(pw, ph);
    topGeo.translate(pw / 2, 0, 0);
    var topMat = new T.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.92 });
    var top = this.blockTop = new T.Mesh(topGeo, topMat);
    top.position.set(w * 0.012, 0, CT + t + 0.0015);
    top.receiveShadow = true;
    top.userData.book = self;
    this.hit.push(top);
    g.add(top);

    this.sheets = [];
    this.faces = spec.faces || null;
    this.built = false;
    this.films = [];
    this.timeline = 0;
    this.home = null;
  }

  Book.prototype.sheetCount = function () {
    return this.faces ? Math.max(0, (this.faces.length - 2) / 2) : 0;
  };

  /** pages, pop-ups and the film page are only built when the book is taken */
  Book.prototype.build = function (images) {
    if (this.built || !this.faces) return;
    this.built = true;
    var self = this, faces = this.faces, N = this.sheetCount();
    var pw = this.pw, ph = this.ph, t = this.t;

    function drawFace(i) {
      var c = document.createElement('canvas');
      c.width = pages.W; c.height = pages.H;
      var ctx = c.getContext('2d');
      var hot = faces[i].draw(ctx, c.width, c.height, images || {}) || [];
      return { canvas: c, tex: canvasTexture(c), hot: hot, index: i };
    }

    /* inside front cover = face 0 */
    var f0 = drawFace(0);
    this.insideFrontMat.map = f0.tex; this.insideFrontMat.color.set(0xffffff);
    this.insideFrontMat.needsUpdate = true;
    this.front.userData.face = f0;
    this.front.userData.faceSide = 'inside';

    /* sheets */
    for (var j = 0; j < N; j++) {
      var geo = new T.PlaneGeometry(pw, ph, 28, 1);
      geo.translate(pw / 2, 0, 0);
      var base = geo.attributes.position.array.slice();
      var fFront = drawFace(1 + 2 * j), fBack = drawFace(2 + 2 * j);
      fBack.tex.wrapS = T.RepeatWrapping; fBack.tex.repeat.x = -1; fBack.tex.offset.x = 1;
      var mf = new T.MeshStandardMaterial({ map: fFront.tex, roughness: 0.92, side: T.FrontSide });
      var mb = new T.MeshStandardMaterial({ map: fBack.tex, roughness: 0.92, side: T.BackSide });
      var group = new T.Group();
      var mFront = new T.Mesh(geo, mf), mBack = new T.Mesh(geo, mb);
      mFront.castShadow = true; mFront.receiveShadow = true;
      mBack.receiveShadow = true;
      mFront.userData = { book: self, face: fFront, mirrored: false };
      mBack.userData = { book: self, face: fBack, mirrored: true };
      group.add(mFront, mBack);
      group.position.set(this.w * 0.012, 0, CT + t + 0.0045 - j * 0.0008);
      this.group.add(group);
      this.hit.push(mFront, mBack);
      this.sheets.push({ group: group, geo: geo, base: base, theta: 0, j: j,
                         zRight: CT + t + 0.0045 - j * 0.0008, zLeft: CT + t + 0.0045 + j * 0.0008 });
    }

    /* the inside back cover = the block's top face = last face */
    var fl = drawFace(faces.length - 1);
    this.blockTop.material.map = fl.tex; this.blockTop.material.color.set(0xffffff);
    this.blockTop.material.needsUpdate = true;
    this.blockTop.userData.face = fl;

    /* films live on right-hand pages: right page j is sheet j's front, or
       the block top when j === N */
    for (var k = 0; k <= N; k++) {
      var fi = k < N ? 1 + 2 * k : faces.length - 1;
      var host = k < N ? this.sheets[k].group : this.blockTop;
      if (faces[fi].film) this.films.push(buildFilm(this, faces[fi].film, host, k, faces[fi].filmRect, faces[fi].pop));
    }
    this.setTimeline(this.timeline);
  };

  function makeCover(spec, cloth) {
    var c = document.createElement('canvas');
    c.width = 512; c.height = Math.round(512 * (spec.h || 1.42) / (spec.w || 1));
    var ctx = c.getContext('2d');
    var W = c.width, H = c.height;
    var css = '#' + ('000000' + cloth.toString(16)).slice(-6);
    ctx.fillStyle = css; ctx.fillRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* grain */
    ctx.fillStyle = 'rgba(0,0,0,.10)';
    for (var i = 0; i < 700; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
    /* gilt frame */
    ctx.strokeStyle = 'rgba(214,183,116,.75)'; ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = 'rgba(214,183,116,.35)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(36, 36, W - 72, H - 72);
    /* plate */
    var plate = { x: 54, y: 54, w: W - 108, h: Math.round(H * 0.46) };
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
    spec._plate = plate;
    drawCoverText(ctx, spec, W, H, plate);
    return c;
  }
  function drawCoverText(ctx, spec, W, H, plate) {
    var y = plate.y + plate.h + 44;
    ctx.save();
    ctx.fillStyle = spec.clothCss || '#000';
    ctx.globalAlpha = 0;
    ctx.restore();
    if (spec.n) pages.text(ctx, spec.n, W / 2, y, { font: FONT_M, size: 20, color: '#d6b774', align: 'center', spacing: '0.24em' });
    y += 30;
    var size = spec.big ? 62 : 46;
    y = pages.text(ctx, spec.title || '', W / 2, y + size, { font: FONT_D, size: size, color: '#f6f1e7',
      align: 'center', maxW: W - 110, lh: size * 1.02, weight: 500 });
    if (spec.author) {
      y = pages.text(ctx, spec.author, W / 2, y + 22, { font: FONT_U, size: 19, color: 'rgba(246,241,231,.72)',
        align: 'center', maxW: W - 120, spacing: '0.06em' });
    }
    if (spec.sub) {
      pages.text(ctx, spec.sub, W / 2, H - 70, { font: FONT_U, size: 15, color: '#d6b774',
        align: 'center', spacing: '0.26em', upper: true, maxW: W - 100 });
    }
  }
  /** once the poster is in, it goes onto the plate and the texture refreshes */
  Book.prototype.setCoverImage = function (img) {
    var c = this.coverCanvas, ctx = c.getContext('2d'), p = this.spec._plate;
    if (!p) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    pages.image(ctx, img, p.x, p.y, p.w, p.h);
    var g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(214,183,116,.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    this.coverMat.map.needsUpdate = true;
  };

  function makeSpine(spec, cloth) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 512;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#' + ('000000' + cloth.toString(16)).slice(-6);
    ctx.fillRect(0, 0, 64, 512);
    ctx.fillStyle = 'rgba(214,183,116,.8)';
    ctx.fillRect(10, 36, 44, 3); ctx.fillRect(10, 52, 44, 1.5);
    ctx.fillRect(10, 458, 44, 1.5); ctx.fillRect(10, 472, 44, 3);
    ctx.save();
    ctx.translate(32, 256); ctx.rotate(-Math.PI / 2);
    ctx.font = '500 22px ' + FONT_D; ctx.fillStyle = '#f2dcac'; ctx.textAlign = 'center';
    ctx.fillText(String(spec.title || '').slice(0, 26), 0, 8);
    ctx.restore();
    return c;
  }

  /* --- the film: one of the clips on the page, moved by the scroll bar.
     A pop film stands up out of the page as the page comes into view,
     like a pop-up; the things in it are hotspots you can click. */
  function buildFilm(book, slug, host, pageIndex, rect, pop) {
    rect = rect || { x: 0.08, y: 0.16, w: 0.84 };
    var pw = book.pw, ph = book.ph;
    var plateW = rect.w * pw, plateH = plateW * 573 / 1280;
    var video = el('video', { muted: true, playsinline: true, preload: 'none',
                              disablepictureinpicture: true, 'aria-hidden': 'true' });
    video.muted = true;
    var poster = new T.TextureLoader().load(BASE + slug + '.jpg');
    poster.colorSpace = T.SRGBColorSpace;
    var mat = new T.MeshBasicMaterial({ map: poster, toneMapped: true, side: T.DoubleSide });
    var hinge = new T.Group();
    hinge.position.set(rect.x * pw + plateW / 2, ph / 2 - rect.y * ph - plateH, 0.0035);
    var mesh = new T.Mesh(new T.PlaneGeometry(plateW, plateH), mat);
    mesh.position.set(0, plateH / 2, 0);
    mesh.castShadow = true;
    mesh.userData.book = book;
    hinge.add(mesh);
    /* a thin frame behind the plate: a card standing on the page */
    var card = new T.Mesh(new T.PlaneGeometry(plateW + 0.03, plateH + 0.03),
      new T.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9, side: T.DoubleSide }));
    card.position.set(0, plateH / 2, -0.002);
    card.castShadow = true;
    hinge.add(card);
    host.add(hinge);
    var film = { slug: slug, video: video, mesh: mesh, hinge: hinge, page: pageIndex, pop: !!pop,
                 ready: false, duration: 8, lastT: -1, loaded: false, tex: null, spots: [] };
    /* what you can click inside the clip */
    var spots = LS.Hotspots ? LS.Hotspots.of(slug) : [];
    spots.forEach(function (h) {
      var q = new T.Mesh(new T.PlaneGeometry(plateW * h.w, plateH * h.h),
        new T.MeshBasicMaterial({ visible: false }));
      q.position.set(-plateW / 2 + plateW * (h.x + h.w / 2), plateH - plateH * (h.y + h.h / 2), 0.002);
      q.userData = { book: book, hotspot: h, film: film };
      hinge.add(q);
      book.hit.push(q);
      film.spots.push(q);
    });
    book.hit.push(mesh);
    video.addEventListener('loadedmetadata', function () {
      var d = video.duration; film.duration = (isFinite(d) && d > 0.5) ? d : 8;
    });
    video.addEventListener('loadeddata', function () {
      film.ready = true;
      film.tex = videoTexture(video);
      mat.map = film.tex; mat.needsUpdate = true;
      if (film.pendingT !== undefined) seekFilm(film, film.pendingT);
    });
    film.load = function () {
      if (film.loaded) return;
      film.loaded = true;
      video.preload = 'auto';
      video.src = clipSrc(slug);
      video.load();
    };
    return film;
  }
  function seekFilm(film, t) {
    if (!film.ready) { film.pendingT = t; return; }
    if (Math.abs(t - film.lastT) < 1 / 60) return;
    film.lastT = t;
    try { film.video.currentTime = t; } catch (e) {}
  }

  /* --- the timeline: a ∈ [0, sheets + 1] ---------------------------
     each step is half a turn and half a dwell: the cover in [0, .5],
     sheet j in [j+1, j+1.5]; pop-ups on right page j rise in
     [j+.4, j+.7] and fold as their sheet starts to turn; the film on
     right page j scrubs across [j+.45, j+1]. */
  Book.prototype.setTimeline = function (a) {
    this.timeline = a;
    var N = this.sheetCount();
    var thetaC = smooth(a / 0.5) * Math.PI;
    this.hinge.rotation.y = -thetaC;
    this.openAmount = thetaC / Math.PI;
    var self = this;
    this.sheets.forEach(function (s) {
      var th = smooth((a - (s.j + 1)) / 0.5) * Math.PI;
      if (Math.abs(th - s.theta) > 1e-4) { s.theta = th; curlSheet(s, th); }
    });
    this.films.forEach(function (f) {
      var j = f.page;
      var vis = a >= j + 0.42 && (j === N || a <= j + 1.0);
      f.hinge.visible = vis;
      if (!vis) return;
      var lp = clamp((a - (j + 0.45)) / 0.55, 0, 1);
      seekFilm(f, lp * (f.duration - 0.04));
      if (f.pop) {
        var rise = smooth((a - (j + 0.42)) / 0.3);
        if (j !== N) rise *= (1 - smooth((a - (j + 1)) / 0.15));
        f.hinge.rotation.x = rise * (Math.PI / 2 - 0.36);
      }
    });
  };

  function curlSheet(s, th) {
    var pos = s.geo.attributes.position, base = s.base, pw = pos.count ? base[(pos.count - 1) * 3] : 1;
    var k = CURL * Math.sin(th);
    for (var i = 0; i < pos.count; i++) {
      var x = base[i * 3], y = base[i * 3 + 1];
      var ang = th + k * (x / pw) * (1 - x / pw) * 2.2;
      pos.array[i * 3] = x * Math.cos(ang);
      pos.array[i * 3 + 1] = y;
      pos.array[i * 3 + 2] = x * Math.sin(ang);
    }
    pos.needsUpdate = true;
    s.geo.computeVertexNormals();
    var f = th / Math.PI;
    s.group.position.z = lerp(s.zRight, s.zLeft, f);
  }

  Book.prototype.loadFilms = function () { this.films.forEach(function (f) { f.load(); }); };

  Book.prototype.setOpacity = function (o) {
    var mats = [];
    this.group.traverse(function (m) { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (x) { mats.push(x); }); });
    mats.forEach(function (m) { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o > 0.5; });
  };

  Book.prototype.dispose = function () {
    this.group.traverse(function (m) {
      if (m.geometry && !m.userData.shared) m.geometry.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(function (x) {
        if (x.map) x.map.dispose(); x.dispose();
      });
    });
    this.films.forEach(function (f) { try { f.video.pause(); f.video.removeAttribute('src'); f.video.load(); } catch (e) {} });
  };

  /** the hotspot (if any) a ray hits in one of the films on this book's pages */
  Book.prototype.hotspotAt = function (hit) {
    return hit && hit.object.userData.hotspot ? { hotspot: hit.object.userData.hotspot, film: hit.object.userData.film } : null;
  };

  /** which hot spot (if any) a ray hits on this book's pages */
  Book.prototype.hotAt = function (hit) {
    var obj = hit.object, face = obj.userData.face;
    if (!face || !hit.uv) return null;
    var u = obj.userData.mirrored ? 1 - hit.uv.x : hit.uv.x;
    var v = 1 - hit.uv.y;
    var x = u * pages.W, y = v * pages.H;
    for (var i = 0; i < face.hot.length; i++) {
      var r = face.hot[i];
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r;
    }
    return null;
  };

  /* ============================================================
     the reader: takes a book out of the scene, holds it up in front
     of the camera, opens it, and puts it back where it came from
     ============================================================ */
  function Reader(scene, camera, o) {
    o = o || {};
    var group = new T.Group();
    camera.add(group);
    group.position.set(0, o.y === undefined ? -0.16 : o.y, -(o.dist || 4.2));
    group.rotation.x = -(o.tilt === undefined ? 0.62 : o.tilt);
    var lamp = new T.PointLight(0xffe0b0, 0, 14, 2);
    lamp.position.set(1.1, 2.0, 2.6);
    group.add(lamp);
    var slot = new T.Group();            // the book sits here; x shifts as it opens
    group.add(slot);

    var reader = { group: group, slot: slot, lamp: lamp, book: null, busy: false, dist: o.dist || 4.2, camera: camera };

    reader.fit = function () {
      if (!reader.book) return;
      var b = reader.book;
      var fov = camera.fov * Math.PI / 180;
      var visH = 2 * reader.dist * Math.tan(fov / 2);
      var visW = visH * camera.aspect;
      var s = Math.min(0.78 * visH / b.h, 0.84 * visW / (2 * b.w)) * (o.scale || 1);
      group.scale.setScalar(s);
    };

    reader.take = function (book, done) {
      if (reader.busy) return;
      reader.book = book;
      reader.busy = true;
      var gr = book.group;
      book.home = { parent: gr.parent, position: gr.position.clone(), quaternion: gr.quaternion.clone(), scale: gr.scale.clone() };
      slot.attach(gr);
      reader.fit();
      var p0 = gr.position.clone(), q0 = gr.quaternion.clone(), s0 = gr.scale.clone();
      var p1 = new T.Vector3(-book.w / 2, 0, 0), q1 = new T.Quaternion(), s1 = new T.Vector3(1, 1, 1);
      var pr = { t: 0 };
      reader.tween = gsap.to(pr, { t: 1, duration: 1.0, ease: 'power3.inOut', onUpdate: function () {
        gr.position.lerpVectors(p0, p1, pr.t);
        gr.quaternion.slerpQuaternions(q0, q1, pr.t);
        gr.scale.lerpVectors(s0, s1, pr.t);
      }, onComplete: function () { reader.busy = false; if (done) done(); } });
      gsap.to(lamp, { intensity: 12, duration: 1.0 });
    };

    /** x of the closed book so it stays centred as the spread opens */
    reader.update = function () {
      var b = reader.book;
      if (!b) return;
      slot.position.x = b.w / 2 * (b.openAmount || 0);
    };

    /** instant: straight back where it came from, no tween (a stage leaving the screen) */
    reader.drop = function () {
      var book = reader.book;
      if (!book) return;
      if (reader.tween) { reader.tween.kill(); reader.tween = null; }
      var gr = book.group, home = book.home;
      if (home) {
        home.parent.add(gr);
        gr.position.copy(home.position); gr.quaternion.copy(home.quaternion); gr.scale.copy(home.scale);
      }
      lamp.intensity = 0;
      slot.position.x = 0;
      reader.book = null;
      reader.busy = false;
    };

    reader.putBack = function (done) {
      var book = reader.book;
      if (!book || reader.busy) return;
      reader.busy = true;
      var gr = book.group, home = book.home;
      home.parent.attach(gr);
      var p0 = gr.position.clone(), q0 = gr.quaternion.clone(), s0 = gr.scale.clone();
      var pr = { t: 0 };
      reader.tween = gsap.to(pr, { t: 1, duration: 0.9, ease: 'power3.inOut', onUpdate: function () {
        gr.position.lerpVectors(p0, home.position, pr.t);
        gr.quaternion.slerpQuaternions(q0, home.quaternion, pr.t);
        gr.scale.lerpVectors(s0, home.scale, pr.t);
      }, onComplete: function () {
        reader.busy = false;
        slot.position.x = 0;
        if (done) done();
      } });
      gsap.to(lamp, { intensity: 0, duration: 0.6 });
      reader.book = null;
      return book;
    };

    return reader;
  }

  /* ============================================================
     helpers shared by the scenes
     ============================================================ */

  /** pointer → normalised device coords over a canvas */
  function ndc(e, canvas, out) {
    var r = canvas.getBoundingClientRect();
    out.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    out.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    return out;
  }

  function loadImage(src, done) {
    var img = new Image();
    img.onload = function () { done(img); };
    img.onerror = function () { done(null); };
    img.src = src;
    return img;
  }

  LS.Living3D = {
    supported: supported, lite: lite,
    BASE: BASE, MOBILE: MOBILE, clipSrc: clipSrc, videoTexture: videoTexture,
    acquire: acquire, release: release, envFrom: envFrom,
    run: run, halt: halt, fit: fit, lightRig: lightRig,
    Book: Book, Reader: Reader, pages: pages,
    CLOTH: CLOTH, CLOTH_CSS: CLOTH_CSS, GOLD: GOLD,
    fonts: { display: FONT_D, ui: FONT_U, mono: FONT_M },
    ink: { paper: PAPER, ink: INK, soft: INK_SOFT, gold: GOLD_INK },
    ndc: ndc, loadImage: loadImage, canvasTexture: canvasTexture,
    smooth: smooth, clamp: clamp, lerp: lerp
  };
})(window);
