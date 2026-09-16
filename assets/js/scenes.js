/* ============================================================
   scenes.js — "The Living Stacks": the tour.

   The tour opens the site. You arrive on foot, the doors open on
   the reception, and from there every hall of the library leads
   off — drag to look around, face a door (or the stairs), and
   scrolling walks you through it. Each hall is backed by clips
   that scrub with the scroll bar: nothing plays on its own.

   GSAP ScrollTrigger pins every stage; a scrubbed proxy tween
   drives each clip's currentTime, crossfades the beats inside a
   hall, stages the captions and lights the rail.

   Clips are catalogued in REGISTRY by hall, so a new clip is one
   line: drop it in public/scenes/ and add a beat.

   LS.Scenes.mount(host, { scroller, embedded, onBrowse, onExit })
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;

  var BASE = 'scenes/';
  var VH_PER_BEAT = 100;          // scroll distance each clip gets, in viewport heights
  var VH_RECEPTION = 260;         // the reception: look around, then walk through a door
  var XFADE = 0.10;               // fraction of a beat spent crossfading to the next
  var MOBILE = global.matchMedia && global.matchMedia('(max-width: 720px)').matches;
  function clipSrc(slug) { return BASE + slug + (MOBILE ? '-m' : '') + '.mp4'; }

  /* the reception: a nonagon of doorways around the visitor. Yaw is the
     heading you face to look at each door; N is straight ahead as you
     come in, and the stairs to the upper floors are right there. */
  var ROOM_R = 760;
  var DOORS = [
    { key: 'stairs',       yaw: 0,   heading: 'N · upstairs', name: 'Science & Technology',
      route: ['science', 'technology'], poster: 'science-flythrough', stairs: true },
    { key: 'adult',        yaw: 40,  heading: 'NE',  route: ['adult'],        poster: 'adult-quiet-stacks' },
    { key: 'history',      yaw: 80,  heading: 'E',   route: ['history'],      poster: 'atlas-dolly' },
    { key: 'ancient',      yaw: 120, heading: 'ESE', route: ['ancient'],      poster: 'gold-path-atlas' },
    { key: 'voyages',      yaw: 160, heading: 'S',   route: ['voyages'],      poster: 'voyages-whale' },
    { key: 'civilization', yaw: 200, heading: 'SSW', route: ['civilization'], poster: 'living-stacks-orbit' },
    { key: 'mythology',    yaw: 240, heading: 'WSW', route: ['mythology'],    poster: 'books-dais' },
    { key: 'horror',       yaw: 280, heading: 'W',   route: ['horror'],       poster: 'aisle-push' },
    { key: 'kids',         yaw: 320, heading: 'NW',  route: ['kids'],         poster: 'childrens-gold-path' }
  ];

  /* ============================================================
     the registry — every clip, by hall
     ============================================================ */

  var REGISTRY = [
    { key: 'arrival', kind: 'arrival', beats: [
      { src: 'arrive-street', label: 'The Living Stacks',
        lines: ['A wet street, and a man who knows where he is going.',
                'Six blocks. He has been walking since the rain started.'] },
      { src: 'arrive-stairs', label: 'The steps',
        lines: ['Two lions, forty steps, and the doors at the top.', 'Nobody has ever run up them.'] },
      { src: 'arrive-doors', label: 'The doors',
        lines: ['They open before he touches them.', 'Inside: a corridor, and the reception at the end of it.'] },
      { src: 'man-corridor', label: 'The corridor',
        lines: ['Panelled, unlit, and longer than it looks.', 'The lamps at the far end are the reading room.'] },
      { src: 'man-corridor-b', label: 'The last door',
        lines: ['Rain on the tall windows, green lamps ahead.', 'Every hall of the library leads off the room he is walking into.'] },
      { src: 'arrive-rain', label: 'The cloister',
        lines: ['Rain on the tall windows, and a door with green light behind it.', 'He has been here before. Not recently.'] },
      { src: 'arrive-lamps', label: 'The reading hall',
        lines: ['Green lamps on every table, and the door at the end of them.', 'He walks the length of it without looking up.'] },
      { src: 'man-turns', label: 'The reception',
        lines: ['He stops, and turns to look at you.', 'Every hall of the library leads off this room. Choose one.'] }
    ]},

    { key: 'reception', kind: 'reception' },

    { key: 'kids', beats: [
      { src: 'kids-nursery', label: 'The Nursery Shelves',
        lines: ['Light morning. Ages four to ten.', 'Lanterns in the rafters, and every spine at knee height.'] },
      { src: 'childrens-gold-path', label: 'The gold line',
        lines: ['The gold line on the floor is the way in.', 'Follow it past the picture books.'] },
      { src: 'kids-gold-accelerate', label: 'The pedestal',
        lines: ['It brightens as it goes, and the books on the plinth start to turn.',
                'Orbit playtime: everything here comes off the shelf on its own.'] },
      { src: 'childrens-approach', label: 'The approach',
        lines: ['The reading circle, and the book that opens it.',
                'Everything on these shelves has been read aloud four hundred times.'] },
      { src: 'subjects-emerge', label: 'Picture books',
        lines: ['Open one and the animals come out.', 'Every whale in this room is friendly.'] },
      { src: 'man-floating-books', label: 'Three books, open',
        lines: ['A fox, a whale and a robot, hanging in the air at reading height.',
                'He has read all three. He is choosing which one to read again.'] },
      { src: 'man-whale-a', label: 'Orbit playtime',
        lines: ['Sit down and the whale swims round the room with the books in tow.',
                'Children, 02. The count in the corner is live.'] },
      { src: 'man-whale-b', label: 'Riding it out',
        lines: ['The stories go where the whale goes.', 'Somewhere below, a playground; up here, the whole shelf in the air.'] }
    ]},

    { key: 'adult', beats: [
      { src: 'adult-quiet-stacks', label: 'The Quiet Stacks',
        lines: ['Light rain. Eighteen and over.', 'Green lamps, long novels, nobody talking.'] },
      { src: 'novels-camera-pass', label: 'The long shelf',
        lines: ['Leather, cloth, and the smell of a wet afternoon.',
                'Take the one that is slightly out of line. Someone just put it back.'] },
      { src: 'man-rotating-novels', label: 'The table by the window',
        lines: ['A row of novels, and a reader turning each spine to the light.',
                'He is looking for the one he has not read. There is always one.'] },
      { src: 'man-table-spines', label: 'The long table',
        lines: ['Forty spines in a line, and the rain still going.', 'Nobody is in a hurry in this room.'] },
      { src: 'novel-riffle', label: 'The book on the table',
        lines: ['One novel, one table, and the pages turning on their own.',
                'It always opens at the same place. Nobody knows why.'] },
      { src: 'books-reveal-objects', label: 'Between the covers',
        lines: ['A bird, an inkwell, a locomotive: whatever the story needed.',
                'Every one of these has left the building at least once this year.'] },
      { src: 'reading-room-dusk', label: 'Dusk',
        lines: ['The last reader, the last lamp, and the rain still going.', 'The desk closes at nine. He knows.'] }
    ]},

    { key: 'voyages', beats: [
      { src: 'voyages-whale', label: 'The Expedition Room',
        lines: ['A whale swims through the hall on a Tuesday.',
                'Sea stories, and everyone who ever left home.'] },
      { src: 'expedition-canal', label: 'The map on the table',
        lines: ['Boats, lanterns, a route drawn in gold.',
                'Pick a page and the country comes up out of it.'] },
      { src: 'popup-expedition', label: 'The pop-up atlas',
        lines: ['A mountain stands up out of the page and the route is drawn in gold.',
                'Letters blow off the map like leaves.'] },
      { src: 'book-miniature', label: 'The compass rose',
        lines: ['Open the one with the compass on the cover.',
                'A bridge, a lantern, and a road out of the page.'] },
      { src: 'kids-objects-emerge', label: 'What the books let out',
        lines: ['A whale of water, two paper boats, and a puppet who wanted to be a boy.',
                'He watches from the edge. Everyone who ever left home is in here.'] }
    ]},

    { key: 'science', beats: [
      { src: 'science-flythrough', label: 'The Measured Wing',
        lines: ['Daylight. Instruments. Nothing here is taken on trust.',
                'An orrery on the table, and a book that explains it.'] },
      { src: 'heart-model', label: 'Anatomy',
        lines: ['The heart, rendered in glass, from a book that was closed a moment ago.',
                'Gray’s is on the reserve shelf. Twenty-four hours, no renewals.'] },
      { src: 'diagrams-lift', label: 'The old laboratory',
        lines: ['Atoms, a helix, a planet on a wire.',
                'Every diagram here started as a sketch in a margin.'] },
      { src: 'atom-book', label: 'The desk by the lamp',
        lines: ['An atom and a helix, drawn in light above an open page.',
                'Click either one and the book it came from opens.'] },
      { src: 'asteroid-ring', label: 'The stone in the ring',
        lines: ['A rock the size of a room, held in a ring of instruments.',
                'Somewhere in this hall is the book that weighed it.'] }
    ]},

    { key: 'technology', beats: [
      { src: 'tech-book-orbit', label: 'The Instrument Floor',
        lines: ['State: live. Light: rig.', 'The book is a screen now. It still has a call number.'] },
      { src: 'tech-atlas-city', label: 'A city in the pages',
        lines: ['Open an atlas and a skyline stands up.',
                'Algorithms, craft, and the machines we made.'] },
      { src: 'tech-pages-fan', label: 'Mechanism',
        lines: ['A book fans open and a movement climbs out of it.',
                'Clean Code is on the second shelf. Two copies out.'] },
      { src: 'city-book', label: 'The city in the pages',
        lines: ['A blue book opens on a steel table, and a city stands up out of it.',
                'A satellite, too. Someone catalogued that.'] },
      { src: 'mechanism-book', label: 'Brass',
        lines: ['Gears, a lantern, and the book that explains them.', 'He has read it twice. He is checking.'] }
    ]},

    { key: 'history', beats: [
      { src: 'atlas-dolly', label: 'The Long Record',
        lines: ['Light: archive. Era: recorded.', 'Lecterns in a row, and a manuscript open on each.'] },
      { src: 'reading-room-man', label: 'The Reading Room',
        lines: ['He has been at that table since the morning.',
                'Nations, arguments, and the people who wrote them down.'] },
      { src: 'reading-room-dusk', label: 'The long table',
        lines: ['One lamp, one reader, and every century on the shelves behind him.',
                'The record of everything, in the order it happened.'] }
    ]},

    { key: 'ancient', beats: [
      { src: 'gold-path-atlas', label: 'The Atlas Vault',
        lines: ['The path runs off the floor and onto the page.',
                'Herodotus. Kautilya. Gilgamesh. The first cities, in their own words.'] },
      { src: 'stone-city', label: 'The first cities',
        lines: ['A walled town stands up out of the atlas.', 'Streets first, then walls, then flags.'] },
      { src: 'scroll-coastline', label: 'The scroll',
        lines: ['The case opens and the scroll draws its own coastline.',
                'Older than the shelf it sits on, and still legible.'] },
      { src: 'stone-passage', label: 'The passage',
        lines: ['Stone, a lantern, and a way down that nobody uses.',
                'The vault is at the bottom. So is the oldest thing we own.'] }
    ]},

    { key: 'civilization', beats: [
      { src: 'living-stacks-orbit', label: 'The Great Hall',
        lines: ['Every book in the building, in orbit around one.',
                'Money, law, and the story of the species.'] },
      { src: 'living-stacks-monolith', label: 'The Great Book',
        lines: ['One volume. Every world.', 'It turns once a day, whether or not anyone is reading.'] },
      { src: 'book-opens-pages', label: 'The alphabet',
        lines: ['Open it and the letters leave the page.',
                'Twenty-six of them, and everything ever written.'] },
      { src: 'great-hall-orbit', label: 'The Great Hall',
        lines: ['A blue book on the floor of the hall, and every other book in orbit round it.',
                'He walks into the circle. The circle does not stop.'] }
    ]},

    { key: 'mythology', beats: [
      { src: 'books-dais', label: 'The First Stories',
        lines: ['Light: votive. Cycle: first age.',
                'A dais, two statues, and the books that came before books.'] },
      { src: 'figures-rise', label: 'The Hall of Gods',
        lines: ['Open the blue book and the sun climbs out of it.',
                'Epics older than the alphabets they are written in.'] },
      { src: 'pages-diorama', label: 'The tree in the book',
        lines: ['A tree grows out of the page and the gods sit under it.',
                'Homer. Valmiki. Ovid. Nobody agrees on who was first.'] },
      { src: 'tree-book', label: 'The world tree',
        lines: ['Lanterns in its branches, a sunset behind it, and a reader who has forgotten the time.',
                'Yggdrasil, or something like it. Open to the first page.'] }
    ]},

    { key: 'horror', beats: [
      { src: 'aisle-push', label: 'The Closed Wing',
        lines: ['Restricted. Light: none. Access: denied.',
                'The aisle narrows, and the lamps do not follow you in.'] },
      { src: 'arrive-fog', label: 'The chained shelf',
        lines: ['One book on a lectern, and a cold you can see.',
                'Dracula is here. So is the thing from Ingolstadt.'] },
      { src: 'book-cold-fog', label: 'Restricted',
        lines: ['Chained, and cold to the touch.',
                'Ask at the desk. Bring identification.'] },
      { src: 'aisle-dust', label: 'Deeper in',
        lines: ['The shelves lean in and the dust has not been disturbed this year.', 'He goes anyway.'] },
      { src: 'chained-book-candle', label: 'By candlelight',
        lines: ['A chained book, a candle, and smoke that moves the wrong way.',
                'Frankenstein is in here. So is the thing it made.'] },
      { src: 'ashes-book', label: 'The Ashes',
        lines: ['It opens on its own, and the ash lifts off the page in words.',
                'The ashes whisper secrets of the forgotten. Click it, and it turns the page.'] }
    ]},

    { key: 'epilogue', kind: 'title', beats: [
      { src: 'arrive-hall', label: 'The doors stay open',
        lines: ['Someone is always arriving.', 'Everything else is behind the desk.'] }
    ]}
  ];

  /* ============================================================
     mount
     ============================================================ */

  function mount(host, opts) {
    opts = opts || {};
    var reduced = global.Motion && Motion.reduced;
    var scroller = opts.scroller || global;
    var hasGsap = !!(global.gsap && global.ScrollTrigger);
    var live = hasGsap && !reduced;

    if (hasGsap) gsap.registerPlugin(ScrollTrigger);

    host.classList.add('jr');
    if (opts.embedded) host.classList.add('jr-embedded');
    if (!live) host.classList.add('jr-static');
    host.innerHTML = '';

    var halls = REGISTRY.map(function (def) {
      return { def: def, col: def.kind ? null : E.collection(def.key) };
    });
    var collections = halls.filter(function (h) { return h.col; });

    var ctx = {
      scroller: scroller, live: live, embedded: !!opts.embedded, opts: opts,
      byKey: {}, videos: [], tweens: [], triggers: [], host: host,
      collections: collections, reduced: reduced
    };

    halls.forEach(function (hall) {
      var section = hall.def.kind === 'reception'
        ? buildReception(hall, ctx)
        : buildHall(hall, ctx);
      host.appendChild(section.node);
      ctx.byKey[hall.def.key] = section;
      (section.beats || []).forEach(function (b) { ctx.videos.push(b.video); });
      (section.videos || []).forEach(function (v) { ctx.videos.push(v); });
    });

    /* rail clicks jump to a hall — the triggers must exist first, so this
       reads their start positions at click time */
    host.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-jump]');
      if (!btn) return;
      goTo(ctx, btn.getAttribute('data-jump'));
    });

    if (!live) {
      halls.forEach(function (h) {
        var s = ctx.byKey[h.def.key];
        if (s.render) s.render(0);
        if (s.beats && s.beats[0]) s.beats[0].node.style.opacity = 1;
      });
      return { destroy: function () { host.innerHTML = ''; }, refresh: function () {}, halls: ctx.byKey };
    }

    /* ---- one pin + one scrubbed tween per stage --------------- */
    halls.forEach(function (h) {
      var s = ctx.byKey[h.def.key];
      var proxy = { p: 0 };
      var span = h.def.kind === 'reception' ? VH_RECEPTION : VH_PER_BEAT * s.beats.length;

      var tw = gsap.to(proxy, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: s.node,
          scroller: scroller === global ? undefined : scroller,
          start: 'top top',
          end: function () { return '+=' + span + '%'; },
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 0.55,
          invalidateOnRefresh: true,
          onToggle: function (self) {
            if (s.off) return;                     // a hall behind an unchosen door
            s.node.classList.toggle('is-active', self.isActive);
            if (s.onToggle) s.onToggle(self.isActive);
          }
        },
        onUpdate: function () { s.render(proxy.p); }
      });
      s.trigger = tw.scrollTrigger;
      ctx.tweens.push(tw);

      if (s.load) {
        /* clips only start downloading when the hall is a screen or two away */
        ctx.triggers.push(ScrollTrigger.create({
          trigger: s.node,
          scroller: scroller === global ? undefined : scroller,
          start: 'top bottom+=150%',
          onEnter: function () { if (!s.off) s.load(); }
        }));
      }
    });

    /* the tour is "on" while any of its stages is in view: the page can hide
       its own chrome and offer a skip link */
    ctx.triggers.push(ScrollTrigger.create({
      trigger: host,
      scroller: scroller === global ? undefined : scroller,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: function (self) {
        if (opts.onTourToggle) opts.onTourToggle(self.isActive);
      }
    }));

    /* iOS will not paint a seeked frame until the element has played once;
       a muted play/pause on the first touch unlocks every clip at once. */
    var primed = false;
    function prime() {
      if (primed) return;
      primed = true;
      ctx.videos.forEach(function (v) {
        try {
          var pr = v.play();
          if (pr && pr.then) pr.then(function () { v.pause(); }).catch(function () {});
          else v.pause();
        } catch (e) {}
      });
    }
    document.addEventListener('touchstart', prime, { once: true, passive: true });
    document.addEventListener('pointerdown', prime, { once: true, passive: true });

    /* layout settles after fonts, posters and any host entrance animation */
    var timers = [600, 1500].map(function (ms) {
      return setTimeout(function () { ScrollTrigger.refresh(); }, ms);
    });

    /* the default route is the door you face on arrival */
    orderRoute(ctx, DOORS[0]);

    return {
      destroy: function () {
        timers.forEach(clearTimeout);
        ctx.tweens.forEach(function (t) {
          if (t.scrollTrigger) t.scrollTrigger.kill();
          t.kill();
        });
        ctx.triggers.forEach(function (t) { t.kill(); });
        Object.keys(ctx.byKey).forEach(function (k) { if (ctx.byKey[k].hall3d) ctx.byKey[k].hall3d.destroy(); });
        ctx.videos.forEach(function (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} });
        host.innerHTML = '';
        host.classList.remove('jr', 'jr-embedded', 'jr-static');
      },
      refresh: function () { ScrollTrigger.refresh(); },
      choose: function (key) {
        var r = ctx.byKey.reception;
        if (r && r.focus) r.focus(key, true);
      },
      go: function (key) { goTo(ctx, key); },
      halls: ctx.byKey
    };
  }

  /** a hall outside the current route is reached by choosing its door first */
  function goTo(ctx, key) {
    var door = DOORS.filter(function (d) { return d.route.indexOf(key) > -1; })[0];
    var rec = ctx.byKey.reception;
    if (door && rec && rec.focus && ctx.route !== door) {
      rec.focus(door.key, false);
      setTimeout(function () { scrollToHall(ctx, key); }, 60);
      return;
    }
    scrollToHall(ctx, key);
  }

  function scrollToHall(ctx, key) {
    var target = ctx.byKey[key];
    if (!target) return;
    var top = target.trigger ? target.trigger.start : target.node.offsetTop;
    if (ctx.scroller === global) global.scrollTo({ top: top, behavior: 'smooth' });
    else ctx.scroller.scrollTo({ top: top, behavior: 'smooth' });
  }

  /** Put the chosen door's halls straight after the reception, so scrolling
      on carries you through that door and into them; everything else
      follows in its usual order. Pinned stages live inside GSAP's spacer
      elements, so it is the spacers that move. */
  function orderRoute(ctx, door) {
    var rec = ctx.byKey.reception;
    if (!rec) return;
    var anchor = wrapperOf(rec);
    var routeKeys = door.route.slice();
    /* the remaining collections follow in registry order, then the epilogue */
    var rest = REGISTRY.filter(function (d) {
      return !d.kind && routeKeys.indexOf(d.key) === -1;
    }).map(function (d) { return d.key; });
    var order = routeKeys.concat(rest, ['epilogue']);
    var cursor = anchor;
    order.forEach(function (key) {
      var s = ctx.byKey[key];
      if (!s) return;
      var w = wrapperOf(s);
      /* the halls behind the other doors wait until their door is chosen */
      var off = !s.def.kind && routeKeys.indexOf(key) === -1;
      s.off = off;
      w.classList.toggle('jr-off', off);
      if (off && s.hall3d) s.hall3d.deactivate();
      if (off) s.node.classList.remove('is-active');
      if (w === cursor) return;
      cursor.parentNode.insertBefore(w, cursor.nextSibling);
      cursor = w;
    });
    if (ctx.live) ScrollTrigger.refresh();
    ctx.route = door;
  }
  function wrapperOf(section) {
    var st = section.trigger;
    return (st && st.spacer) ? st.spacer : section.node;
  }

  /* ============================================================
     a hall: the pinned stage with its beats, rail, HUD and captions
     ============================================================ */

  function buildHall(hall, ctx) {
    var def = hall.def, col = hall.col;
    var isTitle = def.kind === 'title' || def.kind === 'arrival';
    var stats = col ? E.collectionStats(col.key) : null;
    var opts = ctx.opts;

    /* --- beats ------------------------------------------------ */
    var beats = def.beats.map(function (b, i) {
      var video = el('video', {
        muted: true, playsinline: true, preload: 'none',
        disablepictureinpicture: true, disableremoteplayback: true,
        poster: BASE + b.src + '.jpg',
        'aria-hidden': 'true'
      });
      video.muted = true;                       // the attribute alone is not enough in some engines
      var node = el('div.jr-beat', { style: { opacity: i === 0 ? 1 : 0 } }, [
        el('img.jr-poster', { src: BASE + b.src + '.jpg', alt: '', loading: 'lazy' }),
        video
      ]);
      return { def: b, node: node, video: video, ready: false, duration: 8, lastT: -1,
               drive: LS.FilmDrive ? LS.FilmDrive.of(video) : null };
    });

    beats.forEach(function (b) {
      b.video.addEventListener('loadedmetadata', function () {
        var d = b.video.duration;
        b.duration = (isFinite(d) && d > 0.5) ? d : 8;   // the clips are all 8s
      });
      b.video.addEventListener('loadeddata', function () {
        b.ready = true;
        b.node.classList.add('is-ready');
        if (b.pendingT !== undefined) seek(b, b.pendingT);
      });
    });

    function load() {
      beats.forEach(function (b) {
        if (b.video.getAttribute('src')) return;
        b.video.preload = 'auto';
        b.video.src = clipSrc(b.def.src);
        b.video.load();
      });
    }

    function seek(b, t) {
      if (b.drive) { b.drive.to(t); return; }
      if (!b.ready) { b.pendingT = t; return; }
      if (Math.abs(t - b.lastT) < 1 / 60) return;
      b.lastT = t;
      try { b.video.currentTime = t; } catch (e) {}
    }

    /* --- chrome ----------------------------------------------- */
    var caption = el('div.jr-caption', {}, [
      el('span.jr-caption-label'),
      el('span.jr-caption-line')
    ]);
    var progress = el('span');
    var dots = el('div.jr-dots', {}, beats.map(function () { return el('i'); }));

    var hudName = isTitle ? def.beats[0].label : col.name;
    var hudHall = def.kind === 'arrival' ? 'Arriving'
                : def.key === 'epilogue' ? 'Behind the desk'
                : col.hall;
    var hud = el('div.jr-hud', {}, [
      el('div.jr-hud-l', {}, [
        el('div.jr-hud-num', { text: isTitle ? (def.kind === 'arrival' ? '—' : '∎') : col.n }),
        el('div', {}, [
          el('div.jr-hud-name', { text: hudName }),
          el('div.jr-hud-hall', { text: hudHall })
        ])
      ]),
      el('div.jr-hud-r', {}, [
        stats ? el('div.jr-hud-stats', {}, [
          el('b', { text: stats.titles + ' title' + (stats.titles === 1 ? '' : 's') }),
          el('span', { text: stats.copies + ' copies · ' + stats.available + ' on the shelf' })
        ]) : null,
        el('div.jr-progress', {}, progress),
        dots
      ])
    ]);

    var rail = col ? buildRail(ctx, def.key) : null;

    var cta = null;
    if (col) {
      cta = el('div.jr-cta', {}, [
        el('div.jr-cta-text', {}, [
          el('b', { text: 'Browse the ' + col.name }),
          el('span', { text: col.blurb })
        ]),
        el('div.jr-cta-btns', {}, [
          el('button.btn.btn-sm.btn-primary', { 'data-ripple': '', onclick: function () {
            if (opts.onBrowse) opts.onBrowse(col.key);
            else location.href = 'app.html#/opac?collection=' + col.key;
          } }, 'Open the shelf →'),
          el('button.btn.btn-sm', { 'data-jump': 'reception' }, 'Back to reception')
        ])
      ]);
    } else if (def.key === 'epilogue') {
      cta = el('div.jr-cta', {}, [
        el('div.jr-cta-text', {}, [
          el('b', { text: 'The rest is behind the desk' }),
          el('span', { text: 'Circulation, cataloguing, acquisitions, the policy matrix: the whole system.' })
        ]),
        el('div.jr-cta-btns', {}, [
          el('button.btn.btn-sm.btn-primary', { 'data-ripple': '', onclick: function () {
            if (opts.onExit) opts.onExit();
            else location.href = 'app.html#/overview';
          } }, 'Open the staff client →')
        ])
      ]);
    }

    var stage = el('div.jr-stage' + (isTitle ? '.jr-stage-title' : ''), {}, [
      el('div.jr-film', {}, beats.map(function (b) { return b.node; })),
      el('div.jr-scrim'),
      el('div.jr-grain'),
      def.kind === 'arrival' ? el('h2.jr-title', { text: 'The Living Stacks' }) : null,
      rail, hud, caption, cta
    ]);
    var node = el('section.jr-hall.jr-hall-' + (def.kind || 'collection'),
                  { 'data-hall': def.key }, stage);
    var title = stage.querySelector('.jr-title');

    /* the room: the film flat and whole, the things in it clickable, and the
       titles on this hall's shelves waiting inside the picture */
    var api = { node: node, stage: stage, beats: beats, load: load, trigger: null, def: def };
    function goBeat(i) {
      var st = api.trigger;
      if (!st) return;
      var span = st.end - st.start;
      var top = i >= n ? st.end - 2 : st.start + (i / n) * span + 4;
      if (ctx.scroller === global) global.scrollTo({ top: top, behavior: 'smooth' });
      else ctx.scroller.scrollTo({ top: top, behavior: 'smooth' });
    }
    var hall3d = (ctx.live && LS.Hall3D)
      ? LS.Hall3D.create(stage, { def: def, col: col, beats: beats },
          { poster: def.beats[0].src, onReserve: opts.onReserve, goBeat: goBeat,
            go: function (key) { goTo(ctx, key); } })
      : null;

    /* --- render at progress p ∈ [0,1] --------------------------- */
    var state = { beat: -1, sub: -1, cta: false };
    var n = beats.length;

    function render(p) {
      var x = p * n;
      var cur = Math.min(n - 1, Math.floor(x));
      beats.forEach(function (b, j) {
        var u = x - j;                                 // local progress of beat j
        var o = 1;
        if (u < 0) o = Math.max(0, 1 + u / XFADE);
        else if (u > 1) o = Math.max(0, 1 - (u - 1) / XFADE);
        b.node.style.opacity = o.toFixed(3);
        if (o > 0) seek(b, Math.max(0, Math.min(1, u)) * (b.duration - 0.04));
        else if (b.drive) b.drive.stop();
      });

      var local = x - cur;
      var sub = local < 0.5 ? 0 : 1;
      if (cur !== state.beat || sub !== state.sub) {
        state.beat = cur; state.sub = sub;
        var b = beats[cur].def;
        caption.classList.remove('is-in');
        setTimeout(function () {
          caption.firstChild.textContent = b.label;
          caption.lastChild.textContent = b.lines[Math.min(sub, b.lines.length - 1)];
          caption.classList.add('is-in');
        }, 200);
        Array.prototype.forEach.call(dots.children, function (d, k) {
          d.classList.toggle('is-on', k === cur);
        });
      }
      progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      if (title) title.style.opacity = Math.max(0, 1 - p * 3.2).toFixed(3);

      var showCta = p > 0.84;
      if (showCta !== state.cta) {
        state.cta = showCta;
        if (cta) cta.classList.toggle('is-in', showCta);
        stage.classList.toggle('is-ending', showCta);
      }
      if (hall3d) hall3d.setProgress(p);
    }

    api.render = render;
    api.hall3d = hall3d;
    api.onToggle = hall3d ? function (active) { if (active) hall3d.activate(); else hall3d.deactivate(); } : null;
    return api;
  }

  function buildRail(ctx, activeKey) {
    return el('nav.jr-rail', { 'aria-label': 'Halls' },
      [el('button.jr-rail-item.jr-rail-home', { type: 'button', 'data-jump': 'reception' }, [
        el('span.jr-rail-n', { text: '⌂' }),
        el('span.jr-rail-name', { text: 'Reception' })
      ])].concat(ctx.collections.map(function (c) {
        return el('button.jr-rail-item' + (c.def.key === activeKey ? '.is-active' : ''), {
          type: 'button', 'data-jump': c.def.key
        }, [
          el('span.jr-rail-n', { text: c.col.n }),
          el('span.jr-rail-name', { text: c.col.name })
        ]);
      })));
  }

  /* ============================================================
     the reception — drag to look around, face a door, scroll through
     ============================================================ */

  function buildReception(hall, ctx) {
    var doors = DOORS.map(function (d) {
      var col = E.collection(d.key);
      var name = d.name || (col ? col.name : d.key);
      var stats = d.route.map(function (k) { return E.collectionStats(k); })
        .reduce(function (a, s) { a.titles += s.titles; a.available += s.available; return a; },
                { titles: 0, available: 0 });
      var view = el('video.rc-door-view', {
        muted: true, playsinline: true, preload: 'none',
        disablepictureinpicture: true, disableremoteplayback: true,
        poster: BASE + d.poster + '.jpg', 'aria-hidden': 'true'
      });
      view.muted = true;
      var node = el('button.rc-door' + (d.stairs ? '.rc-stairs' : ''), {
        type: 'button', 'data-door': d.key,
        'aria-label': name,
        style: { transform: 'rotateY(' + d.yaw + 'deg) translateZ(' + (-ROOM_R) + 'px)' }
      }, [
        el('div.rc-door-frame', {}, [
          d.stairs ? el('div.rc-steps', {}, [1, 2, 3, 4, 5, 6, 7].map(function () { return el('i'); })) : null,
          view,
          el('div.rc-door-shade')
        ]),
        el('div.rc-door-lintel', {}, [
          el('span.rc-door-heading', { text: d.heading }),
          el('b.rc-door-name', { text: name }),
          el('span.rc-door-meta', { text: stats.titles + ' titles · ' + stats.available + ' on the shelf' })
        ])
      ]);
      var door = { def: d, node: node, name: name, poster: d.poster, video: view, duration: 8, loaded: false,
                   key: 'door:' + d.key, src: BASE + d.poster + '-m.mp4',
                   drive: LS.FilmDrive ? LS.FilmDrive.of(view) : null };
      view.addEventListener('loadedmetadata', function () {
        var dur = view.duration; door.duration = (isFinite(dur) && dur > 0.5) ? dur : 8;
      });
      return door;
    });
    /* the doorways come alive as you look round and walk: every clip is
       moved by the drag and the scroll, none of them plays on its own */
    function seen(d) {   // degrees between where you are looking and this doorway
      return Math.abs(((norm(view.yaw) - d.def.yaw + 540) % 360) - 180);
    }
    /* Ten doorways stand round the reception, and you can only ever face a
       few. The ones behind your head hold a decoder for a picture nobody is
       looking at, so they give it back and keep their poster. The two angles
       are far apart on purpose: a doorway at the edge of your view must not
       be able to load and unload as you turn. */
    function loadDoors() {
      doors.forEach(function (d) {
        var v = seen(d);
        if (v <= 110) LS.ClipBudget.want(d, v <= 55 ? 3 : 2);
        else if (v > 165) LS.ClipBudget.drop(d);
      });
    }
    function unloadDoors() { doors.forEach(function (d) { LS.ClipBudget.drop(d); }); }
    function driveDoors() {
      var base = 0.06 + 0.7 * (view.p || 0) + (view.spin || 0);
      doors.forEach(function (d) {
        var v = seen(d);
        if (v <= 110) LS.ClipBudget.want(d, v <= 55 ? 3 : 2);
        else if (v > 165) LS.ClipBudget.drop(d);
        if (!d.drive || !d.loaded) return;
        var diff = v;
        if (diff > 80) { d.drive.stop(); return; }       // only the doorways you can see move
        d.drive.to(Math.min(1, base) * (d.duration - 0.06));
      });
    }

    var world = el('div.rc-world', {}, [
      el('div.rc-floor'), el('div.rc-ceiling'),
      el('div.rc-lamp', {}, [el('i'), el('i')])
    ].concat(doors.map(function (d) { return d.node; })));
    var room = el('div.rc-room', {}, world);
    var push = el('div.rc-push', {}, el('img', { alt: '' }));

    var compass = el('div.rc-compass', {}, [
      el('div.rc-compass-ring', {}, ['N', 'E', 'S', 'W'].map(function (l, i) {
        return el('span', { text: l, style: { transform: 'rotate(' + (i * 90) + 'deg) translateY(-38px) rotate(' + (-i * 90) + 'deg)' } });
      })),
      el('i.rc-compass-needle'),
      el('b.rc-compass-deg', { text: '0°' })
    ]);

    var caption = el('div.jr-caption.is-in', {}, [
      el('span.jr-caption-label', { text: 'The reception' }),
      el('span.jr-caption-line', { text: 'Drag to look around. Face a door, or the stairs.' })
    ]);
    var hud = el('div.jr-hud', {}, [
      el('div.jr-hud-l', {}, [
        el('div.jr-hud-num', { text: '⌂' }),
        el('div', {}, [
          el('div.jr-hud-name', { text: 'Reception' }),
          el('div.jr-hud-hall', { text: 'Every hall leads off it' })
        ])
      ]),
      el('div.jr-hud-r', {}, [
        el('div.jr-hud-stats', {}, [
          el('b.rc-facing', { text: 'Facing: Science & Technology' }),
          el('span', { text: 'drag · click a door · scroll to walk' })
        ]),
        el('div.jr-progress', {}, el('span'))
      ])
    ]);
    var progress = hud.querySelector('.jr-progress > span');
    var facing = hud.querySelector('.rc-facing');

    var chips = el('div.rc-doorlist', {}, doors.map(function (d) {
      return el('button.rc-chip', { type: 'button', 'data-door': d.def.key }, [
        el('span', { text: d.def.heading }), el('b', { text: d.name })
      ]);
    }));

    var stage = el('div.jr-stage.jr-stage-reception', {}, [
      room, push,
      el('div.jr-scrim'), el('div.jr-grain'),
      buildRail(ctx, null),
      hud, caption, compass, chips
    ]);
    var node = el('section.jr-hall.jr-hall-reception', { 'data-hall': 'reception' }, stage);

    /* --- looking around ----------------------------------------- */
    var view = { yaw: 0, dolly: 0, focused: null, locked: false, p: 0, spin: 0 };
    var yawTween = null;

    function applyView() {
      world.style.transform = 'translateZ(' + view.dolly.toFixed(1) + 'px) rotateY(' +
        (-view.yaw).toFixed(2) + 'deg)';
      compass.querySelector('.rc-compass-needle').style.transform =
        'rotate(' + (-norm(view.yaw)).toFixed(1) + 'deg)';
      compass.querySelector('.rc-compass-deg').textContent = Math.round(norm(view.yaw)) + '°';
    }
    function norm(a) { a = a % 360; if (a < 0) a += 360; return a; }
    function nearest(yaw) {
      var best = null, bd = 1e9;
      doors.forEach(function (d) {
        var diff = Math.abs(((norm(yaw) - d.def.yaw + 540) % 360) - 180);
        if (diff < bd) { bd = diff; best = d; }
      });
      return best;
    }

    function focus(key, turn) {
      var d = doors.find(function (x) { return x.def.key === key; });
      if (!d) return;
      var changed = view.focused !== d;
      view.focused = d;
      doors.forEach(function (x) { x.node.classList.toggle('is-focused', x === d); });
      Array.prototype.forEach.call(chips.children, function (c) {
        c.classList.toggle('is-focused', c.getAttribute('data-door') === key);
      });
      facing.textContent = 'Facing: ' + d.name;
      caption.querySelector('.jr-caption-line').textContent =
        'Scroll to walk ' + (d.def.stairs ? 'up the stairs to ' : 'through to ') + d.name + '.';
      push.firstChild.src = BASE + d.poster + '.jpg';
      if (turn) {
        /* take the short way round */
        var target = d.def.yaw;
        var cur = norm(view.yaw);
        var delta = ((target - cur + 540) % 360) - 180;
        if (yawTween) yawTween.kill();
        yawTween = gsap.to(view, { yaw: view.yaw + delta, duration: 0.9, ease: 'power3.out',
                                   onUpdate: applyView });
      }
      if (changed) orderRoute(ctx, d.def);
    }

    /* drag */
    var drag = null;
    room.addEventListener('pointerdown', function (e) {
      if (view.locked) return;
      drag = { x: e.clientX, yaw: view.yaw, moved: false };
      room.setPointerCapture && room.setPointerCapture(e.pointerId);
      if (yawTween) yawTween.kill();
      room.classList.add('is-dragging');
    });
    room.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      var yaw = drag.yaw - dx * 0.32;                   // drag right = look right
      view.spin = Math.min(0.24, (view.spin || 0) + Math.abs(yaw - view.yaw) / 900);   // turning your head moves the doorways on
      view.yaw = yaw;
      applyView();
      driveDoors();
    });
    function endDrag(e) {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      room.classList.remove('is-dragging');
      var d = nearest(view.yaw);
      if (moved) focus(d.def.key, true);
    }
    room.addEventListener('pointerup', endDrag);
    room.addEventListener('pointercancel', endDrag);
    room.addEventListener('lostpointercapture', endDrag);

    /* click a door (only counts if it was not a drag) */
    stage.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-door]');
      if (!btn) return;
      focus(btn.getAttribute('data-door'), true);
    });

    /* keyboard: arrows turn to the neighbouring door, Enter walks */
    stage.tabIndex = 0;
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        var i = doors.indexOf(view.focused || nearest(view.yaw));
        var j = (i + (e.key === 'ArrowRight' ? 1 : -1) + doors.length) % doors.length;
        focus(doors[j].def.key, true);
      }
      if (e.key === 'Enter' && view.focused) {
        e.preventDefault();
        var first = view.focused.def.route[0];
        scrollToHall(ctx, first);
      }
    });

    /* --- render at progress p ∈ [0,1] --------------------------- */
    var ARRIVE = 0.22;         // the room brightens and settles
    var WALK = 0.60;           // from here the visitor walks through the door
    function render(p) {
      view.p = p;
      progress.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var settle = Math.min(1, p / ARRIVE);
      stage.style.setProperty('--rc-light', settle.toFixed(3));

      var walk = Math.max(0, (p - WALK) / (1 - WALK));
      view.locked = walk > 0;
      stage.classList.toggle('is-walking', walk > 0);
      if (walk > 0 && !view.focused) focus(nearest(view.yaw).def.key, true);
      view.dolly = walk * (ROOM_R - 210);
      applyView();
      driveDoors();

      /* the last stretch is a match cut: the door's poster grows to fill the
         frame, and the next stage opens on that same frame */
      var into = Math.max(0, (walk - 0.55) / 0.45);
      push.style.opacity = into.toFixed(3);
      push.style.transform = 'scale(' + (0.72 + 0.28 * into).toFixed(3) + ')';
      stage.classList.toggle('is-ending', p > 0.9);
    }

    applyView();
    focus(DOORS[0].key, false);

    return {
      node: node, stage: stage, beats: [], render: render, trigger: null, def: hall.def,
      focus: focus, load: loadDoors, unload: unloadDoors, videos: doors.map(function (d) { return d.video; }),
      onToggle: function (active) { if (active) { stage.focus({ preventScroll: true }); driveDoors(); } else doors.forEach(function (d) { if (d.drive) d.drive.stop(); }); }
    };
  }

  LS.Scenes = { mount: mount, REGISTRY: REGISTRY, DOORS: DOORS, BASE: BASE };
})(window);
