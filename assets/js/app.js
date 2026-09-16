/* ============================================================
   app.js — the staff client shell.
   Navigation, routing, the demo clock, the live activity rail,
   and the command palette. Individual modules live in views-*.js
   and register themselves on LS.views.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine, UI = LS.UI;
  var el = U.el;

  var App = { current: null, mode: 'staff' };
  LS.App = App;
  LS.views = LS.views || {};

  /* ============================================================
     navigation
     ============================================================ */

  var NAV = [
    { group: 'Service desk', items: [
      { key: 'overview',     label: 'Overview',        icon: '◈' },
      { key: 'circulation',  label: 'Circulation',     icon: '⇄', badge: 'dueToday' },
      { key: 'holds',        label: 'Holds & transit', icon: '◆', badge: 'holdsWork' },
      { key: 'fines',        label: 'Fines & fees',    icon: '⊙', badge: 'finesCount' }
    ]},
    { group: 'Collection', items: [
      { key: 'catalog',      label: 'Cataloguing',     icon: '▤' },
      { key: 'acquisitions', label: 'Acquisitions',    icon: '▣', badge: 'openOrders' },
      { key: 'serials',      label: 'Serials',         icon: '≣', badge: 'lateIssues' },
      { key: 'ill',          label: 'Interlibrary',    icon: '⇌' }
    ]},
    { group: 'People', items: [
      { key: 'patrons',      label: 'Membership',      icon: '◍' }
    ]},
    { group: 'System', items: [
      { key: 'reports',      label: 'Reports',         icon: '◫' },
      { key: 'notices',      label: 'Notices & jobs',  icon: '✉' },
      { key: 'admin',        label: 'Administration',  icon: '⚙' }
    ]}
  ];

  function badgeValue(key) {
    var s = E.db().stats || E.stats();
    if (key === 'holdsWork') return s.holdsReady + s.pullList + s.inTransit;
    if (key === 'dueToday')  return s.overdue;
    return s[key] || 0;
  }

  /* ============================================================
     boot
     ============================================================ */

  App.boot = function () {
    E.init();
    buildShell();
    route();
    global.addEventListener('hashchange', route);
    bindShortcuts();

    /* One signal, every panel: any engine write re-renders the shell
       chrome and the open view — that is the "integrated" bit. */
    var repaint = U.debounce(function () {
      paintBadges();
      paintClock();
      if (App.current && LS.views[App.current]) renderView(App.current, true);
    }, 90);
    LS.bus.on('db:change', repaint);
    LS.bus.on('audit', pushActivity);

    if (global.Motion) Motion.boot();

    setTimeout(function () {
      UI.toast({
        tone: 'gold',
        title: 'Demo dataset loaded',
        detail: E.db().bibs.length + ' titles · ' + E.db().items.length + ' copies · ' +
                E.db().patrons.length + ' members. Everything below is live and clickable.',
        duration: 7000
      });
    }, 900);
  };

  /* ============================================================
     shell
     ============================================================ */

  function buildShell() {
    var root = document.getElementById('app');
    root.innerHTML = '';

    /* ---- top bar ---- */
    var top = el('header.topbar', {}, [
      el('a.brand', { href: 'index.html', 'aria-label': 'Aurelia — home' }, [
        el('span.brand-mark', {}, [el('i'), el('i'), el('i')]),
        el('span.brand-text', {}, [
          el('b', { text: 'AURELIA' }),
          el('em', { text: 'Integrated Library System' })
        ])
      ]),

      el('div.topsearch', {}, [
        el('span.topsearch-ic', { text: '⌕' }),
        el('input#global-search.topsearch-input', {
          type: 'search',
          placeholder: 'Search titles, members, barcodes…  (press /)',
          'aria-label': 'Global search',
          oninput: U.debounce(function (e) { globalSearch(e.target.value); }, 200),
          onkeydown: function (e) { if (e.key === 'Escape') { e.target.value = ''; closePalette(); } }
        }),
        el('kbd.topsearch-kbd', { text: '/' })
      ]),

      el('div.topright', {}, [
        el('button#clock-chip.clockchip', {
          title: 'The demo clock. Jump forward to watch fines accrue and notices go out.',
          onclick: openClock
        }),
        el('div.modeswitch', { role: 'group', 'aria-label': 'Interface' }, [
          el('button.modebtn.is-active', { 'data-mode': 'staff',
            onclick: function () { setMode('staff'); } }, 'Staff'),
          el('button.modebtn', { 'data-mode': 'opac',
            onclick: function () { setMode('opac'); } }, 'Public')
        ]),
        el('button.operator', { onclick: openOperator }, [
          UI.avatar(E.operator.name),
          el('span.operator-text', {}, [
            el('b', { text: E.operator.name }),
            el('em', { text: E.operator.role })
          ]),
          el('span.operator-caret', { text: '▾' })
        ])
      ])
    ]);

    /* ---- left rail ---- */
    var rail = el('nav.rail', { 'aria-label': 'Modules' });
    NAV.forEach(function (g) {
      rail.appendChild(el('div.rail-group', { text: g.group }));
      g.items.forEach(function (it) {
        rail.appendChild(el('a.railitem', {
          href: '#/' + it.key, 'data-nav': it.key, 'data-ripple': ''
        }, [
          el('span.railitem-ic', { text: it.icon }),
          el('span.railitem-label', { text: it.label }),
          it.badge ? el('span.railitem-badge', { 'data-badge': it.badge }) : null
        ]));
      });
    });
    rail.appendChild(el('div.rail-foot', {}, [
      el('a.railitem.railitem-quiet', { href: '#/opac', 'data-nav': 'opac' }, [
        el('span.railitem-ic', { text: '⌕' }),
        el('span.railitem-label', { text: 'Public catalogue' })
      ]),
      el('button.railitem.railitem-quiet', { onclick: resetDemo }, [
        el('span.railitem-ic', { text: '↺' }),
        el('span.railitem-label', { text: 'Reset demo' })
      ])
    ]));

    /* ---- main + activity rail ---- */
    var main = el('main#view.view', { tabindex: '-1' });

    var feed = el('aside.feed', {}, [
      el('div.feed-head', {}, [
        el('span.panel-title', { text: 'Live activity' }),
        el('span.chip.chip-ok', {}, [el('span.dot.dot-pulse'), el('span', { text: 'Streaming' })])
      ]),
      el('p.feed-note', { text:
        'Every module writes to one database. Watch entries land here as you work — a single ' +
        'check-in touches the catalogue, the hold queue, the fine ledger and the statistics at once.' }),
      el('ul#feed-list.feed-list')
    ]);

    root.appendChild(top);
    root.appendChild(el('div.shell', {}, [rail, main, feed]));
    root.appendChild(el('button.feed-toggle', {
      'aria-label': 'Toggle activity rail',
      onclick: function () { document.body.classList.toggle('feed-hidden'); }
    }, '❯'));

    paintBadges();
    paintClock();
    E.db().audit.slice(0, 8).reverse().forEach(pushActivity);
  }

  function paintBadges() {
    U.$$('[data-badge]').forEach(function (n) {
      var v = badgeValue(n.getAttribute('data-badge'));
      n.textContent = v > 99 ? '99+' : v;
      n.classList.toggle('is-zero', !v);
    });
  }

  function paintClock() {
    var chip = document.getElementById('clock-chip');
    if (!chip) return;
    var off = LS.clock.offsetDays;
    chip.innerHTML = '';
    chip.appendChild(el('span.dot' + (off ? '.dot-pulse' : '')));
    chip.appendChild(el('span', { text: U.fmtDate(LS.clock.now()) }));
    if (off) chip.appendChild(el('b', { text: '+' + off + 'd' }));
    chip.classList.toggle('is-shifted', !!off);
  }

  /* ============================================================
     routing
     ============================================================ */

  function route() {
    var raw = (location.hash || '#/overview').replace(/^#\/?/, '');
    var parts = raw.split('?');
    var key = parts[0] || 'overview';
    if (parts[1]) {
      /* a deep link such as #/opac?collection=kids carries its own params */
      App.params = {};
      parts[1].split('&').forEach(function (kv) {
        var p = kv.split('=');
        if (p[0]) App.params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
    }
    if (!LS.views[key]) key = 'overview';
    setMode(key === 'opac' ? 'opac' : 'staff', true);
    renderView(key, false);
  }

  App.go = function (key, params) {
    App.params = params || null;
    if (('#/' + key) === location.hash) { renderView(key, false); return; }
    location.hash = '#/' + key;
  };

  function renderView(key, silent) {
    var mount = document.getElementById('view');
    if (!mount) return;

    /* keep scroll position on a silent (data-driven) repaint */
    var scrollY = silent ? mount.scrollTop : 0;
    App.current = key;

    U.$$('[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === key);
    });

    mount.innerHTML = '';
    mount.classList.remove('view-in');
    void mount.offsetWidth;
    if (!silent) mount.classList.add('view-in');

    try {
      LS.views[key](mount, App.params || {});
    } catch (err) {
      console.error(err);
      mount.appendChild(el('div.panel', {}, [
        el('div.panel-body', {}, [
          el('h3.h3', { text: 'This module failed to render' }),
          el('pre.mono.small.muted', { text: String(err && err.stack || err) })
        ])
      ]));
    }

    if (global.Motion) {
      Motion.scan(mount);
      if (!silent) Motion.enter(mount, '[data-enter]', 42);
    }
    U.$$('[data-count]', mount).forEach(function (n) { n.classList.remove('is-counted'); });
    if (global.Motion) Motion.counters(mount);
    mount.scrollTop = scrollY;
    if (!silent) mount.focus({ preventScroll: true });
  }
  App.render = renderView;
  App.refresh = function () { if (App.current) renderView(App.current, true); };

  /* ============================================================
     page header helper used by every view
     ============================================================ */

  App.header = function (opts) {
    return el('div.pagehead', { 'data-enter': '' }, [
      el('div.grow', {}, [
        el('div.eyebrow', { text: opts.eyebrow || '' }),
        el('h1.h1.pagehead-title', { text: opts.title }),
        opts.lede ? el('p.lede.pagehead-lede', { text: opts.lede }) : null
      ]),
      opts.actions ? el('div.row.wrapflex.pagehead-actions', {}, opts.actions) : null
    ]);
  };

  App.section = function (title, opts, children) {
    opts = opts || {};
    return el('section.panel' + (opts.class ? '.' + opts.class : ''), { 'data-enter': '' }, [
      el('div.panel-head', {}, [
        el('div.row', { style: { '--gap': '10px' } }, [
          el('span.panel-title', { text: title }),
          opts.count !== undefined ? el('span.chip', { text: String(opts.count) }) : null,
          opts.note ? el('span.tiny.faint', { text: opts.note }) : null
        ]),
        opts.actions ? el('div.row.wrapflex', { style: { '--gap': '8px' } }, opts.actions) : null
      ]),
      el('div.panel-body' + (opts.flush ? '.flush' : ''), {},
        Array.isArray(children) ? children : [children])
    ]);
  };

  /* ============================================================
     live activity rail
     ============================================================ */

  var TONE_MARK = { ok: '✓', warn: '!', danger: '✕', gold: '◆', info: '·' };

  function pushActivity(entry) {
    var list = document.getElementById('feed-list');
    if (!list) return;
    var li = el('li.feedrow.feedrow-' + (entry.tone || 'info'), {}, [
      el('span.feedrow-mark', { text: TONE_MARK[entry.tone] || '·' }),
      el('div.grow', {}, [
        el('div.feedrow-top', {}, [
          el('b', { text: entry.module }),
          el('span.tiny.faint', { text: U.fmtTime(new Date(entry.at)) })
        ]),
        el('div.feedrow-action', { text: entry.action }),
        el('div.feedrow-detail', { text: entry.detail })
      ])
    ]);
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 26) list.lastChild.remove();
    if (global.Motion) Motion.flash(li, entry.tone === 'danger' ? 'danger' :
      entry.tone === 'ok' ? 'ok' : 'gold');
  }

  /* ============================================================
     demo clock
     ============================================================ */

  function openClock() {
    var body = el('div.stack', { style: { '--gap': '18px' } }, [
      el('p.small.muted', { text:
        'Libraries run on elapsed time: fines accrue overnight, holds expire, notices go out ' +
        'at 02:00. Jump the clock forward and the nightly job runs once for every day skipped.' }),
      el('div.clockgrid', {}, [1, 3, 7, 14].map(function (n) {
        return el('button.clockbtn', { 'data-ripple': '', onclick: function () {
          var res = E.advanceDays(n);
          paintClock();
          UI.toast({
            tone: 'gold', duration: 8000,
            title: 'Clock advanced ' + n + ' day' + (n > 1 ? 's' : '') +
                   ' — nightly job ran ' + n + '×',
            detail: res.fines + ' fines accrued (' + U.money(res.fineTotal) + ') · ' +
                    (res.overdueNotices + res.dueSoon + res.holdReminders + res.membershipWarnings) +
                    ' notices sent · ' + res.expiredHolds + ' holds expired · ' +
                    res.claims + ' vendor/serial claims'
          });
          App.refresh();
        } }, [
          el('b', { text: '+' + n }),
          el('span', { text: n === 1 ? 'day' : 'days' })
        ]);
      })),
      el('div.hairline'),
      el('div.row-between', {}, [
        el('div', {}, [
          el('div.small', { text: 'Demo date' }),
          el('b.gold', { text: U.fmtDate(LS.clock.now()) })
        ]),
        el('button.btn.btn-sm.btn-ghost', { onclick: function () {
          LS.clock.reset(); paintClock(); E.recompute();
          UI.toast({ title: 'Clock reset to today', tone: 'info' });
        } }, 'Reset clock')
      ])
    ]);
    UI.modal({ eyebrow: 'Automation', title: 'Demo clock', size: 'sm', body: body,
               actions: [{ label: 'Done', primary: true }] });
  }

  /* ============================================================
     operator / roles
     ============================================================ */

  function openOperator() {
    var body = el('div.stack', { style: { '--gap': '16px' } }, [
      el('p.small.muted', { text:
        'Staff permissions are role-based — a student assistant may issue and return, but may ' +
        'not delete a bibliographic record or waive a charge. Switch role to see the difference.' }),
      el('div.rolelist', {}, E.ROLES.map(function (r) {
        return el('button.rolecard' + (r.name === E.operator.role ? '.is-active' : ''), {
          'data-ripple': '',
          onclick: function () {
            E.operator = { name: E.operator.name, role: r.name, branch: E.operator.branch, code: r.code };
            document.querySelector('.operator-text em').textContent = r.name;
            UI.toast({ title: 'Signed in as ' + r.name, tone: 'info',
              detail: r.can.indexOf('*') > -1 ? 'Full access to every module'
                    : 'Permitted: ' + r.can.join(', ') });
            E.log('Security', 'Role change', 'Operator now acting as ' + r.name, 'info');
          }
        }, [
          el('b', { text: r.name }),
          el('span.tiny.faint', { text: r.can.indexOf('*') > -1 ? 'All modules' : r.can.join(' · ') })
        ]);
      })),
      el('div.hairline'),
      el('div.field', {}, [
        el('span.label', { text: 'Acting at branch' }),
        el('select.select', { onchange: function (e) {
          E.operator.branch = e.target.value;
          UI.toast({ title: 'Now working at ' + E.branch(e.target.value).name, tone: 'info' });
          App.refresh();
        } }, E.db().branches.map(function (b) {
          return el('option', { value: b.code, selected: b.code === E.operator.branch }, b.name);
        }))
      ])
    ]);
    UI.modal({ eyebrow: 'Session', title: 'Operator & permissions', size: 'sm', body: body,
               actions: [{ label: 'Close', primary: true }] });
  }

  /* ============================================================
     mode switch — staff client vs public catalogue
     ============================================================ */

  function setMode(mode, quiet) {
    App.mode = mode;
    document.body.classList.toggle('mode-opac', mode === 'opac');
    U.$$('.modebtn').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-mode') === mode);
    });
    if (quiet) return;
    if (mode === 'opac') App.go('opac');
    else App.go('overview');
  }

  /* ============================================================
     global search / command palette
     ============================================================ */

  function closePalette() {
    var p = document.getElementById('palette');
    if (p) p.remove();
  }

  function globalSearch(q) {
    closePalette();
    if (!q || q.trim().length < 2) return;
    var db = E.db();
    var rows = [];

    E.search(q).slice(0, 5).forEach(function (r) {
      rows.push({ icon: '▤', kind: 'Title',
        title: r.bib.title, sub: r.bib.author + ' · ' + r.avail.available + ' of ' +
          r.avail.total + ' available',
        run: function () { App.go('catalog', { bibId: r.bib.id }); } });
    });

    db.patrons.filter(function (p) {
      return U.matches(p.name + ' ' + p.cardNo + ' ' + p.email + ' ' + p.id, q);
    }).slice(0, 4).forEach(function (p) {
      rows.push({ icon: '◍', kind: 'Member',
        title: p.name, sub: E.patronTypeName(p.type) + ' · card ' + p.cardNo,
        run: function () { App.go('patrons', { patronId: p.id }); } });
    });

    var it = db.items.find(function (i) { return i.barcode === q.trim(); });
    if (it) {
      rows.unshift({ icon: '⌗', kind: 'Barcode',
        title: E.bib(it.bibId).title, sub: 'Copy ' + it.barcode + ' · ' +
          UI.statusMeta(it.status).label,
        run: function () { App.go('circulation', { barcode: it.barcode }); } });
    }

    if (!rows.length) {
      rows.push({ icon: '∅', kind: '', title: 'Nothing matched “' + q + '”',
        sub: 'Try a title, an author, a member name, or a copy barcode', run: closePalette });
    }

    var box = el('div#palette.palette', {}, rows.map(function (r, i) {
      return el('button.palette-row', {
        style: { animationDelay: (i * 34) + 'ms' },
        onclick: function () { closePalette(); document.getElementById('global-search').value = ''; r.run(); }
      }, [
        el('span.palette-ic', { text: r.icon }),
        el('div.grow', {}, [
          el('div.palette-title', { text: r.title }),
          el('div.palette-sub', { text: r.sub })
        ]),
        r.kind ? el('span.chip', { text: r.kind }) : null
      ]);
    }));
    document.querySelector('.topsearch').appendChild(box);
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.topsearch')) closePalette();
  });

  /* ============================================================
     keyboard
     ============================================================ */

  function bindShortcuts() {
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        document.getElementById('global-search').focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search').focus();
      }
      if (e.key === 'Escape') closePalette();
      if (!typing && e.altKey) {
        var map = { '1': 'overview', '2': 'circulation', '3': 'holds', '4': 'catalog',
                    '5': 'patrons', '6': 'acquisitions', '7': 'reports' };
        if (map[e.key]) { e.preventDefault(); App.go(map[e.key]); }
      }
    });
  }

  /* ============================================================
     reset
     ============================================================ */

  function resetDemo() {
    UI.confirm({
      eyebrow: 'Demo',
      title: 'Reset the demo dataset?',
      message: 'Every loan, hold, fine, order and catalogue change you have made will be ' +
               'discarded and the opening dataset rebuilt.',
      confirmLabel: 'Reset everything',
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      E.reset();
      document.getElementById('feed-list').innerHTML = '';
      paintClock();
      App.refresh();
      UI.toast({ title: 'Demo reset', detail: 'Opening dataset rebuilt', tone: 'gold' });
    });
  }

  /* ============================================================
     shared row builders used across several views
     ============================================================ */

  App.bibRow = function (r, opts) {
    opts = opts || {};
    var b = r.bib, a = r.avail;
    return el('article.bibrow', { 'data-enter': '', 'data-ripple': '',
      tabindex: '0',
      onclick: function () { (opts.onOpen || function () {})(r); },
      onkeydown: function (e) { if (e.key === 'Enter') (opts.onOpen || function () {})(r); }
    }, [
      el('div.bibrow-spine', { 'data-fmt': b.format }),
      el('div.grow', {}, [
        el('div.bibrow-title', { text: b.title }),
        el('div.bibrow-meta', {}, [
          el('span', { text: b.author }),
          el('span.faint', { text: '·' }),
          el('span', { text: String(b.year) }),
          el('span.faint', { text: '·' }),
          el('span.mono', { text: b.dewey })
        ]),
        el('div.row.wrapflex.bibrow-chips', { style: { '--gap': '6px' } }, [
          el('span.chip' + (a.available ? '.chip-ok' : '.chip-warn'), {}, [
            el('span.dot'),
            el('span', { text: a.available ? a.available + ' of ' + a.total + ' on shelf'
                                           : 'All ' + a.total + ' copies out' })
          ]),
          a.queue ? el('span.chip.chip-gold', { text: a.queue + ' waiting' }) : null,
          a.inTransit ? el('span.chip.chip-info', { text: a.inTransit + ' in transit' }) : null,
          el('span.chip', { text: b.format })
        ])
      ]),
      el('span.bibrow-go', { text: '→' })
    ]);
  };

  App.patronChip = function (p) {
    var t = E.db().patronTypes.find(function (x) { return x.code === p.type; });
    return el('span.chip.chip-' + (t ? t.colour : ''), { text: t ? t.name : p.type });
  };

  global.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('app')) App.boot();
  });
})(window);
