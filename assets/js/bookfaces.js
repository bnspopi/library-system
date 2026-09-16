/* ============================================================
   bookfaces.js — what is written on the pages.

   A face is { draw(ctx, W, H) -> hot[], film, filmRect, pop }. Faces are
   drawn onto 1024×1448 canvases the moment a book is taken down,
   so everything on them is live: counts, availability, the shelf.
   Hot rectangles are what you can click on a page.

   LS.BookFaces.collection(col)   eight pages for a hall's book
   LS.BookFaces.aurelia()         eight pages for the great book
   LS.BookFaces.bib(bib, col)     two pages for one title
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var E = LS.Engine;
  var L = LS.Living3D, P = L.pages, F = L.fonts, K = L.ink;
  var W = P.W, H = P.H, M = 120;

  function unique(arr) {
    var seen = {}, out = [];
    arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function bibsOf(key) { return E.db().bibs.filter(function (b) { return b.collection === key; }); }
  function beatsOf(key) {
    var d = LS.Scenes && LS.Scenes.REGISTRY.filter(function (x) { return x.key === key; })[0];
    return d ? d.beats : [];
  }
  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text.replace(/\s+$/, '') + '…';
  }
  function pillRight(ctx, label, xRight, y, kind) {
    ctx.font = '500 18px ' + F.ui;
    var w = ctx.measureText(label).width + 30;
    P.pill(ctx, label, xRight - w, y, kind);
  }
  function hotRect(r, action) { return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, action: action }; }

  /** a faint gold plinth where the film stands up */
  function plinth(ctx, y) {
    ctx.strokeStyle = 'rgba(138,106,42,.34)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(W / 2, y, 330, 70, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(138,106,42,.16)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(W / 2, y, 410, 94, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function statRow(ctx, y, items, size) {
    size = size || 64;
    var cw = (W - 2 * M) / items.length;
    items.forEach(function (it, i) {
      var x = M + cw * i;
      P.text(ctx, String(it[0]), x, y, { font: F.display, size: size, color: K.ink, weight: 500 });
      P.text(ctx, it[1], x, y + 32, { font: F.ui, size: 15, color: K.gold, spacing: '.2em', upper: true });
    });
    return y + 60;
  }

  function title(ctx, str, y, size) {
    return P.text(ctx, str, M, y, { font: F.display, size: size || 72, color: K.ink, weight: 500, maxW: W - 2 * M, lh: (size || 72) * 1.02 });
  }

  function exLibris(ctx, lines) {
    P.paper(ctx, W, H, { side: 'L' });
    ctx.strokeStyle = 'rgba(138,106,42,.6)'; ctx.lineWidth = 3; ctx.strokeRect(150, 280, W - 300, H - 560);
    ctx.strokeStyle = 'rgba(138,106,42,.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(166, 296, W - 332, H - 592);
    P.text(ctx, 'AURELIA PUBLIC & RESEARCH LIBRARY', W / 2, 380, { font: F.ui, size: 18, color: K.gold,
      align: 'center', spacing: '.3em', weight: 500, maxW: W - 360 });
    P.text(ctx, 'Ex libris', W / 2, 500, { font: F.display, size: 84, color: K.ink, align: 'center', italic: true });
    P.rule(ctx, W / 2 - 60, 540, 120);
    var y = 640;
    lines.forEach(function (l) {
      y = P.text(ctx, l.text, W / 2, y, {
        font: l.font || F.display, size: l.size || 32, color: l.color || K.ink, align: 'center',
        maxW: W - 380, lh: (l.size || 32) * 1.25, italic: !!l.italic, spacing: l.spacing, upper: !!l.upper, weight: l.weight
      }) + (l.gap || 30);
    });
  }

  /* ============================================================
     a hall's book
     ============================================================ */
  function collection(col) {
    var key = col.key;
    var bibs = bibsOf(key), beats = beatsOf(key);
    var hd = 'AURELIA · ' + col.hall;
    var next = nextCollection(key);

    return [
      /* 0 · inside the front cover */
      { draw: function (ctx) {
        exLibris(ctx, [
          { text: col.n, font: F.mono, size: 34, color: K.gold, spacing: '.3em', gap: 44 },
          { text: col.name, size: 62, weight: 500, gap: 14 },
          { text: col.hall, font: F.ui, size: 17, color: K.gold, spacing: '.26em', upper: true, gap: 70 },
          { text: col.blurb, size: 32, italic: true, color: K.soft, gap: 50 },
          { text: 'Every reservation placed from these pages is written into the live circulation database — the one the desk uses.', font: F.ui, size: 19, color: K.soft }
        ]);
        return [];
      } },

      /* 1 · title page: one of the hall's clips stands up out of it */
      { film: beats[1] ? beats[1].src : (beats[0] ? beats[0].src : null), filmRect: { x: 0.10, y: 0.09, w: 0.80 }, pop: true,
        draw: function (ctx) {
        var stats = E.collectionStats(key);
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '1' });
        plinth(ctx, 600);
        P.text(ctx, col.n, M, 880, { font: F.mono, size: 26, color: K.gold, spacing: '.3em' });
        var y = P.text(ctx, col.name, M, 962, { font: F.display, size: 78, color: K.ink, weight: 500, maxW: W - 2 * M, lh: 78 });
        P.text(ctx, col.hall, M, y + 10, { font: F.ui, size: 17, color: K.gold, spacing: '.26em', upper: true });
        statRow(ctx, 1262, [[stats.titles, 'titles'], [stats.copies, 'copies'], [stats.available, 'on the shelf']]);
        return [];
      } },

      /* 2 · in this hall */
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '2' });
        var y = title(ctx, 'In this hall', 262);
        P.rule(ctx, M, y + 4, 120);
        y += 64;
        beats.slice(0, 5).forEach(function (b) {
          if (y > H - 230) return;
          y = P.text(ctx, b.label, M, y, { font: F.ui, size: 16, color: K.gold, spacing: '.22em', upper: true, weight: 500 });
          y = P.text(ctx, b.lines.join(' '), M, y + 30, { font: F.display, size: 29, italic: true, color: K.ink, maxW: W - 2 * M, lh: 37 });
          y += 38;
        });
        return [];
      } },

      /* 3 · the film */
      { film: beats[0] ? beats[0].src : null, filmRect: { x: 0.08, y: 0.13, w: 0.84 }, draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '3' });
        var px = 0.08 * W, py = 0.13 * H, pw = 0.84 * W, ph = pw * 573 / 1280;
        ctx.strokeStyle = 'rgba(138,106,42,.5)'; ctx.lineWidth = 2; ctx.strokeRect(px - 8, py - 8, pw + 16, ph + 16);
        var b = beats[0] || { label: col.hall, lines: [] };
        var y = P.text(ctx, b.label, M, py + ph + 78, { font: F.display, size: 54, color: K.ink, weight: 500, maxW: W - 2 * M, lh: 56 });
        y = P.text(ctx, b.lines.join(' '), M, y + 24, { font: F.display, size: 29, italic: true, color: K.soft, maxW: W - 2 * M, lh: 37 });
        P.text(ctx, 'The film moves only when you do. Scroll, and it plays; stop, and it waits.', M, y + 44,
          { font: F.ui, size: 18, color: K.gold, maxW: W - 2 * M, lh: 26 });
        return [];
      } },

      /* 4 · the shelf */
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '4' });
        var hot = [];
        var y = title(ctx, 'The shelf', 262);
        P.text(ctx, 'Live catalogue records. Click one to reserve it.', M, y + 28, { font: F.ui, size: 18, color: K.gold, maxW: W - 2 * M });
        y += 80;
        bibs.slice(0, 8).forEach(function (b) {
          var av = E.availability(b.id);
          var top = y;
          P.rule(ctx, M, top, W - 2 * M, 'rgba(138,106,42,.25)');
          ctx.font = '500 34px ' + F.display;
          P.text(ctx, ellipsize(ctx, b.title, W - 2 * M - 300), M, top + 48, { font: F.display, size: 34, color: K.ink, weight: 500 });
          P.text(ctx, b.author + ' · ' + b.year, M, top + 82, { font: F.ui, size: 18, color: K.soft, maxW: W - 2 * M - 300 });
          var label = av.available ? av.available + ' of ' + av.total + ' on the shelf' : 'all ' + av.total + ' out';
          pillRight(ctx, label, W - M, top + 52, av.available ? 'ok' : 'warn');
          P.text(ctx, b.dewey, W - M, top + 88, { font: F.mono, size: 15, color: K.gold, align: 'right' });
          y = top + 118;
          hot.push({ x0: M, y0: top, x1: W - M, y1: y, action: { type: 'reserve', bib: b } });
        });
        P.rule(ctx, M, y, W - 2 * M, 'rgba(138,106,42,.25)');
        return hot;
      } },

      /* 5 · take one down */
      { draw: function (ctx) {
        var stats = E.collectionStats(key);
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '5' });
        var y = title(ctx, 'Take one down', 262);
        y = P.text(ctx, 'Every row on the facing page is a live catalogue record. Click one and the reservation opens — the same hold the desk would place, in the same database. It is on the pull list a moment later.',
          M, y + 56, { font: F.display, size: 31, italic: true, color: K.ink, maxW: W - 2 * M, lh: 41 });
        var hot = [];
        hot.push(hotRect(P.button(ctx, 'Open the shelf in the catalogue →', M, y + 60, W - 2 * M, true), { type: 'browse', key: key }));
        hot.push(hotRect(P.button(ctx, 'Walk this hall in the tour', M, y + 150, W - 2 * M, false), { type: 'walk', key: key }));
        statRow(ctx, y + 380, [[stats.out, 'on loan'], [stats.available, 'available now'], [bibs.length, 'titles here']]);
        return hot;
      } },

      /* 6 · catalogued under */
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '6' });
        var y = title(ctx, 'Catalogued under', 262);
        var subjects = unique([].concat.apply([], bibs.map(function (b) { return b.subjects || []; }))).slice(0, 14);
        var x = M; y += 66;
        subjects.forEach(function (s) {
          ctx.font = '500 18px ' + F.ui;
          var w = ctx.measureText(s).width + 30;
          if (x + w > W - M) { x = M; y += 46; }
          P.pill(ctx, s, x, y, 'gold');
          x += w + 12;
        });
        y += 110;
        var deweys = bibs.map(function (b) { return b.dewey; }).sort();
        var branches = unique([].concat.apply([], bibs.map(function (b) {
          return E.itemsOf(b.id).map(function (i) { return E.branch(i.branch).name; });
        })));
        [['Dewey range', deweys.length ? deweys[0] + ' — ' + deweys[deweys.length - 1] : '—', F.mono, 38],
         ['Formats', unique(bibs.map(function (b) { return b.format; })).join(' · ') || '—', F.display, 40],
         ['Shelved at', branches.join(' · ') || '—', F.display, 36]].forEach(function (row) {
          y = P.text(ctx, row[0], M, y, { font: F.ui, size: 15, color: K.gold, spacing: '.22em', upper: true, weight: 500 });
          y = P.text(ctx, row[1], M, y + 46, { font: row[2], size: row[3], color: K.ink, maxW: W - 2 * M, lh: row[3] * 1.15 }) + 44;
        });
        return [];
      } },

      /* 7 · the end of the hall (inside the back cover) */
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd });
        var y = title(ctx, 'The end of the hall', 300);
        y = P.text(ctx, 'Put it back, or take the next one down. Everything you reserved is already waiting behind the desk.',
          M, y + 50, { font: F.display, size: 31, italic: true, color: K.soft, maxW: W - 2 * M, lh: 41 });
        var hot = [];
        hot.push(hotRect(P.button(ctx, 'Next: ' + next.n + ' · ' + next.name + ' →', M, y + 70, W - 2 * M, true), { type: 'next', key: next.key }));
        hot.push(hotRect(P.button(ctx, 'Put the book back', M, y + 160, W - 2 * M, false), { type: 'close' }));
        return hot;
      } }
    ];
  }

  function nextCollection(key) {
    var cols = E.db().collections;
    var i = cols.findIndex(function (c) { return c.key === key; });
    return cols[(i + 1) % cols.length];
  }

  /* ============================================================
     the great book — the library system itself
     ============================================================ */
  var MODULES = [
    ['Circulation', 'Issue, return, renew — against a live policy matrix.', 'circulation'],
    ['Cataloguing', 'Bibliographic records, and the copies attached to them.', 'catalog'],
    ['Acquisitions', 'Order, encumber, receive, invoice, accession.', 'acquisitions'],
    ['Serials', 'Predict, check in, claim and bind the issues.', 'serials'],
    ['Holds & transit', 'Queues, traps, pull lists, and copies between branches.', 'holds'],
    ['Members', 'Registration, privileges, blocks and the account view.', 'patrons'],
    ['Fines & fees', 'Accrual, waivers, payments and the ledger.', 'fines'],
    ['Interlibrary loan', 'What we do not own, borrowed from someone who does.', 'ill'],
    ['Reports', 'Every number on this page, and where it came from.', 'reports'],
    ['Administration', 'The rules engine: who may take what, and for how long.', 'admin']
  ];
  var STANDARDS = [
    ['MARC 21', 'the record format every catalogue speaks'],
    ['Z39.50 / SRU', 'search a remote catalogue as if it were your own'],
    ['SIP2', 'self-check kiosks and gates talk to circulation'],
    ['NCIP', 'consortial borrowing between systems'],
    ['OAI-PMH', 'harvest the records into a discovery layer'],
    ['Dublin Core', 'the fifteen fields everything can be reduced to'],
    ['ISBD', 'how the description is punctuated'],
    ['EDIFACT / ONIX', 'orders and invoices with the book trade']
  ];

  function aurelia() {
    var db = E.db();
    var hd = 'AURELIA · THE LIVING STACKS';
    return [
      { draw: function (ctx) {
        exLibris(ctx, [
          { text: 'THE LIVING STACKS', font: F.mono, size: 26, color: K.gold, spacing: '.3em', gap: 44 },
          { text: 'Aurelia', size: 84, weight: 500, gap: 10 },
          { text: 'an integrated library system', font: F.ui, size: 17, color: K.gold, spacing: '.26em', upper: true, gap: 70 },
          { text: 'One database, every desk. The things a library owns, the people who borrow them, the money spent acquiring them, and the rules that decide who may take what and for how long.', size: 31, italic: true, color: K.soft, gap: 50 },
          { text: 'Every hall of the library has a book of its own in orbit around this one.', font: F.ui, size: 19, color: K.soft }
        ]);
        return [];
      } },
      { film: 'orbit-books', filmRect: { x: 0.10, y: 0.09, w: 0.80 }, pop: true, draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '1' });
        plinth(ctx, 600);
        P.text(ctx, 'THE GREAT BOOK', M, 880, { font: F.mono, size: 26, color: K.gold, spacing: '.3em' });
        var y = P.text(ctx, 'One database. Every desk.', M, 962, { font: F.display, size: 78, color: K.ink, weight: 500, maxW: W - 2 * M, lh: 78 });
        P.text(ctx, 'Check a book in and the catalogue, the hold queue, the fine engine and the statistics all move at once — because they are not separate applications.',
          M, y + 40, { font: F.display, size: 29, italic: true, color: K.soft, maxW: W - 2 * M, lh: 37 });
        return [];
      } },
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '2' });
        var y = title(ctx, 'Two faces of the same database', 262, 64);
        y += 50;
        [['Staff side', ['Issue, return and renew against a live policy matrix', 'Create bibliographic records and attach copies', 'Order, encumber, receive, invoice and accession', 'Predict, check in, claim and bind serial issues']],
         ['Public side', ['Search every branch, format and e-resource at once', 'Real-time availability, because it is the same record', 'Place a hold, watch your position in the queue', 'See and settle charges without speaking to anyone']]].forEach(function (side) {
          y = P.text(ctx, side[0], M, y, { font: F.ui, size: 16, color: K.gold, spacing: '.22em', upper: true, weight: 500 }) + 18;
          side[1].forEach(function (li) {
            ctx.fillStyle = K.gold; ctx.fillRect(M, y - 12, 8, 2);
            y = P.text(ctx, li, M + 28, y, { font: F.display, size: 29, color: K.ink, maxW: W - 2 * M - 28, lh: 36 }) + 10;
          });
          y += 40;
        });
        return [];
      } },
      { film: 'giant-book', filmRect: { x: 0.08, y: 0.13, w: 0.84 }, draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '3' });
        var px = 0.08 * W, py = 0.13 * H, pw = 0.84 * W, ph = pw * 573 / 1280;
        ctx.strokeStyle = 'rgba(138,106,42,.5)'; ctx.lineWidth = 2; ctx.strokeRect(px - 8, py - 8, pw + 16, ph + 16);
        var y = P.text(ctx, 'The gold path', M, py + ph + 78, { font: F.display, size: 54, color: K.ink, weight: 500 });
        y = P.text(ctx, 'It runs off the floor of the reception and onto the page. Every hall is written in it: history, atlases, poetry, the opening at elevation five hundred feet.',
          M, y + 24, { font: F.display, size: 29, italic: true, color: K.soft, maxW: W - 2 * M, lh: 37 });
        P.text(ctx, 'The film moves only when you do.', M, y + 44, { font: F.ui, size: 18, color: K.gold });
        return [];
      } },
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '4' });
        var hot = [];
        var y = title(ctx, 'Ten modules', 262);
        P.text(ctx, 'Click one to open it in the staff client.', M, y + 28, { font: F.ui, size: 18, color: K.gold });
        y += 76;
        MODULES.forEach(function (m, i) {
          var top = y;
          P.rule(ctx, M, top, W - 2 * M, 'rgba(138,106,42,.25)');
          P.text(ctx, ('0' + (i + 1)).slice(-2), M, top + 44, { font: F.mono, size: 16, color: K.gold });
          P.text(ctx, m[0], M + 60, top + 46, { font: F.display, size: 32, color: K.ink, weight: 500 });
          P.text(ctx, m[1], M + 60, top + 78, { font: F.ui, size: 17, color: K.soft, maxW: W - 2 * M - 60 });
          P.text(ctx, '→', W - M, top + 50, { font: F.display, size: 30, color: K.gold, align: 'right' });
          y = top + 100;
          hot.push({ x0: M, y0: top, x1: W - M, y1: y, action: { type: 'app', route: m[2] } });
        });
        P.rule(ctx, M, y, W - 2 * M, 'rgba(138,106,42,.25)');
        return hot;
      } },
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd, folio: '5' });
        var y = title(ctx, 'By the numbers', 262);
        y = statRow(ctx, y + 110, [[db.bibs.length, 'titles'], [db.items.length, 'copies'], [db.patrons.length, 'members']], 72) + 80;
        y = statRow(ctx, y + 60, [[db.policies.length, 'policy rows'], [db.branches.length, 'branches'], [STANDARDS.length, 'standards']], 72) + 80;
        y = P.text(ctx, 'Every button in the demo is wired to the engine described in this book. Issue a reference copy and watch it refused. Return a book somebody is waiting for and watch the hold trap.',
          M, y + 40, { font: F.display, size: 29, italic: true, color: K.soft, maxW: W - 2 * M, lh: 37 });
        var hot = [];
        hot.push(hotRect(P.button(ctx, 'Enter the working demo →', M, y + 50, W - 2 * M, true), { type: 'app', route: 'overview' }));
        hot.push(hotRect(P.button(ctx, 'Open the public catalogue', M, y + 140, W - 2 * M, false), { type: 'app', route: 'opac' }));
        return hot;
      } },
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'L', head: hd, folio: '6' });
        var y = title(ctx, 'Standards it speaks', 262) + 40;
        STANDARDS.forEach(function (s) {
          P.text(ctx, s[0], M, y, { font: F.mono, size: 24, color: K.ink, weight: 500 });
          y = P.text(ctx, s[1], M + 300, y, { font: F.display, size: 28, color: K.soft, maxW: W - 2 * M - 300, lh: 34 }) + 30;
        });
        return [];
      } },
      { draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd });
        var y = title(ctx, 'The rest is behind the desk', 300);
        y = P.text(ctx, 'Circulation, cataloguing, acquisitions, the policy matrix — the whole system, running. Or walk the halls first.',
          M, y + 50, { font: F.display, size: 31, italic: true, color: K.soft, maxW: W - 2 * M, lh: 41 });
        var hot = [];
        hot.push(hotRect(P.button(ctx, 'Open the staff client →', M, y + 70, W - 2 * M, true), { type: 'app', route: 'overview' }));
        hot.push(hotRect(P.button(ctx, 'Back to the tour', M, y + 160, W - 2 * M, false), { type: 'tour' }));
        hot.push(hotRect(P.button(ctx, 'Put the book back', M, y + 250, W - 2 * M, false), { type: 'close' }));
        return hot;
      } }
    ];
  }

  /* ============================================================
     one title, taken down in a hall: the record, and what stands
     up out of it
     ============================================================ */
  function bib(b, col, filmSlug) {
    var hd = 'AURELIA · ' + col.hall;
    if (!filmSlug) { var bt = beatsOf(col.key); filmSlug = bt[0] ? bt[0].src : null; }
    return [
      { draw: function (ctx) {
        var av = E.availability(b.id);
        var items = E.itemsOf(b.id);
        P.paper(ctx, W, H, { side: 'L', head: hd });
        var y = P.text(ctx, b.format + ' · ' + b.dewey, M, 250, { font: F.ui, size: 16, color: K.gold, spacing: '.22em', upper: true, weight: 500 });
        y = P.text(ctx, b.title, M, y + 78, { font: F.display, size: 64, color: K.ink, weight: 500, maxW: W - 2 * M, lh: 66 });
        y = P.text(ctx, b.author, M, y + 14, { font: F.ui, size: 24, color: K.ink, maxW: W - 2 * M });
        y = P.text(ctx, b.publisher + ', ' + b.year, M, y + 8, { font: F.ui, size: 18, color: K.soft, maxW: W - 2 * M });
        y = P.text(ctx, b.summary, M, y + 48, { font: F.display, size: 29, italic: true, color: K.ink, maxW: W - 2 * M, lh: 37 });
        y += 30;
        var label = av.available ? av.available + ' of ' + av.total + ' on the shelf' : 'all ' + av.total + ' on loan';
        var wpill = ctx.measureText(label).width;
        P.pill(ctx, label, M, y + 22, av.available ? 'ok' : 'warn');
        if (av.queue) P.pill(ctx, av.queue + ' waiting', M + wpill + 60, y + 22, 'gold');
        var shelves = unique(items.map(function (i) { return E.branch(i.branch).name + ' · ' + i.shelf; }));
        y = P.text(ctx, shelves.join('\n'), M, y + 72, { font: F.ui, size: 17, color: K.soft, maxW: W - 2 * M, lh: 24 });
        var hot = [];
        hot.push(hotRect(P.button(ctx, av.available ? 'Reserve this copy' : 'Place a hold', M, y + 40, W - 2 * M, true), { type: 'reserve', bib: b }));
        P.text(ctx, 'This writes a real hold into the demo database — it is on the pull list in the staff client a moment later.',
          M, y + 140, { font: F.ui, size: 16, color: K.soft, maxW: W - 2 * M, lh: 22 });
        hot.push(hotRect(P.button(ctx, 'Put it back', M, y + 200, W - 2 * M, false), { type: 'close' }));
        return hot;
      } },
      { film: filmSlug, filmRect: { x: 0.10, y: 0.09, w: 0.80 }, pop: true, draw: function (ctx) {
        P.paper(ctx, W, H, { side: 'R', head: hd });
        plinth(ctx, 600);
        P.text(ctx, col.n + ' · ' + col.name, M, 900, { font: F.mono, size: 22, color: K.gold, spacing: '.24em' });
        var y = P.text(ctx, 'Open it, and the hall stands up.', M, 980, { font: F.display, size: 58, color: K.ink, weight: 500, maxW: W - 2 * M, lh: 60 });
        P.text(ctx, 'The film moves when you scroll. Click what is in it.', M, y + 8, { font: F.ui, size: 18, color: K.gold, maxW: W - 2 * M });
        var x = M; y += 50;
        (b.subjects || []).slice(0, 8).forEach(function (s) {
          ctx.font = '500 18px ' + F.ui;
          var w = ctx.measureText(s).width + 30;
          if (x + w > W - M) { x = M; y += 46; }
          P.pill(ctx, s, x, y, 'gold');
          x += w + 12;
        });
        return [];
      } }
    ];
  }

  LS.BookFaces = { collection: collection, aurelia: aurelia, bib: bib, MODULES: MODULES, STANDARDS: STANDARDS };
})(window);
