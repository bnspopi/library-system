/* ============================================================
   shelfwalk.js — "Walk the stacks"

   A scroll-scrubbed walk down a library aisle. The corridor is
   real CSS 3D geometry rather than video, which matters here:
   the spines on the near bays are catalogue records, so any of
   them can be pulled off the shelf and reserved against the same
   engine the circulation desk uses.

   LS.ShelfWalk.mount(host, { scroller, patronId, onReserved })
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;

  /* --- hall dimensions, in CSS pixels ---------------------- */
  var BAY = 470;          // depth of one bay
  var BAYS = 7;           // how many bays deep the aisle runs
  var HALF = 430;         // half the aisle width
  var WALL_H = 640;       // shelf-unit height
  var FLOOR_Y = 320;      // floor plane offset below the eye
  var CEIL_Y = 320;       // ceiling plane offset above the eye
  var LIVE_BAYS = [5, 6]; // bays whose spines are real records
  var STOP_AT = 4.55;     // the bay the walk halts in front of

  /* Spine colours — bookcloth, not a rainbow. */
  var CLOTHS = [
    ['#5d2f2a', '#301412'], ['#2f3d52', '#151f2c'], ['#3d3a25', '#1d1b10'],
    ['#4a3320', '#231709'], ['#2c4438', '#12231a'], ['#4b2a3c', '#22111b'],
    ['#37404a', '#181d23'], ['#5a4423', '#2a1f0d'], ['#243642', '#0f1a20'],
    ['#4f2f33', '#261316'], ['#3a4a3f', '#1a241d'], ['#5a4a2c', '#281f10']
  ];

  var CAPTIONS = [
    [0.00, 'The doors',       'The reading room is open. Nobody asks you what you want.'],
    [0.16, 'The aisle',       'Seven bays deep. Everything in its place, by number.'],
    [0.34, 'Classification',  'The call number is an address — floor, bay, shelf, and where on it.'],
    [0.52, 'The light',       'Follow him. He knows which bay he wants.'],
    [0.70, 'The stacks',      'He stops. So do you.'],
    [0.86, 'Take one down',   'Any spine with a gilt edge is a record you can reserve.']
  ];

  /* ============================================================
     construction
     ============================================================ */

  function mount(host, opts) {
    opts = opts || {};
    var reduced = global.Motion && Motion.reduced;
    var scroller = opts.scroller || global;
    var bibs = (opts.bibs || E.db().bibs).slice();

    host.classList.add('sw');
    if (opts.embedded) host.classList.add('sw-embedded');
    host.innerHTML = '';

    var world = el('div.sw-world');
    var stage = el('div.sw-stage', {}, [
      el('div.sw-hall', {}, world),
      el('div.sw-fog'),
      el('div.sw-dust'),
      el('div.sw-vig'),
      el('div.sw-grain')
    ]);
    var track = el('div.sw-track', {}, stage);
    host.appendChild(track);

    buildHall(world, bibs);
    var walker = buildWalker(stage);
    buildDust(stage.querySelector('.sw-dust'));

    /* --- chrome ------------------------------------------- */
    var caption = el('div.sw-caption', {}, [
      el('span.sw-caption-label'),
      el('span.sw-caption-line')
    ]);
    var gaugeFill = el('span');
    var gauge = el('div.sw-gauge', {}, gaugeFill);
    for (var g = 0; g < BAYS; g++) {
      gauge.appendChild(el('i.sw-gauge-bay', {
        style: { top: (g / (BAYS - 1) * 100) + '%' } }));
    }
    var cue = el('div.sw-cue', {}, [
      el('span', { text: opts.embedded ? 'Scroll the panel' : 'Scroll to walk' }),
      el('i')
    ]);
    var prompt = el('div.sw-prompt', {}, [
      el('div.sw-prompt-text', {}, [
        el('span', { html: 'Pull a book off the shelf — <b>click any spine</b>' }),
        el('span.sw-prompt-hint', { text: 'Every gilt-edged spine is a live catalogue record' })
      ]),
      el('button.btn.btn-sm.btn-primary', { 'data-ripple': '', onclick: function () {
        var pick = world.querySelector('.sw-spine-live');
        if (pick) pick.click();
      } }, 'Open one for me')
    ]);

    stage.appendChild(el('div.sw-hud', {}, [
      el('h3.sw-hud-title', { text: opts.title || 'THE STACKS' }),
      el('div.sw-hud-meta', {}, [
        el('b', { text: 'Level 1 · Open stacks' }),
        el('span.sw-bayread', { text: 'Bay 1 of ' + BAYS })
      ])
    ]));
    stage.appendChild(gauge);
    stage.appendChild(caption);
    stage.appendChild(cue);
    stage.appendChild(prompt);

    /* --- scrubbing ---------------------------------------- */
    var state = { p: -1, stage: -1, live: false };
    var bayRead = stage.querySelector('.sw-bayread');

    function progress() {
      /* The stage is sticky, so the scrubbable distance is how much taller the
         track is than the stage — not than the viewport. Embedded, the stage is
         shorter than the pane, and measuring against the pane stalls the walk
         part-way down the aisle. */
      var span = track.offsetHeight - stage.offsetHeight;
      if (span <= 0) return 0;
      if (scroller === global) {
        return clamp(-track.getBoundingClientRect().top / span, 0, 1);
      }
      /* offsetTop is relative to the nearest positioned ancestor, which is not
         the scroll container — measure the gap between the two directly. */
      var top = track.getBoundingClientRect().top -
                scroller.getBoundingClientRect().top + scroller.scrollTop;
      return clamp((scroller.scrollTop - top) / span, 0, 1);
    }

    function paint(p) {
      if (Math.abs(p - state.p) < 0.0004) return;
      state.p = p;

      /* camera: ease the dolly so the first and last steps settle */
      var eased = p * p * (3 - 2 * p);
      var z = eased * STOP_AT * BAY;

      /* footfall bob and a little handheld drift, both fading out
         once he stops walking at the end of the aisle */
      var settle = 1 - smooth(p, 0.80, 0.96);
      var steps = z / 120;
      var bob = reduced ? 0 : Math.sin(steps * Math.PI) * 5.5 * settle;
      var sway = reduced ? 0 : Math.sin(steps * Math.PI * 0.5) * 1.05 * settle;
      var pitch = reduced ? 0 : Math.cos(steps * Math.PI * 0.5) * 0.5 * settle;

      world.style.transform =
        'translateZ(' + z.toFixed(1) + 'px) translateY(' + bob.toFixed(2) + 'px) ' +
        'rotateY(' + sway.toFixed(3) + 'deg) rotateX(' + pitch.toFixed(3) + 'deg)';

      gaugeFill.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      bayRead.textContent = 'Bay ' + Math.min(BAYS, 1 + Math.floor(eased * STOP_AT + 0.5)) +
                            ' of ' + BAYS;

      walker.update(p, eased);

      /* captions */
      var idx = 0;
      for (var i = 0; i < CAPTIONS.length; i++) if (p >= CAPTIONS[i][0]) idx = i;
      if (idx !== state.stage) {
        state.stage = idx;
        caption.classList.remove('is-in');
        var lab = caption.firstChild, line = caption.lastChild;
        setTimeout(function () {
          lab.textContent = CAPTIONS[idx][1];
          line.textContent = CAPTIONS[idx][2];
          caption.classList.add('is-in');
        }, reduced ? 0 : 240);
      }

      cue.classList.toggle('is-out', p > 0.78);

      /* the shelf goes live only once he has stopped in front of it */
      var live = p > 0.84;
      if (live !== state.live) {
        state.live = live;
        prompt.classList.toggle('is-in', live);
        U.$$('.sw-spine-live', world).forEach(function (s) {
          s.tabIndex = live ? 0 : -1;
          s.style.pointerEvents = live ? 'auto' : 'none';
        });
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; paint(progress()); });
    }
    (scroller === global ? global : scroller)
      .addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('resize', onScroll);

    if (reduced) paint(1);
    else { paint(0); onScroll(); }

    /* --- pulling a book ----------------------------------- */
    world.addEventListener('click', function (e) {
      var spine = e.target.closest && e.target.closest('.sw-spine-live');
      if (!spine || !state.live) return;
      var bib = E.bib(spine.getAttribute('data-bib'));
      if (!bib) return;
      spine.classList.add('is-pulled');
      setTimeout(function () { spine.classList.remove('is-pulled'); }, 900);
      openBook(bib, opts);
    });
    world.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var spine = e.target.closest && e.target.closest('.sw-spine-live');
      if (spine) { e.preventDefault(); spine.click(); }
    });

    return {
      destroy: function () {
        (scroller === global ? global : scroller).removeEventListener('scroll', onScroll);
        global.removeEventListener('resize', onScroll);
        host.innerHTML = '';
      },
      paint: paint
    };
  }

  /* ============================================================
     the hall
     ============================================================ */

  function buildHall(world, bibs) {
    var pool = bibs.slice();
    var nextLive = 0;

    for (var i = 0; i < BAYS; i++) {
      var z = i * BAY + BAY / 2;
      var live = LIVE_BAYS.indexOf(i) !== -1;

      /* walls, each carrying a shelf unit */
      ['l', 'r'].forEach(function (side) {
        var wall = panel('sw-wall', BAY, WALL_H,
          'translateX(' + (side === 'l' ? -HALF : HALF) + 'px) ' +
          'translateZ(' + (-z) + 'px) rotateY(' + (side === 'l' ? 90 : -90) + 'deg)');
        wall.appendChild(buildUnit(live, pool, function () {
          return pool[(nextLive++) % pool.length];
        }));
        world.appendChild(wall);
      });

      /* floor and ceiling strips */
      world.appendChild(panel('sw-floor', HALF * 2, BAY,
        'translateY(' + FLOOR_Y + 'px) translateZ(' + (-z) + 'px) rotateX(90deg)'));
      world.appendChild(panel('sw-ceiling', HALF * 2, BAY,
        'translateY(' + (-CEIL_Y) + 'px) translateZ(' + (-z) + 'px) rotateX(-90deg)'));

      /* a pendant over every bay, and the pool of light it throws */
      var lamp = el('div.sw-lamp', {
        style: { transform: 'translate(-50%,-50%) translateY(' + (-CEIL_Y + 30) +
                 'px) translateZ(' + (-z) + 'px)' } }, [
        el('div.sw-lamp-shade'), el('div.sw-lamp-glow')
      ]);
      world.appendChild(lamp);
      world.appendChild(el('div.sw-pool', {
        style: { transform: 'translate(-50%,-50%) translateY(' + (FLOOR_Y - 1) +
                 'px) translateZ(' + (-z) + 'px) rotateX(90deg)' } }));
    }

    /* the reading room at the far end */
    var end = panel('sw-end', HALF * 2, WALL_H + 260,
      'translateZ(' + (-(BAYS * BAY + 120)) + 'px)');
    end.appendChild(el('div.sw-end-window'));
    world.appendChild(end);
  }

  function panel(cls, w, h, transform) {
    return el('div.sw-panel.' + cls, {
      style: {
        width: w + 'px', height: h + 'px',
        marginLeft: (-w / 2) + 'px', marginTop: (-h / 2) + 'px',
        transform: transform
      }
    });
  }

  /** A shelf unit: four rows. Live units get real, clickable spines;
      the rest are a painted strip, which keeps the node count sane. */
  function buildUnit(live, pool, take) {
    var unit = el('div.sw-unit', { style: { '--rows': '4' } });
    for (var r = 0; r < 4; r++) {
      var row = el('div.sw-row' + (live ? '' : '.sw-row-painted'));
      if (live) {
        var used = 0;
        while (used < BAY - 26) {
          var b = take();
          var w = 14 + ((b.title.length * 3) % 22);
          if (used + w > BAY - 22) break;
          used += w + 2;
          row.appendChild(spine(b, w));
        }
      } else {
        row.style.setProperty('--spines', paintedSpines(r));
      }
      unit.appendChild(row);
    }
    return unit;
  }

  function spine(bib, w) {
    var c = CLOTHS[(bib.title.charCodeAt(0) + bib.year) % CLOTHS.length];
    var h = 74 + ((bib.title.length * 7) % 22);
    return el('button.sw-spine.sw-spine-live', {
      type: 'button',
      tabindex: '-1',
      'data-bib': bib.id,
      title: bib.title + ' — ' + bib.author,
      'aria-label': 'Open ' + bib.title + ' by ' + bib.author,
      style: { '--w': w + 'px', '--h': h + '%', '--c1': c[0], '--c2': c[1],
               pointerEvents: 'none' }
    }, [
      el('span.sw-spine-band.sw-spine-band-a'),
      el('span.sw-spine-band.sw-spine-band-b'),
      el('span.sw-spine-txt', { text: bib.title })
    ]);
  }

  /** A row of distant books as one repeating gradient. */
  function paintedSpines(seed) {
    var stops = [];
    var x = 0;
    var n = 0;
    while (x < 100 && n < 42) {
      var c = CLOTHS[(seed * 5 + n * 7) % CLOTHS.length];
      var w = 1.4 + ((n * 13 + seed * 5) % 9) * 0.28;
      stops.push(c[1] + ' ' + x.toFixed(2) + '%');
      stops.push(c[0] + ' ' + (x + w * 0.62).toFixed(2) + '%');
      stops.push(c[1] + ' ' + (x + w).toFixed(2) + '%');
      stops.push('#070604 ' + (x + w).toFixed(2) + '%');
      stops.push('#070604 ' + (x + w + 0.22).toFixed(2) + '%');
      x += w + 0.22;
      n++;
    }
    return 'linear-gradient(90deg,' + stops.join(',') + ')';
  }

  /* ============================================================
     the walker
     ============================================================ */

  function buildWalker(stage) {
    var fig = el('div.sw-walker.sw-walking', { style: { '--gait': '0.95s' } });
    fig.innerHTML =
      '<svg viewBox="0 0 120 300" width="120" height="300" aria-hidden="true">' +
        '<g class="sw-fig">' +
          /* legs behind the coat */
          '<rect class="sw-leg-a" x="52" y="196" width="13" height="96" rx="6"/>' +
          '<rect class="sw-leg-b" x="66" y="196" width="13" height="96" rx="6"/>' +
          /* coat */
          '<path d="M43 108 q22 -12 44 0 l9 74 q-31 11 -62 0 z"/>' +
          '<path d="M46 178 l38 0 l4 34 q-23 8 -46 0 z"/>' +
          /* arms */
          '<rect class="sw-arm-a" x="36" y="112" width="12" height="74" rx="6"/>' +
          '<rect class="sw-arm-b" x="82" y="112" width="12" height="74" rx="6"/>' +
          /* head and shoulders */
          '<circle cx="65" cy="86" r="18"/>' +
          '<path d="M47 104 q18 -9 36 0 l3 10 q-21 -7 -42 0 z"/>' +
        '</g>' +
      '</svg>';
    fig.appendChild(el('div.sw-walker-shadow'));
    stage.appendChild(fig);

    /* He stays ahead of the camera, so he shrinks as the aisle opens up and
       grows as you close on him. His feet have to land on the floor plane,
       which in perspective sits at eye level plus FLOOR_Y foreshortened by
       his distance — anchoring him to the bottom of the stage instead would
       bury him under the floor. */
    var P = 1000;                 // must match the hall's perspective
    var FIG_H = 340;              // his height in world units
    return {
      node: fig,
      update: function (p, eased) {
        var lead = 1 - smooth(p, 0.62, 0.95);          // how far ahead he walks
        var dist = 620 + lead * 1850;
        var k = P / (P + dist);                        // perspective foreshortening
        var stageH = stage.clientHeight || 800;
        var eyeY = stageH * 0.47;
        var feetY = eyeY + FLOOR_Y * k;
        var scale = (FIG_H * k) / 300;                 // the svg is 300 units tall
        var drift = Math.sin(eased * 5.2) * 22 * (1 - smooth(p, 0.7, 0.9));

        var base = 'translate(-50%, -100%) scale(' + scale.toFixed(3) + ')';
        fig.style.setProperty('--base', base);
        fig.style.top = feetY.toFixed(1) + 'px';
        fig.style.bottom = 'auto';
        fig.style.left = (50 + drift * 0.1) + '%';
        fig.style.transform = base + (p > 0.88 ? ' rotateY(58deg)' : '');
        fig.style.opacity = p > 0.99 ? 0 : 1;
        fig.style.setProperty('--gait', (0.72 + (1 - lead) * 0.5).toFixed(2) + 's');
        fig.classList.toggle('sw-walking', p < 0.86);
      }
    };
  }

  function buildDust(host) {
    if (global.Motion && Motion.reduced) return;
    for (var i = 0; i < 26; i++) {
      host.appendChild(el('span.sw-mote', {
        style: {
          left: (4 + (i * 37) % 92) + '%',
          top: (18 + (i * 53) % 70) + '%',
          '--d': (13 + (i % 9) * 2.4) + 's',
          '--dx': (((i % 5) - 2) * 26) + 'px',
          '--o': (0.18 + (i % 4) * 0.14).toFixed(2),
          animationDelay: (-i * 1.4) + 's'
        }
      }));
    }
  }

  /* ============================================================
     opening a book — the reservation
     ============================================================ */

  function openBook(bib, opts) {
    opts = opts || {};
    var items = E.itemsOf(bib.id);
    var avail = E.availability(bib.id);
    var db = E.db();
    var byBranch = U.groupBy(items, function (i) { return i.branch; });
    var cloth = CLOTHS[(bib.title.charCodeAt(0) + bib.year) % CLOTHS.length];

    var overlay = el('div.sw-open', { role: 'dialog', 'aria-modal': 'true',
      'aria-label': 'Reserve ' + bib.title });

    /* --- left page: the record ---------------------------- */
    var pageL = el('div.sw-page.sw-page-l', {}, [
      el('div.eyebrow.no-rule', { text: bib.format + ' · ' + bib.dewey }),
      el('h3.h3', { style: { marginTop: '12px' }, text: bib.title }),
      el('div.small.muted', { style: { marginTop: '6px' },
        text: bib.author + ' · ' + bib.publisher + ', ' + bib.year }),
      el('p.small.muted', { style: { marginTop: '18px' }, text: bib.summary }),
      el('div.row.wrapflex', { style: { '--gap': '6px', marginTop: '18px' } },
        bib.subjects.map(function (s) { return el('span.chip', { text: s }); })),
      el('div.hairline', { style: { margin: '20px 0' } }),
      el('div.panel-title', { style: { marginBottom: '10px' }, text: 'On the shelf' }),
      el('div.sw-avail', {}, Object.keys(byBranch).map(function (code) {
        var list = byBranch[code];
        var free = list.filter(function (i) { return i.status === 'available'; });
        return el('div.sw-availrow', {}, [
          el('div', {}, [
            el('b', { text: E.branch(code).name }),
            el('span', { text: list[0].shelf + ' · ' + list[0].callNo })
          ]),
          el('span.chip' + (free.length ? '.chip-ok' : '.chip-warn'), {
            text: free.length + ' of ' + list.length })
        ]);
      }))
    ]);

    /* --- right page: the booking -------------------------- */
    var pageR = el('div.sw-page.sw-page-r');
    var body = el('div');
    pageR.appendChild(body);

    function renderBooking() {
      body.innerHTML = '';
      var me = opts.patronId || (LS.opac && LS.opac.me) || db.patrons[0].id;

      body.appendChild(el('div.eyebrow.no-rule', { text: 'Reservation' }));
      body.appendChild(el('h3.h3', { style: { marginTop: '12px' },
        text: avail.available ? 'A copy is on the shelf' : 'Join the queue' }));
      body.appendChild(el('p.small.muted', { style: { marginTop: '10px' }, text:
        avail.available
          ? 'Reserve it and staff pull it from the shelf onto your pickup shelf today. ' +
            'You will be notified the moment it is trapped for you.'
          : 'All ' + avail.total + ' copies are out. A hold is on the title, not a copy — ' +
            'whichever comes back first goes to whoever has waited longest.' }));

      body.appendChild(el('div.row.wrapflex', { style: { '--gap': '6px', marginTop: '16px' } }, [
        el('span.chip' + (avail.available ? '.chip-ok' : '.chip-warn'), {}, [
          el('span.dot'), el('span', { text: avail.available + ' of ' + avail.total + ' available' })
        ]),
        avail.queue ? el('span.chip.chip-gold', { text: avail.queue + ' already waiting' }) : null,
        avail.out ? el('span.chip.chip-info', { text: avail.out + ' on loan' }) : null
      ]));

      var meSel = el('select.select', {}, db.patrons.map(function (p) {
        return el('option', { value: p.id, selected: p.id === me },
          p.name + ' — ' + E.patronTypeName(p.type));
      }));
      var brSel = el('select.select', {}, db.branches.map(function (b) {
        return el('option', { value: b.code, selected: b.code === E.patron(me).branch }, b.name);
      }));

      body.appendChild(el('div.sw-book-fields', {}, [
        el('label.field', {}, [el('span.label', { text: 'Borrowing as' }), meSel]),
        el('label.field', {}, [el('span.label', { text: 'Collect at' }), brSel])
      ]));

      var btn = el('button.btn.btn-primary.sw-reserve', { 'data-ripple': '',
        onclick: function () {
          var res = E.placeHold(meSel.value, bib.id, brSel.value, { channel: 'opac' });
          if (!res.ok) {
            body.appendChild(el('div.warnbox', { style: { marginTop: '16px' } }, [
              el('b.small', { text: res.msg }),
              el('p.tiny.faint', { style: { margin: '6px 0 0' },
                text: 'The engine refused this for the same reason the desk would.' })
            ]));
            btn.disabled = true;
            return;
          }
          confirmed(res, meSel.value, brSel.value);
        } }, avail.available ? 'Reserve this copy' : 'Place a hold');
      body.appendChild(btn);

      body.appendChild(el('p.tiny.faint', { style: { marginTop: '14px' }, text:
        'This writes a real hold into the demo database — you will find it in the staff ' +
        'client under Holds & transit, and on the member’s account.' }));
    }

    function confirmed(res, patronId, branchCode) {
      var p = E.patron(patronId);
      body.innerHTML = '';
      body.appendChild(el('div.eyebrow.no-rule', { text: 'Reserved' }));
      body.appendChild(el('h3.h3', { style: { marginTop: '12px' }, text: bib.title }));
      body.appendChild(el('div.sw-stamp', {}, [
        el('span.sw-stamp-mark', { text: res.pullable ? 'On the pull list' : 'In the queue' }),
        el('div', {}, U.util ? null : null),
        el('dl.kv', {}, [
          el('dt', { text: 'Member' }), el('dd', { text: p.name }),
          el('dt', { text: 'Collect at' }), el('dd', { text: E.branch(branchCode).name }),
          el('dt', { text: 'Position' }), el('dd', { text: '#' + res.position + ' in the queue' }),
          el('dt', { text: 'Hold' }), el('dd', {}, el('span.mono', { text: res.hold.id }))
        ])
      ]));
      body.appendChild(el('p.small.muted', { style: { marginTop: '16px' }, text: res.detail }));
      body.appendChild(el('div.row.wrapflex', { style: { '--gap': '9px', marginTop: '18px' } }, [
        el('a.btn.btn-sm.btn-primary', { href: appLink('holds'), 'data-ripple': '' },
           'See it in the staff client →'),
        el('button.btn.btn-sm', { onclick: function () {
          avail = E.availability(bib.id);
          renderBooking();
        } }, 'Reserve for someone else')
      ]));
      if (opts.onReserved) opts.onReserved(res);
    }

    renderBooking();

    /* --- the board that swings open ----------------------- */
    var cover = el('div.sw-cover', { style: { '--c1': cloth[0], '--c2': cloth[1] } }, [
      el('div.sw-cover-face', {}, [
        el('div', {}, [
          el('div.sw-cover-title', { text: bib.title }),
          el('div.sw-cover-author', { text: bib.author })
        ]),
        el('div.sw-cover-foot', { text: bib.dewey })
      ]),
      el('div.sw-cover-back', {}, el('div.sw-cover-back-plate', {}, [
        el('div.tiny.faint', { text: 'AURELIA PUBLIC & RESEARCH LIBRARY' }),
        el('div.mono.tiny.gold', { style: { marginTop: '8px' }, text: bib.dewey }),
        el('div.tiny.faint', { style: { marginTop: '8px' },
          text: 'Accessioned ' + U.fmtDate(bib.created) })
      ]))
    ]);

    var book = el('div.sw-book', {}, [
      el('button.sw-open-x', { onclick: close }, 'Put it back'),
      el('div.sw-book-inner', {}, [
        el('div.sw-spread', {}, [pageL, pageR]),
        cover
      ])
    ]);
    overlay.appendChild(book);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');

    requestAnimationFrame(function () {
      overlay.classList.add('is-in');
      setTimeout(function () { overlay.classList.add('is-open'); },
                 (global.Motion && Motion.reduced) ? 0 : 340);
    });

    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('is-open');
      overlay.classList.remove('is-in');
      document.body.classList.remove('modal-open');
      setTimeout(function () { overlay.remove(); }, 420);
    }
  }

  /** Link into the staff client from wherever this is mounted. */
  function appLink(view) {
    var onApp = /app\.html/.test(location.pathname);
    return (onApp ? '' : 'app.html') + '#/' + view;
  }

  /* ============================================================
     helpers
     ============================================================ */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(v, a, b) {
    var t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  LS.ShelfWalk = { mount: mount, openBook: openBook };
})(window);
