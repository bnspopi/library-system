/* ============================================================
   views-collection.js — Cataloguing, Membership, Acquisitions,
   Serials, Interlibrary loan
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine, UI = LS.UI, App = LS.App;
  var el = U.el;

  var cat  = { q: '', filters: {}, sort: 'title' };
  var mem  = { q: '', type: '' };
  var acq  = { tab: 'orders' };
  var ser  = { open: null };

  /* ============================================================
     CATALOGUING
     ============================================================ */

  LS.views.catalog = function (mount, params) {
    if (params && params.create) { setTimeout(newTitleFlow, 120); params.create = false; }

    var results = E.search(cat.q, Object.assign({ sort: cat.sort }, cat.filters));
    var facets = E.facets(E.search(cat.q, { sort: cat.sort }));

    mount.appendChild(App.header({
      eyebrow: 'Module 6.1',
      title: 'Cataloguing',
      lede: 'Describe the work once as a bibliographic record, then attach as many item records ' +
            'as there are physical copies. Save it and it is searchable in the public catalogue ' +
            'and issuable at the desk in the same instant — there is no second entry.',
      actions: [
        el('button.btn', { 'data-ripple': '', onclick: marcImportFlow }, '⇣ Import MARC'),
        el('button.btn.btn-primary', { 'data-ripple': '', onclick: newTitleFlow },
           '＋ New bibliographic record')
      ]
    }));

    /* --- search + facets --- */
    mount.appendChild(el('div.catgrid', {}, [
      el('div.facets', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '14px' }, text: 'Refine' }),
        facetBlock('Collection', 'collection', E.db().collections.map(function (c) {
          var hit = facets.collection.find(function (f) { return f.key === c.key; });
          return { key: c.key, n: hit ? hit.n : 0, label: c.name }; })),
        facetBlock('Format', 'format', facets.format),
        facetBlock('Branch', 'branch', facets.branch.map(function (f) {
          return { key: f.key, n: f.n, label: E.branch(f.key).name }; })),
        facetBlock('Subject', 'subject', facets.subject),
        facetBlock('Decade', 'decade', facets.decade.map(function (f) {
          return { key: f.key, n: f.n, label: f.key + 's' }; })),
        el('div.hairline', { style: { margin: '16px 0' } }),
        el('label.check', {}, [
          el('input', { type: 'checkbox', checked: !!cat.filters.availableNow,
            onchange: function (e) {
              cat.filters.availableNow = e.target.checked || undefined;
              App.render('catalog', false);
            } }),
          el('span', { text: 'Available on the shelf now' })
        ]),
        Object.keys(cat.filters).length ? el('button.btn.btn-sm.btn-ghost.btn-block', {
          style: { marginTop: '14px' },
          onclick: function () { cat.filters = {}; App.render('catalog', false); }
        }, 'Clear all filters') : null
      ]),

      el('div.stack', { style: { '--gap': '18px' } }, [
        el('div.searchbar', { 'data-enter': '' }, [
          el('span.searchbar-ic', { text: '⌕' }),
          el('input.input.searchbar-input', {
            value: cat.q,
            placeholder: 'Keyword, or a qualified search — title: / author: / isbn: / subject: / callno: / barcode:',
            oninput: U.debounce(function (e) { cat.q = e.target.value; App.render('catalog', true); }, 260)
          }),
          el('select.select.searchbar-sort', { onchange: function (e) {
            cat.sort = e.target.value; App.render('catalog', false);
          } }, [
            { v: 'title', l: 'Sort: title' }, { v: 'author', l: 'Sort: author' },
            { v: 'year', l: 'Sort: newest' }, { v: 'popular', l: 'Sort: most borrowed' }
          ].map(function (o) {
            return el('option', { value: o.v, selected: cat.sort === o.v }, o.l);
          }))
        ]),

        el('div.row-between.wrapflex', {}, [
          el('span.small.muted', {}, [
            el('b.gold', { text: String(results.length) }),
            el('span', { text: ' title' + (results.length === 1 ? '' : 's') +
              (cat.q ? ' matching “' + cat.q + '”' : ' in the catalogue') })
          ]),
          el('div.row.wrapflex', { style: { '--gap': '6px' } },
            Object.keys(cat.filters).filter(function (k) { return k !== 'sort'; })
              .map(function (k) {
                return el('button.chip.chip-gold', { onclick: function () {
                  delete cat.filters[k]; App.render('catalog', false);
                } }, [el('span', { text: k + ': ' + cat.filters[k] }), el('span', { text: ' ×' })]);
              }))
        ]),

        results.length
          ? el('div.stack', { style: { '--gap': '0' }, 'data-reveal-group': '', 'data-stagger': '32' },
              results.map(function (r) {
                return App.bibRow(r, { onOpen: function () { openBib(r.bib.id); } });
              }))
          : UI.empty('Nothing matched. Try “india”, “author:sen”, or clear the filters.', '⌕')
      ])
    ]));

    if (params && params.bibId) { setTimeout(function () { openBib(params.bibId); }, 120); params.bibId = null; }

    function facetBlock(title, key, list) {
      if (!list.length) return null;
      return el('div.facet', {}, [
        el('div.facet-title', { text: title }),
        el('ul', {}, list.slice(0, key === 'collection' ? 12 : 6).map(function (f) {
          var active = String(cat.filters[key]) === String(f.key);
          return el('li', {}, el('button.facet-btn' + (active ? '.is-active' : ''), {
            onclick: function () {
              if (active) delete cat.filters[key]; else cat.filters[key] = f.key;
              App.render('catalog', false);
            }
          }, [
            el('span', { text: f.label || f.key }),
            el('b', { text: String(f.n) })
          ]));
        }))
      ]);
    }
  };

  /* ---------------- bibliographic record drawer ------------ */

  function openBib(bibId) {
    var b = E.bib(bibId);
    if (!b) return;
    var items = E.itemsOf(bibId);
    var a = E.availability(bibId);
    var queue = E.db().holds.filter(function (h) {
      return h.bibId === bibId && (h.status === 'waiting' || h.status === 'ready'); });

    var body = el('div.stack', { style: { '--gap': '20px' } }, [
      el('div.row.wrapflex', { style: { '--gap': '7px' }, 'data-enter': '' }, [
        el('span.chip' + (a.available ? '.chip-ok' : '.chip-warn'), {
          text: a.available + ' of ' + a.total + ' on the shelf' }),
        queue.length ? el('span.chip.chip-gold', { text: queue.length + ' waiting' }) : null,
        el('span.chip', { text: b.format }),
        el('span.chip.mono', { text: b.id })
      ]),

      el('p.small.muted', { 'data-enter': '', text: b.summary }),

      el('div', { 'data-enter': '' }, UI.kv([
        ['Author', b.author],
        ['Publisher', b.publisher + ' · ' + b.year],
        ['ISBN / ISSN', b.isbn || '—'],
        ['Language', b.lang],
        ['Classification', b.dewey],
        ['Subjects', el('div.row.wrapflex', { style: { '--gap': '6px' } },
          b.subjects.map(function (s) {
            return el('button.chip', { onclick: function () {
              cat.filters.subject = s; App.render('catalog', false);
              if (LS.UI && document.querySelector('.drawer-scrim')) {
                document.querySelector('.drawer-scrim').click();
              }
            }, text: s });
          }))],
        ['Record source', b.source],
        ['Created', U.fmtDate(b.created)]
      ])),

      b.eresource ? el('div.licensebox', { 'data-enter': '' }, [
        el('div.panel-title', { text: 'Licence terms' }),
        UI.kv([
          ['Platform', b.eresource.platform],
          ['Simultaneous users', String(b.eresource.simultaneous)],
          ['Walk-in access', b.eresource.walkIn ? 'Permitted' : 'Not permitted'],
          ['Interlibrary loan', b.eresource.illAllowed ? 'Permitted' : 'Not permitted'],
          ['Licence ends', U.fmtDate(b.eresource.licenseEnds)]
        ])
      ]) : null,

      el('div', { 'data-enter': '' }, [
        el('div.row-between', { style: { marginBottom: '10px' } }, [
          el('span.panel-title', { text: 'Item records — ' + items.length + ' cop' +
            (items.length === 1 ? 'y' : 'ies') }),
          el('button.btn.btn-sm', { onclick: function () { addCopyFlow(bibId); } }, '＋ Add a copy')
        ]),
        el('table.tbl.tbl-tight', {}, [
          el('thead', {}, el('tr', {}, ['Barcode', 'Branch', 'Call number', 'Type', 'Status', 'Circs', '']
            .map(function (h) { return el('th', { text: h }); }))),
          el('tbody', {}, items.map(function (i) {
            var lo = E.loanForBarcode(i.barcode);
            return el('tr', {}, [
              el('td.mono.tiny', { text: i.barcode }),
              el('td.tiny', { text: i.branch }),
              el('td.tiny.mono', { text: i.callNo }),
              el('td.tiny', { text: E.itemTypeName(i.type) }),
              el('td', {}, el('div.stack', { style: { '--gap': '3px' } }, [
                UI.statusChip(i.status),
                lo ? el('span.tiny.faint', { text: 'to ' + E.patron(lo.patronId).name +
                  ', due ' + U.fmtDateShort(lo.due) }) : null
              ])),
              el('td.num.tiny', { text: String(i.circCount) }),
              el('td.num', {}, el('button.icon-btn', { title: 'Change status', text: '⋯',
                onclick: function () { statusFlow(i); } }))
            ]);
          }))
        ])
      ]),

      queue.length ? el('div', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '10px' }, text: 'Hold queue' }),
        el('ol.queue', {}, queue.sort(U.by('placed')).map(function (h, i) {
          var p = E.patron(h.patronId);
          return el('li.queueitem' + (h.status === 'ready' ? '.is-ready' : ''), {}, [
            el('span.queuepos', { text: String(i + 1) }),
            el('div.grow', {}, [
              el('div.small', { text: p.name }),
              el('div.tiny.faint', { text: 'Pickup at ' + E.branch(h.pickupBranch).name })
            ]),
            el('span.chip' + (h.status === 'ready' ? '.chip-gold' : ''), {
              text: h.status === 'ready' ? 'On the shelf' : 'Waiting' })
          ]);
        }))
      ]) : null,

      el('details.marcbox', { 'data-enter': '' }, [
        el('summary', { text: 'View as MARC21' }),
        el('pre.marc', { text: toMarc(b, items) })
      ])
    ]);

    UI.drawer({
      eyebrow: 'Bibliographic record',
      title: b.title,
      subtitle: b.author + ' · ' + b.publisher + ', ' + b.year,
      body: body,
      actions: [
        { label: '＋ Add a copy', run: function () { addCopyFlow(bibId); } },
        a.available ? { label: 'Issue a copy', primary: true, run: function () {
          var copy = items.find(function (i) { return i.status === 'available'; });
          LS.desk.circ.tab = 'issue';
          App.go('circulation');
          setTimeout(function () {
            if (!LS.desk.circ.patronId) {
              UI.toast({ title: 'Pick a member first', tone: 'warn',
                detail: 'Copy ' + copy.barcode + ' is ready to issue once a card is scanned.' });
            } else LS.desk.doIssue(copy.barcode);
          }, 280);
        } } : null,
        { label: 'Place a hold', run: function () { holdFlow(bibId); } }
      ]
    });
  }

  function toMarc(b, items) {
    var lines = [
      'LDR  00000nam a2200000 i 4500',
      '001  ' + b.id,
      '005  ' + U.iso(b.created).replace(/-/g, '') + '000000.0',
      '020  $a' + (b.isbn || '[none]'),
      '040  $aAURELIA $beng $erda $cAURELIA',
      '041 0$a' + (b.lang === 'English' ? 'eng' : 'mul'),
      '082 04$a' + b.dewey.split(' ')[0] + ' $223',
      '100 1 $a' + b.author + '.',
      '245 10$a' + b.title + ' / $c' + b.author + '.',
      '264  1$a' + (b.publisher || '[s.n.]') + ', $c' + b.year + '.',
      '300  $a' + items.length + ' cop' + (items.length === 1 ? 'y' : 'ies') + ' ; $c22 cm.',
      '336  $atext $btxt $2rdacontent',
      '338  $avolume $bnc $2rdacarrier',
      '520  $a' + (b.summary || '').slice(0, 180)
    ];
    b.subjects.forEach(function (s) { lines.push('650  0$a' + s + '.'); });
    items.forEach(function (i) {
      lines.push('952  $p' + i.barcode + ' $a' + i.branch + ' $o' + i.callNo +
                 ' $y' + i.type + ' $7' + i.status);
    });
    return lines.join('\n');
  }

  function newTitleFlow() {
    UI.form({
      eyebrow: 'Original cataloguing',
      title: 'New bibliographic record',
      intro: 'This describes the work. Copies are attached afterwards as item records — one ' +
             'bibliographic record can carry a hundred copies across every branch.',
      size: 'lg',
      submitLabel: 'Create record',
      fields: [
        { name: 'title', label: 'Title', required: true, placeholder: 'e.g. The Anarchy' },
        { name: 'author', label: 'Author (surname, forename)', placeholder: 'Dalrymple, William' },
        { name: 'isbn', label: 'ISBN', placeholder: '9781635573954' },
        { name: 'publisher', label: 'Publisher', placeholder: 'Bloomsbury' },
        { name: 'year', label: 'Year', type: 'number', value: new Date().getFullYear() },
        { name: 'dewey', label: 'Call number', placeholder: '954.029 DAL' },
        { name: 'format', label: 'Format', type: 'select',
          options: ['Book', 'DVD', 'E-book', 'Bound serial', 'Equipment'] },
        { name: 'lang', label: 'Language', value: 'English' },
        { name: 'subjects', label: 'Subject headings (comma separated)',
          placeholder: 'India — History, East India Company' },
        { name: 'summary', label: 'Summary', type: 'textarea' }
      ]
    }).then(function (d) {
      if (!d || !d.title) return;
      var res = E.createBib(d);
      UI.result(res, 'gold');
      UI.confirm({
        eyebrow: 'Next step',
        title: 'Attach a copy now?',
        message: 'A bibliographic record with no item records is searchable but nothing can be ' +
                 'issued against it.',
        confirmLabel: 'Add a copy'
      }).then(function (yes) { if (yes) addCopyFlow(res.bib.id); });
    });
  }

  function marcImportFlow() {
    UI.form({
      eyebrow: 'Z39.50 / SRU',
      title: 'Import a MARC record',
      intro: 'Cataloguers rarely type from scratch — they search a union catalogue and overlay ' +
             'the record. Try 9789353452940, 9780143127741 or 9780062457738.',
      submitLabel: 'Search union catalogue',
      fields: [{ name: 'isbn', label: 'ISBN', value: '9789353452940' }]
    }).then(function (d) {
      if (!d) return;
      var res = E.importMarc(d.isbn);
      if (!res.ok) { UI.toast({ title: res.msg, tone: 'danger' }); return; }
      var rec = res.record;
      UI.modal({
        eyebrow: 'Record retrieved · ' + rec.source,
        title: rec.title,
        size: 'md',
        body: el('div.stack', { style: { '--gap': '16px' } }, [
          el('p.small.muted', { text: 'Fourteen fields mapped from ISO 2709. Accept it and the ' +
            'record enters the catalogue exactly as if you had typed it.' }),
          UI.kv([
            ['Author', rec.author], ['Publisher', rec.publisher + ' · ' + rec.year],
            ['Classification', rec.dewey], ['Subjects', rec.subjects], ['Summary', rec.summary]
          ])
        ]),
        actions: [
          { label: 'Discard', ghost: true },
          { label: 'Accept & save', primary: true, run: function () {
            var out = E.createBib(rec);
            UI.result(out, 'gold');
            setTimeout(function () { addCopyFlow(out.bib.id); }, 320);
          } }
        ]
      });
    });
  }

  function addCopyFlow(bibId) {
    var b = E.bib(bibId);
    UI.form({
      eyebrow: 'Item record',
      title: 'Attach a copy to “' + b.title + '”',
      intro: 'The item record is what circulation actually issues. Its type and branch decide ' +
             'which policy row applies.',
      submitLabel: 'Attach copy',
      fields: [
        { name: 'branch', label: 'Branch', type: 'select',
          options: E.db().branches.map(function (x) { return { value: x.code, label: x.name }; }) },
        { name: 'type', label: 'Item type', type: 'select',
          options: E.db().itemTypes.map(function (x) { return { value: x.code, label: x.name }; }) },
        { name: 'callNo', label: 'Call number', value: b.dewey },
        { name: 'price', label: 'Replacement price (₹)', type: 'number', value: '850' },
        { name: 'shelf', label: 'Shelf location', value: 'Level 1 — Open stacks' },
        { name: 'status', label: 'Initial status', type: 'select',
          options: [{ value: 'available', label: 'Available' },
                    { value: 'in-process', label: 'In process' }] }
      ]
    }).then(function (d) {
      if (!d) return;
      UI.result(E.addItem(bibId, d), 'gold');
    });
  }

  function statusFlow(it) {
    UI.form({
      eyebrow: 'Copy ' + it.barcode,
      title: 'Change item status',
      intro: 'Status is what the public catalogue shows. Getting it wrong sends people to an ' +
             'empty shelf — which is the single most common complaint about any library system.',
      submitLabel: 'Apply',
      fields: [
        { name: 'status', label: 'Status', type: 'select', value: it.status,
          options: ['available', 'in-process', 'reference', 'damaged', 'lost', 'withdrawn'] },
        { name: 'note', label: 'Note', value: it.note, placeholder: 'Optional' }
      ]
    }).then(function (d) {
      if (!d) return;
      UI.result(E.setItemStatus(it.barcode, d.status, d.note), 'info');
    });
  }

  function holdFlow(bibId) {
    UI.form({
      eyebrow: 'Reservation',
      title: 'Place a hold',
      intro: 'Holds are title-level: whichever copy comes back first is trapped for the person ' +
             'at the front of the queue.',
      submitLabel: 'Place hold',
      fields: [
        { name: 'patronId', label: 'Member', type: 'select',
          options: E.db().patrons.map(function (p) {
            return { value: p.id, label: p.name + ' — ' + E.patronTypeName(p.type) }; }) },
        { name: 'pickup', label: 'Pickup branch', type: 'select',
          options: E.db().branches.map(function (x) { return { value: x.code, label: x.name }; }) }
      ]
    }).then(function (d) {
      if (!d) return;
      UI.result(E.placeHold(d.patronId, bibId, d.pickup, { channel: 'desk' }), 'gold');
    });
  }

  /* ============================================================
     MEMBERSHIP
     ============================================================ */

  LS.views.patrons = function (mount, params) {
    if (params && params.register) { setTimeout(registerFlow, 120); params.register = false; }

    var db = E.db();
    var list = db.patrons.filter(function (p) {
      return U.matches(p.name + ' ' + p.cardNo + ' ' + p.email + ' ' + p.id, mem.q) &&
             (!mem.type || p.type === mem.type);
    });

    mount.appendChild(App.header({
      eyebrow: 'Module 6.6',
      title: 'Membership',
      lede: 'The member category is not decoration — it is the row the policy matrix looks up. ' +
            'Change someone from undergraduate to faculty and every future due date, loan limit ' +
            'and fine rate changes with it.',
      actions: [
        el('button.btn', { onclick: function () { App.go('admin'); } }, '⚙ Policy matrix'),
        el('button.btn.btn-primary', { 'data-ripple': '', onclick: registerFlow }, '＋ Register a member')
      ]
    }));

    mount.appendChild(el('div.row.wrapflex', { 'data-enter': '', style: { '--gap': '10px' } }, [
      el('div.searchbar.grow', {}, [
        el('span.searchbar-ic', { text: '⌕' }),
        el('input.input.searchbar-input', { value: mem.q,
          placeholder: 'Name, card number or email…',
          oninput: U.debounce(function (e) { mem.q = e.target.value; App.render('patrons', true); }, 220) })
      ]),
      el('select.select', { style: { maxWidth: '220px' }, onchange: function (e) {
        mem.type = e.target.value; App.render('patrons', false);
      } }, [el('option', { value: '' }, 'All categories')].concat(
        db.patronTypes.map(function (t) {
          return el('option', { value: t.code, selected: mem.type === t.code }, t.name); })))
    ]));

    mount.appendChild(App.section('Members', { count: list.length, flush: true },
      list.length ? el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Member', 'Category', 'Card', 'Branch', 'Expires',
          'On loan', 'Owes', ''].map(function (h) { return el('th', { text: h }); }))),
        el('tbody', {}, list.map(function (p) {
          var st = E.patronState(p.id);
          return el('tr', { 'data-enter': '', style: { cursor: 'pointer' },
            onclick: function () { openPatron(p.id); } }, [
            el('td', {}, el('div.row', { style: { '--gap': '10px' } }, [
              UI.avatar(p.name, 'sm'),
              el('div', {}, [
                el('div.small', { text: p.name }),
                el('div.tiny.faint', { text: p.email })
              ])
            ])),
            el('td', {}, App.patronChip(p)),
            el('td.mono.tiny', { text: p.cardNo }),
            el('td.tiny', { text: p.branch }),
            el('td', {}, st.expired
              ? el('span.chip.chip-danger', { text: 'Expired ' + U.fmtDateShort(p.expires) })
              : el('span.tiny.muted', { text: U.fmtDate(p.expires) })),
            el('td.num.tabnum', { text: String(st.loans.length) +
              (st.overdue.length ? ' (' + st.overdue.length + ' late)' : '') }),
            el('td.num', {}, st.outstanding
              ? el('b.tiny', { class: st.blocked ? 'danger-text' : '', text: U.money(st.outstanding) })
              : el('span.tiny.faint', { text: '—' })),
            el('td.num', {}, st.blocked
              ? el('span.chip.chip-danger', {}, [el('span.dot.dot-pulse')])
              : el('span.chip.chip-ok', {}, [el('span.dot')]))
          ]);
        }))
      ]) : UI.empty('No member matched', '◍')));

    if (params && params.patronId) {
      setTimeout(function () { openPatron(params.patronId); }, 120);
      params.patronId = null;
    }
  };

  function openPatron(id) {
    var st = E.patronState(id);
    if (!st) return;
    var p = st.patron;
    var history = E.loansOf(id, true).filter(function (l) { return l.in; })
      .sort(U.by('in', 'desc')).slice(0, 8);

    var body = el('div.stack', { style: { '--gap': '20px' } }, [
      el('div.standing-stats', { 'data-enter': '' }, [
        el('div.standstat', {}, [el('b', { text: String(st.loans.length) }),
          el('span', { text: 'on loan' })]),
        el('div.standstat' + (st.overdue.length ? '.tone-danger' : ''), {},
          [el('b', { text: String(st.overdue.length) }), el('span', { text: 'overdue' })]),
        el('div.standstat', {}, [el('b', { text: String(st.holds.length) }),
          el('span', { text: 'holds' })]),
        el('div.standstat' + (st.outstanding ? '.tone-warn' : ''), {},
          [el('b', { text: U.money(st.outstanding) }), el('span', { text: 'owed' })])
      ]),

      st.blocks.length ? el('div.blocklist', { 'data-enter': '' }, st.blocks.map(function (b) {
        return el('div.blockrow', {}, [
          el('span.blockrow-ic', { text: '⚠' }),
          el('div.grow', {}, [el('b.small', { text: b.label }),
            el('div.tiny.faint', { text: 'Code ' + b.code })])
        ]);
      })) : null,

      el('div', { 'data-enter': '' }, UI.kv([
        ['Category', E.patronTypeName(p.type)],
        ['Card number', p.cardNo],
        ['Home branch', E.branch(p.branch).name],
        ['Email', p.email], ['Phone', p.phone],
        ['Guarantor', p.guarantor],
        ['Registered', U.fmtDate(p.registered)],
        ['Expires', U.fmtDate(p.expires) + ' (' + U.relDays(p.expires) + ')'],
        ['Reading history', p.historyOptIn
          ? 'Retained — the member opted in'
          : 'Not retained — privacy setting']
      ])),

      el('div', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '10px' }, text: 'Current loans' }),
        st.loans.length ? el('div.stack', { style: { '--gap': '0' } },
          st.loans.sort(U.by('due')).map(function (l) {
            var b = E.bib(l.bibId), it = E.item(l.barcode);
            var pol = E.policyFor(p.type, it.type);
            return el('div.listrow', {}, [
              el('div.grow', {}, [
                el('div.listrow-title', { text: b.title }),
                el('div.listrow-sub', { text: 'Copy ' + l.barcode + ' · out ' +
                  U.fmtDateShort(l.out) + ' · renewal ' + l.renewals + ' of ' + pol.renewals })
              ]),
              UI.dueChip(l.due),
              el('button.btn.btn-sm', { disabled: l.renewals >= pol.renewals,
                onclick: function (e) { e.stopPropagation(); UI.result(E.renew(l.id), 'ok'); }
              }, 'Renew'),
              el('button.btn.btn-sm.btn-ghost', { onclick: function (e) {
                e.stopPropagation(); UI.result(E.checkin(l.barcode), 'ok');
              } }, 'Return')
            ]);
          })) : UI.empty('Nothing on loan', '◎')
      ]),

      st.holds.length ? el('div', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '10px' }, text: 'Holds' }),
        el('div.stack', { style: { '--gap': '0' } }, st.holds.map(function (h) {
          var b = E.bib(h.bibId);
          return el('div.listrow', {}, [
            el('div.grow', {}, [
              el('div.listrow-title', { text: b.title }),
              el('div.listrow-sub', { text: h.status === 'ready'
                ? 'Ready at ' + E.branch(h.pickupBranch).name + ' until ' + U.fmtDate(h.expires)
                : 'Position ' + E.holdPosition(h.id) + ' in the queue' })
            ]),
            el('span.chip' + (h.status === 'ready' ? '.chip-gold' : ''), {
              text: h.status === 'ready' ? 'Ready' : 'Waiting' }),
            el('button.icon-btn', { text: '×', title: 'Cancel hold', onclick: function () {
              UI.result(E.cancelHold(h.id, 'Cancelled by member'), 'warn'); } })
          ]);
        }))
      ]) : null,

      st.fines.length ? el('div', { 'data-enter': '' }, [
        el('div.row-between', { style: { marginBottom: '10px' } }, [
          el('span.panel-title', { text: 'Charges' }),
          el('button.btn.btn-sm.btn-primary', { onclick: function () {
            UI.result(E.payAll(p.id, 'card'), 'ok'); } }, 'Settle ' + U.money(st.outstanding))
        ]),
        el('div.stack', { style: { '--gap': '0' } }, st.fines.map(function (f) {
          return el('div.listrow', {}, [
            el('div.grow', {}, [
              el('div.listrow-title', { text: f.description }),
              el('div.listrow-sub', { text: f.type + ' · raised ' + U.fmtDate(f.created) })
            ]),
            el('b.tiny', { text: U.money(f.amount - f.paidAmount) }),
            el('button.btn.btn-sm', { onclick: function () {
              UI.result(E.payFine(f.id, undefined, 'cash'), 'ok'); } }, 'Pay')
          ]);
        }))
      ]) : null,

      el('div', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '10px' }, text: 'Reading history' }),
        p.historyOptIn
          ? (history.length ? el('ul.historylist', {}, history.map(function (l) {
              var b = E.bib(l.bibId);
              return el('li', {}, [
                el('span.small', { text: b ? b.title : '—' }),
                el('span.tiny.faint', { text: U.fmtDate(l.in) })
              ]);
            })) : UI.empty('No completed loans yet', '◎'))
          : el('div.privacybox', {}, [
              el('b.small', { text: 'History is not retained for this member.' }),
              el('p.tiny.faint', { text: 'Reading history is personal data. Where a member has ' +
                'not opted in, closed loans are anonymised and cannot be tied back to them.' })
            ])
      ])
    ]);

    UI.drawer({
      eyebrow: E.patronTypeName(p.type) + ' · card ' + p.cardNo,
      title: p.name,
      subtitle: E.branch(p.branch).name + ' · member since ' + U.fmtDate(p.registered),
      body: body,
      actions: [
        { label: 'Issue to this member', primary: true, run: function () {
          LS.desk.circ.patronId = p.id; LS.desk.circ.tab = 'issue'; LS.desk.circ.last = null;
          App.go('circulation');
        } },
        { label: 'Renew 12 months', run: function () {
          UI.result(E.renewMembership(p.id, 12), 'ok'); } },
        { label: p.manualBlock ? 'Clear block' : 'Apply block', danger: !p.manualBlock,
          run: function () {
            if (p.manualBlock) { UI.result(E.setBlock(p.id, null), 'ok'); return; }
            UI.form({ eyebrow: 'Block', title: 'Block this member', submitLabel: 'Apply block',
              fields: [{ name: 'reason', label: 'Reason', type: 'select',
                options: ['Card reported stolen', 'Behaviour — under review',
                          'Billed for a lost item', 'Address unverified'] }]
            }).then(function (d) { if (d) UI.result(E.setBlock(p.id, d.reason), 'danger'); });
          } },
        { label: 'Purge history', run: function () {
          UI.confirm({ eyebrow: 'Privacy', title: 'Anonymise closed loans?',
            message: 'Completed loans are unlinked from this member permanently. Open loans are ' +
                     'untouched — the library still needs to know who has what.',
            confirmLabel: 'Anonymise', danger: true }).then(function (yes) {
            if (yes) UI.result(E.anonymiseHistory(p.id), 'info');
          });
        } }
      ]
    });
  }

  function registerFlow() {
    UI.form({
      eyebrow: 'Module 6.6',
      title: 'Register a member',
      intro: 'The category chosen here drives loan length, loan limit, renewal cap and fine rate ' +
             'for everything this person ever borrows.',
      size: 'lg',
      submitLabel: 'Register & issue card',
      fields: [
        { name: 'name', label: 'Full name', required: true, placeholder: 'e.g. Priya Sharma' },
        { name: 'type', label: 'Category', type: 'select',
          options: E.db().patronTypes.map(function (t) {
            return { value: t.code, label: t.name }; }) },
        { name: 'branch', label: 'Home branch', type: 'select',
          options: E.db().branches.map(function (b) { return { value: b.code, label: b.name }; }) },
        { name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
        { name: 'phone', label: 'Mobile', placeholder: '+91 …' },
        { name: 'guarantor', label: 'Guarantor (junior members)', placeholder: 'Parent or guardian' },
        { name: 'months', label: 'Membership length (months)', type: 'number', value: '12' },
        { name: 'historyOptIn', label: 'Member opts in to keeping a reading history',
          type: 'checkbox', value: true }
      ]
    }).then(function (d) {
      if (!d || !d.name) return;
      var res = E.registerPatron(d);
      UI.result(res, 'gold');
      setTimeout(function () { openPatron(res.patron.id); }, 500);
    });
  }

  /* ============================================================
     ACQUISITIONS
     ============================================================ */

  LS.views.acquisitions = function (mount) {
    var db = E.db();

    mount.appendChild(App.header({
      eyebrow: 'Module 6.2',
      title: 'Acquisitions',
      lede: 'Select, order, receive, invoice, accession. The moment an order is placed the money ' +
            'is encumbered against a fund — reserved but not yet spent — so the library cannot ' +
            'overspend a budget it has already committed.',
      actions: [
        el('button.btn.btn-primary', { 'data-ripple': '', onclick: orderFlow }, '＋ Raise an order')
      ]
    }));

    /* --- funds --- */
    mount.appendChild(App.section('Funds', { note: 'allocated · encumbered · spent' },
      el('div.fundgrid', { 'data-reveal-group': '', 'data-stagger': '70' },
        db.funds.map(function (f) {
          var free = f.allocated - f.encumbered - f.spent;
          return el('div.fundcard', { 'data-tilt': '', 'data-tilt-max': '5' }, [
            el('div.row-between', {}, [
              el('b.small', { text: f.name }),
              el('span.chip.mono.tiny', { text: f.code })
            ]),
            el('div.fundnum', {}, [
              el('b', { 'data-count': Math.round(free / 1000), 'data-prefix': '₹',
                'data-suffix': 'k' }, '₹0k'),
              el('span', { text: 'free of ' + U.money0(f.allocated) })
            ]),
            UI.meter([
              { label: 'Spent', value: f.spent, colour: 'var(--gold-deep)',
                display: U.money0(f.spent) },
              { label: 'Encumbered', value: f.encumbered, colour: 'var(--gold)',
                display: U.money0(f.encumbered) },
              { label: 'Free', value: Math.max(free, 0), colour: 'var(--surface-hi)',
                display: U.money0(free) }
            ], { total: f.allocated }),
            el('div.fundlegend', {}, [
              legend('var(--gold-deep)', 'Spent', U.money0(f.spent)),
              legend('var(--gold)', 'Encumbered', U.money0(f.encumbered)),
              legend('var(--surface-hi)', 'Free', U.money0(free))
            ])
          ]);
        }))));

    /* --- pipeline --- */
    var STAGES = [
      { key: 'suggested', label: 'Suggested', note: 'requested, not yet ordered' },
      { key: 'ordered',   label: 'On order',  note: 'money encumbered' },
      { key: 'claimed',   label: 'Claimed',   note: 'vendor is late' },
      { key: 'received',  label: 'Received',  note: 'awaiting invoice' },
      { key: 'invoiced',  label: 'Invoiced',  note: 'money spent' }
    ];

    mount.appendChild(App.section('Order pipeline', {
      count: db.orders.length,
      note: 'click any card to move it along'
    }, el('div.pipeline', { 'data-reveal-group': '', 'data-stagger': '80' },
      STAGES.map(function (stage) {
        var list = db.orders.filter(function (o) { return o.status === stage.key; });
        return el('div.pipecol', {}, [
          el('div.pipehead', {}, [
            el('b', { text: stage.label }),
            el('span.chip', { text: String(list.length) })
          ]),
          el('div.tiny.faint', { style: { marginBottom: '10px' }, text: stage.note }),
          el('div.stack', { style: { '--gap': '9px' } }, list.length ? list.map(function (o) {
            return el('button.ordercard', { 'data-ripple': '',
              onclick: function () { openOrder(o); } }, [
              el('b', { text: o.title }),
              el('span.tiny.faint', { text: o.author || o.vendor }),
              el('div.row-between', { style: { marginTop: '8px' } }, [
                el('span.chip.mono.tiny', { text: o.po }),
                el('b.tiny.gold', { text: U.money0(o.total) })
              ]),
              el('div.tiny.faint', { style: { marginTop: '5px' },
                text: o.qty + ' × ' + U.money0(o.unitPrice) + ' · ' + o.fund })
            ]);
          }) : [el('div.pipeempty', { text: '—' })])
        ]);
      }))));

    /* --- table --- */
    mount.appendChild(App.section('All orders', { flush: true },
      el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['PO', 'Title', 'Vendor', 'Fund', 'Qty', 'Value',
          'Status', 'Requested by', ''].map(function (h) { return el('th', { text: h }); }))),
        el('tbody', {}, db.orders.slice().sort(U.by('created', 'desc')).map(function (o) {
          return el('tr', { 'data-enter': '' }, [
            el('td.mono.tiny', { text: o.po }),
            el('td.small', { text: o.title }),
            el('td.tiny', { text: (db.vendors.find(function (v) {
              return v.code === o.vendor; }) || {}).name || o.vendor }),
            el('td.tiny.mono', { text: o.fund }),
            el('td.num.tiny', { text: String(o.qty) }),
            el('td.num.tiny', { text: U.money0(o.total) }),
            el('td', {}, el('span.chip.chip-' + orderTone(o.status), { text: o.status })),
            el('td.tiny.faint', { text: o.requestedBy }),
            el('td.num', {}, el('button.btn.btn-sm', {
              onclick: function () { openOrder(o); } }, 'Open'))
          ]);
        }))
      ])));

    function legend(colour, label, value) {
      return el('span.legenditem', {}, [
        el('i', { style: { background: colour } }),
        el('span', { text: label }),
        el('b', { text: value })
      ]);
    }
  };

  function orderTone(s) {
    return s === 'invoiced' ? 'ok' : s === 'received' ? 'info' :
           s === 'claimed' ? 'danger' : s === 'ordered' ? 'gold' : '';
  }

  function openOrder(o) {
    var v = E.db().vendors.find(function (x) { return x.code === o.vendor; });
    var f = E.fund(o.fund);
    var NEXT = { suggested: 'Place the order', ordered: 'Receive the shipment',
                 claimed: 'Receive the shipment', received: 'Post the invoice' };

    var steps = ['suggested', 'ordered', 'received', 'invoiced'];
    var at = steps.indexOf(o.status === 'claimed' ? 'ordered' : o.status);

    UI.drawer({
      eyebrow: o.po + ' · ' + (v ? v.name : o.vendor),
      title: o.title,
      subtitle: o.author ? o.author + ' · ' + o.qty + ' copies' : o.qty + ' units',
      body: el('div.stack', { style: { '--gap': '20px' } }, [
        el('ol.steps', { 'data-enter': '' }, steps.map(function (s, i) {
          return el('li.step' + (i < at ? '.is-done' : i === at ? '.is-now' : ''), {}, [
            el('span.step-dot', { text: i < at ? '✓' : String(i + 1) }),
            el('div', {}, [
              el('b', { text: U.titleCase(s) }),
              el('div.tiny.faint', { text: s === 'suggested' ? 'selection' :
                s === 'ordered' ? 'money encumbered' : s === 'received' ? 'copies checked in' :
                'money spent' })
            ])
          ]);
        })),
        el('div', { 'data-enter': '' }, UI.kv([
          ['Vendor', (v ? v.name + ' · ' + v.contact : o.vendor) +
            (v && v.edi ? ' · EDI' : ' · email')],
          ['Fund', f.name + ' (' + f.code + ')'],
          ['Free on fund', U.money0(f.allocated - f.encumbered - f.spent)],
          ['Quantity', o.qty + ' × ' + U.money0(o.unitPrice)],
          ['Order value', el('b.gold', { text: U.money0(o.total) })],
          ['Requested by', o.requestedBy],
          ['Created', U.fmtDate(o.created)],
          ['Ordered', o.ordered ? U.fmtDate(o.ordered) : null],
          ['Claimed', o.claimedOn ? U.fmtDate(o.claimedOn) + ' — vendor has not shipped' : null],
          ['Received', o.received ? U.fmtDate(o.received) : null],
          ['Invoice', o.invoiceNo ? o.invoiceNo + ' · ' + U.fmtDate(o.invoiced) : null],
          ['Accessioned', o.accessioned ? U.fmtDate(o.accessioned) + ' → ' + o.bibId : null]
        ])),
        o.status === 'claimed' ? el('div.warnbox', { 'data-enter': '' }, [
          el('b.small', { text: 'Vendor has not shipped.' }),
          el('p.tiny.faint', { text: 'The nightly job raised a claim automatically once the ' +
            'expected lead time plus fourteen days had passed.' })
        ]) : null
      ]),
      actions: [
        NEXT[o.status] ? { label: NEXT[o.status], primary: true, run: function () {
          UI.result(E.advanceOrder(o.id), 'gold');
        } } : null,
        (o.status === 'received' || o.status === 'invoiced') && !o.accessioned
          ? { label: 'Accession & catalogue', run: function () {
              UI.form({
                eyebrow: 'Accessioning', title: 'Catalogue this shipment',
                intro: 'Creates a bibliographic record and one item record per copy delivered, ' +
                       'and puts them on the shelf.',
                submitLabel: 'Accession ' + o.qty + ' copies',
                fields: [
                  { name: 'branch', label: 'Shelve at', type: 'select',
                    options: E.db().branches.map(function (b) {
                      return { value: b.code, label: b.name }; }) },
                  { name: 'type', label: 'Item type', type: 'select',
                    options: E.db().itemTypes.map(function (t) {
                      return { value: t.code, label: t.name }; }) },
                  { name: 'dewey', label: 'Call number', placeholder: 'e.g. 954.03 GUH' },
                  { name: 'subjects', label: 'Subjects (comma separated)' }
                ]
              }).then(function (d) {
                if (!d) return;
                UI.result(E.accession(o.id, d), 'gold');
              });
            } } : null
      ]
    });
  }

  function orderFlow() {
    var db = E.db();
    UI.form({
      eyebrow: 'Module 6.2',
      title: 'Raise a purchase order',
      intro: 'Placing the order encumbers the money immediately. The fund will refuse an order ' +
             'it cannot cover.',
      size: 'lg',
      submitLabel: 'Create order',
      fields: [
        { name: 'title', label: 'Title', required: true, placeholder: 'e.g. India After Gandhi' },
        { name: 'author', label: 'Author', placeholder: 'Guha, Ramachandra' },
        { name: 'isbn', label: 'ISBN' },
        { name: 'vendor', label: 'Vendor', type: 'select',
          options: db.vendors.map(function (v) {
            return { value: v.code, label: v.name + (v.edi ? ' (EDI)' : '') }; }) },
        { name: 'fund', label: 'Fund', type: 'select',
          options: db.funds.map(function (f) {
            return { value: f.code,
              label: f.name + ' — ' + U.money0(f.allocated - f.encumbered - f.spent) + ' free' }; }) },
        { name: 'qty', label: 'Copies', type: 'number', value: '3' },
        { name: 'unitPrice', label: 'Unit price (₹)', type: 'number', value: '899' },
        { name: 'requestedBy', label: 'Requested by', value: 'Collection Development' },
        { name: 'status', label: 'Create as', type: 'select',
          options: [{ value: 'suggested', label: 'Suggestion (no money moved yet)' },
                    { value: 'ordered', label: 'Order now (encumbers the fund)' }] }
      ]
    }).then(function (d) {
      if (!d || !d.title) return;
      var res = E.createOrder(d);
      if (!res.ok) { UI.result(res); return; }
      if (d.status === 'ordered') UI.result(E.advanceOrder(res.order.id), 'gold');
      else UI.result(res, 'gold');
    });
  }

  /* ============================================================
     SERIALS
     ============================================================ */

  LS.views.serials = function (mount) {
    var db = E.db();
    var late = U.sum(db.serials, function (s) {
      return s.issues.filter(function (i) { return i.status === 'late'; }).length; });

    mount.appendChild(App.header({
      eyebrow: 'Module 6.3',
      title: 'Serials & periodicals',
      lede: 'A journal is not one book — it is a stream of issues the system predicts in advance. ' +
            'Each arrival is checked in against that prediction; anything that never turns up is ' +
            'claimed from the vendor automatically.',
      actions: late ? [el('button.btn.btn-primary', { 'data-ripple': '', onclick: function () {
        var n = 0;
        db.serials.forEach(function (s) {
          s.issues.filter(function (i) { return i.status === 'late' && !i.claimed; })
            .forEach(function (i) { if (E.claimIssue(s.id, i.id).ok) n++; });
        });
        UI.toast({ tone: 'warn', title: n + ' claims sent',
          detail: 'One claim letter per missing issue, addressed to the subscription agent.' });
      } }, 'Claim all ' + late + ' late issues')] : null
    }));

    mount.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
      UI.stat({ label: 'Subscriptions', count: db.serials.length, foot: 'Across every branch' }),
      UI.stat({ label: 'Issues received', count: U.sum(db.serials, function (s) {
        return s.issues.filter(function (i) { return i.received; }).length; }),
        tone: 'ok', foot: 'Checked in against prediction' }),
      UI.stat({ label: 'Late', count: late, tone: late ? 'warn' : 'ok',
        foot: late ? 'Claimable from the vendor' : 'Nothing missing' }),
      UI.stat({ label: 'Expected next', count: U.sum(db.serials, function (s) {
        return s.issues.filter(function (i) { return i.status === 'expected'; }).length; }),
        foot: 'Predicted arrivals' })
    ]));

    db.serials.forEach(function (s) {
      var v = db.vendors.find(function (x) { return x.code === s.vendor; });
      var unbound = s.issues.filter(function (i) { return i.status === 'received' && !i.bound; });
      mount.appendChild(App.section(s.title, {
        note: s.pattern + ' · ISSN ' + s.issn + ' · ' + (v ? v.name : s.vendor) +
              ' · ' + E.branch(s.branch).name,
        actions: [
          unbound.length >= 3 ? el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.bindVolume(s.id), 'gold'); } },
            'Bind ' + unbound.length + ' issues') : null
        ]
      }, el('div.issuegrid', { 'data-reveal-group': '', 'data-stagger': '40' },
        s.issues.map(function (iss) {
          var tone = iss.status === 'received' ? 'ok' : iss.status === 'late' ? 'danger' : 'info';
          return el('div.issuecard.issuecard-' + tone + (iss.bound ? '.is-bound' : ''), {}, [
            el('div.issuecard-label', { text: iss.label }),
            el('div.tiny.faint', { text: 'Expected ' + U.fmtDateShort(iss.expected) }),
            el('div.issuecard-state', {}, [
              iss.bound ? el('span.chip.chip-gold', { text: 'Bound' })
                : iss.received ? el('span.chip.chip-ok', { text: 'In ' + U.fmtDateShort(iss.received) })
                : iss.status === 'late'
                  ? el('span.chip.chip-danger', {}, [el('span.dot.dot-pulse'),
                      el('span', { text: iss.claimed ? 'Claimed' : 'Late' })])
                  : el('span.chip.chip-info', { text: 'Expected' })
            ]),
            !iss.received ? el('div.row', { style: { '--gap': '6px', marginTop: '10px' } }, [
              el('button.btn.btn-sm', { onclick: function () {
                UI.result(E.receiveIssue(s.id, iss.id), 'ok'); } }, 'Check in'),
              iss.status === 'late' && !iss.claimed ? el('button.btn.btn-sm.btn-ghost', {
                onclick: function () { UI.result(E.claimIssue(s.id, iss.id), 'warn'); }
              }, 'Claim') : null
            ]) : null
          ]);
        }))));
    });
  };

  /* ============================================================
     INTERLIBRARY LOAN
     ============================================================ */

  LS.views.ill = function (mount) {
    var db = E.db();

    mount.appendChild(App.header({
      eyebrow: 'Module 6.7',
      title: 'Interlibrary loan',
      lede: 'When the local catalogue has nothing, the request goes out to a partner library over ' +
            'NCIP or ISO ILL. An incoming loan becomes a temporary item with a due date the ' +
            'lending library sets; an outgoing one takes a local copy out of circulation.',
      actions: [el('button.btn.btn-primary', { 'data-ripple': '', onclick: illFlow },
                   '＋ New request')]
    }));

    ['borrowing', 'lending'].forEach(function (dir) {
      var list = db.ill.filter(function (x) { return x.direction === dir; });
      mount.appendChild(App.section(dir === 'borrowing'
        ? 'Borrowing — requests we have sent out'
        : 'Lending — our copies at other libraries', { count: list.length },
        list.length ? el('div.stack', { style: { '--gap': '0' } }, list.map(function (x) {
          return el('div.listrow', { 'data-enter': '' }, [
            el('span.listrow-ic', { text: dir === 'borrowing' ? '⇠' : '⇢' }),
            el('div.grow', {}, [
              el('div.listrow-title', { text: x.title }),
              el('div.listrow-sub', { text: x.partner + ' · ' + x.protocol +
                (x.patronId ? ' · for ' + E.patron(x.patronId).name : '') })
            ]),
            el('span.chip.chip-' + (x.status === 'on-loan' ? 'info' : 'gold'), { text: x.status }),
            el('span.tiny.muted', { text: 'Due ' + U.fmtDate(x.due) }),
            el('button.btn.btn-sm', { onclick: function () {
              x.status = x.status === 'in-transit' ? 'received' : 'returned';
              E.log('Interlibrary', 'Status updated', x.title + ' — ' + x.status, 'info');
              UI.toast({ title: x.title + ' — ' + x.status, tone: 'ok' });
              E.recompute();
            } }, x.status === 'in-transit' ? 'Receive' : 'Close')
          ]);
        })) : UI.empty('Nothing ' + dir, '⇌')));
    });

    mount.appendChild(App.section('Protocols in use', {}, el('div.protogrid', {
      'data-reveal-group': '', 'data-stagger': '55' }, [
      ['NCIP', 'Circulation and self-service between systems'],
      ['ISO ILL', 'Request and supply between libraries'],
      ['Z39.50 / SRU', 'Search another library’s catalogue from inside this one'],
      ['SIP2', 'Self-check kiosks and RFID gates'],
      ['EDI', 'Orders and invoices with book vendors'],
      ['OpenURL', 'From a citation to the copy the library pays for'],
      ['MARC21 / ISO 2709', 'Bibliographic exchange'],
      ['COUNTER / SUSHI', 'E-resource usage statistics']
    ].map(function (p) {
      return el('div.protocard', { 'data-tilt': '', 'data-tilt-max': '6' }, [
        el('b', { text: p[0] }), el('span.tiny.faint', { text: p[1] })
      ]);
    }))));

    function illFlow() {
      UI.form({
        eyebrow: 'ISO ILL / NCIP', title: 'New interlibrary request',
        submitLabel: 'Send request',
        fields: [
          { name: 'title', label: 'Title wanted', required: true },
          { name: 'patronId', label: 'For member', type: 'select',
            options: db.patrons.map(function (p) {
              return { value: p.id, label: p.name }; }) },
          { name: 'partner', label: 'Partner library', type: 'select',
            options: ['IIT Madras Central Library', 'Presidency College Library',
                      'National Library, Kolkata', 'Delhi University Library System'] },
          { name: 'protocol', label: 'Protocol', type: 'select', options: ['NCIP', 'ISO ILL'] }
        ]
      }).then(function (d) {
        if (!d || !d.title) return;
        db.ill.push({
          id: 'ILL-' + String(db.ill.length + 1).padStart(4, '0'),
          direction: 'borrowing', title: d.title, patronId: d.patronId,
          partner: d.partner, status: 'in-transit',
          placed: U.iso(LS.clock.now()), due: U.iso(U.addDays(LS.clock.now(), 30)),
          protocol: d.protocol
        });
        E.log('Interlibrary', 'Request sent', d.title + ' requested from ' + d.partner, 'gold');
        UI.toast({ tone: 'gold', title: 'Request sent to ' + d.partner,
          detail: d.protocol + ' · it will arrive as a temporary item with a borrowed due date' });
        E.recompute();
      });
    }
  };

  LS.collection = { openBib: openBib, openPatron: openPatron, cat: cat };
})(window);
