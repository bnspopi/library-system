/* ============================================================
   views-opac.js — the public catalogue / discovery layer.

   Deliberately a different skin over exactly the same records:
   availability here is the same item.status the desk just wrote.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine, UI = LS.UI, App = LS.App;
  var el = U.el;

  var opac = { q: '', filters: {}, sort: 'relevance', me: null, tab: 'search' };

  LS.views.opac = function (mount) {
    mount.classList.add('opac');

    /* ---------------- hero ---------------- */
    var hero = el('section.opac-hero.grain', { 'data-spotlight': '' }, [
      el('div.opac-orb.float'),
      el('div.opac-hero-inner', {}, [
        el('div.eyebrow', { 'data-reveal': '', text: E.db().settings.libraryName }),
        el('h1.h1.opac-title', { 'data-split': '', 'data-split-delay': '120' },
           'Find it. Reserve it. Collect it.'),
        el('p.lede', { 'data-reveal': '', 'data-delay': '260', text:
          'One search across every branch, every format and every licensed e-resource. ' +
          'Availability is live — it is the same record the circulation desk writes to.' }),

        el('div.opac-search', { 'data-reveal': '', 'data-delay': '380' }, [
          el('span.opac-search-ic', { text: '⌕' }),
          el('input#opac-q.opac-search-input', {
            type: 'search', value: opac.q,
            'aria-label': 'Search the catalogue',
            placeholder: 'Search by title, author, subject or ISBN…',
            oninput: U.debounce(function (e) {
              opac.q = e.target.value; opac.tab = 'search'; App.render('opac', true);
            }, 260)
          }),
          el('button.btn.btn-primary', { 'data-ripple': '', onclick: function () {
            opac.q = document.getElementById('opac-q').value;
            opac.tab = 'search'; App.render('opac', false);
          } }, 'Search')
        ]),

        el('div.row.wrapflex.opac-suggest', { 'data-reveal': '', 'data-delay': '480' },
          [el('span.tiny.faint', { text: 'Try:' })].concat(
            ['india', 'algorithms', 'Murakami', 'subject:Cosmology', 'available laptops']
              .map(function (t) {
                return el('button.pickchip', { onclick: function () {
                  opac.q = t; opac.tab = 'search'; App.render('opac', false);
                } }, [el('b', { text: t })]);
              })))
      ])
    ]);
    mount.appendChild(hero);

    /* ---------------- nav ---------------- */
    var st = opac.me ? E.patronState(opac.me) : null;
    mount.appendChild(el('div.opac-nav', {}, [
      UI.tabs({
        active: opac.tab,
        items: [
          { key: 'search',  label: 'Catalogue',   icon: '⌕' },
          { key: 'account', label: 'My account',  icon: '◍',
            badge: st ? st.loans.length + st.holds.length : null },
          { key: 'kiosk',   label: 'Self-check',  icon: '▭' },
          { key: 'help',    label: 'Using the library', icon: '?' }
        ],
        onChange: function (k) { opac.tab = k; App.render('opac', false); }
      }),
      opac.me
        ? el('button.opac-user', { onclick: function () { opac.tab = 'account';
            App.render('opac', false); } }, [
            UI.avatar(E.patron(opac.me).name, 'sm'),
            el('span', {}, [
              el('b', { text: E.patron(opac.me).name }),
              el('em', { text: E.patronTypeName(E.patron(opac.me).type) })
            ])
          ])
        : el('button.btn.btn-sm', { onclick: function () { signIn(); } }, 'Sign in')
    ]));

    var pane = el('div.opac-pane', { 'data-enter': '' });
    mount.appendChild(pane);

    if (opac.tab === 'search')  renderSearch(pane);
    if (opac.tab === 'account') renderAccount(pane);
    if (opac.tab === 'kiosk')   renderKiosk(pane);
    if (opac.tab === 'help')    renderHelp(pane);
  };

  /* ============================================================
     search / discovery
     ============================================================ */

  function renderSearch(pane) {
    var results = E.search(opac.q, Object.assign({ sort: opac.sort }, opac.filters));
    var facets = E.facets(E.search(opac.q, {}));

    pane.appendChild(el('div.opac-grid', {}, [
      /* --- facets --- */
      el('aside.facets', { 'data-enter': '' }, [
        el('div.panel-title', { style: { marginBottom: '14px' }, text: 'Narrow your search' }),
        el('label.check', { style: { marginBottom: '16px' } }, [
          el('input', { type: 'checkbox', checked: !!opac.filters.availableNow,
            onchange: function (e) {
              opac.filters.availableNow = e.target.checked || undefined;
              App.render('opac', false);
            } }),
          el('span', { text: 'Available now' })
        ]),
        facetBlock('Format', 'format', facets.format),
        facetBlock('Branch', 'branch', facets.branch.map(function (f) {
          return { key: f.key, n: f.n, label: E.branch(f.key).name }; })),
        facetBlock('Subject', 'subject', facets.subject),
        facetBlock('Published', 'decade', facets.decade.map(function (f) {
          return { key: f.key, n: f.n, label: f.key + 's' }; })),
        Object.keys(opac.filters).length ? el('button.btn.btn-sm.btn-ghost.btn-block', {
          style: { marginTop: '16px' },
          onclick: function () { opac.filters = {}; App.render('opac', false); }
        }, 'Clear filters') : null
      ]),

      /* --- results --- */
      el('div.stack', { style: { '--gap': '18px' } }, [
        el('div.row-between.wrapflex', { 'data-enter': '' }, [
          el('span.small.muted', {}, [
            el('b.gold', { text: String(results.length) }),
            el('span', { text: ' result' + (results.length === 1 ? '' : 's') +
              (opac.q ? ' for “' + opac.q + '”' : '') })
          ]),
          el('select.select', { style: { maxWidth: '210px' }, onchange: function (e) {
            opac.sort = e.target.value; App.render('opac', false);
          } }, [
            { v: 'relevance', l: 'Relevance' }, { v: 'title', l: 'Title A–Z' },
            { v: 'year', l: 'Newest first' }, { v: 'popular', l: 'Most borrowed' }
          ].map(function (o) {
            return el('option', { value: o.v, selected: opac.sort === o.v }, o.l);
          }))
        ]),

        results.length
          ? el('div.opac-results', { 'data-reveal-group': '', 'data-stagger': '45' },
              results.map(publicCard))
          : el('div.empty', {}, [
              el('span.ic', { text: '⌕' }),
              el('span', { text: 'Nothing matched “' + opac.q + '”.' }),
              el('button.btn.btn-sm', { style: { marginTop: '12px' }, onclick: function () {
                suggestPurchase(opac.q);
              } }, 'Suggest this for purchase')
            ])
      ])
    ]));

    function facetBlock(title, key, list) {
      if (!list.length) return null;
      return el('div.facet', {}, [
        el('div.facet-title', { text: title }),
        el('ul', {}, list.slice(0, 6).map(function (f) {
          var active = String(opac.filters[key]) === String(f.key);
          return el('li', {}, el('button.facet-btn' + (active ? '.is-active' : ''), {
            onclick: function () {
              if (active) delete opac.filters[key]; else opac.filters[key] = f.key;
              App.render('opac', false);
            }
          }, [el('span', { text: f.label || f.key }), el('b', { text: String(f.n) })]));
        }))
      ]);
    }
  }

  function publicCard(r) {
    var b = r.bib, a = r.avail;
    var mine = opac.me && E.loansOf(opac.me).some(function (l) { return l.bibId === b.id; });
    var held = opac.me && E.holdsOf(opac.me).some(function (h) { return h.bibId === b.id; });

    return el('article.pubcard', { 'data-tilt': '', 'data-tilt-max': '4', 'data-spotlight': '' }, [
      el('div.pubcard-cover', { 'data-fmt': b.format }, [
        el('span.pubcard-cover-title', { text: b.title }),
        el('span.pubcard-cover-author', { text: b.author.split(',')[0] }),
        el('span.pubcard-cover-call', { text: b.dewey })
      ]),
      el('div.pubcard-body', {}, [
        el('h3.pubcard-title', { text: b.title }),
        el('div.pubcard-author', { text: b.author + ' · ' + b.publisher + ', ' + b.year }),
        el('p.pubcard-summary', { text: b.summary }),
        el('div.row.wrapflex', { style: { '--gap': '6px' } }, [
          el('span.chip' + (a.available ? '.chip-ok' : '.chip-warn'), {}, [
            el('span.dot' + (a.available ? '' : '.dot-pulse')),
            el('span', { text: a.available
              ? a.available + ' available' + (a.branches.length ?
                  ' at ' + a.branches.map(function (c) { return E.branch(c).code; }).join(', ') : '')
              : 'All copies on loan' })
          ]),
          a.queue ? el('span.chip.chip-gold', { text: a.queue + ' waiting' }) : null,
          mine ? el('span.chip.chip-info', { text: 'You have this out' }) : null,
          held ? el('span.chip.chip-gold', { text: 'You are in the queue' }) : null,
          el('span.chip', { text: b.format })
        ]),
        el('div.row.wrapflex.pubcard-actions', { style: { '--gap': '8px' } }, [
          el('button.btn.btn-sm', { 'data-ripple': '',
            onclick: function () { openPublicRecord(b.id); } }, 'Details & copies'),
          b.format === 'E-book'
            ? el('button.btn.btn-sm.btn-primary', { 'data-ripple': '', onclick: function () {
                UI.toast({ tone: 'gold', title: 'Opening ' + b.title,
                  detail: 'OpenURL resolver → ' + b.eresource.platform + ' · ' +
                          b.eresource.simultaneous + ' simultaneous users licensed' });
              } }, 'Read online')
            : el('button.btn.btn-sm.btn-primary', { 'data-ripple': '', disabled: held,
                onclick: function () { doHold(b.id); } }, held ? 'Hold placed' : 'Place a hold')
        ])
      ])
    ]);
  }

  function openPublicRecord(bibId) {
    var b = E.bib(bibId);
    var items = E.itemsOf(bibId);
    var a = E.availability(bibId);
    var byBranch = U.groupBy(items, function (i) { return i.branch; });

    UI.drawer({
      eyebrow: b.format + ' · ' + b.dewey,
      title: b.title,
      subtitle: b.author + ' · ' + b.publisher + ', ' + b.year,
      body: el('div.stack', { style: { '--gap': '20px' } }, [
        el('p.small.muted', { 'data-enter': '', text: b.summary }),
        el('div.row.wrapflex', { 'data-enter': '', style: { '--gap': '6px' } },
          b.subjects.map(function (s) {
            return el('button.chip', { onclick: function () {
              opac.filters.subject = s; opac.tab = 'search';
              document.querySelector('.drawer-scrim').click();
              App.render('opac', false);
            }, text: s });
          })),

        el('div', { 'data-enter': '' }, [
          el('div.panel-title', { style: { marginBottom: '12px' }, text: 'Where to find it' }),
          el('div.stack', { style: { '--gap': '12px' } }, Object.keys(byBranch).map(function (code) {
            var br = E.branch(code);
            var list = byBranch[code];
            var avail = list.filter(function (i) { return i.status === 'available'; });
            return el('div.shelfcard', {}, [
              el('div.row-between.wrapflex', {}, [
                el('div', {}, [
                  el('b.small', { text: br.name }),
                  el('div.tiny.faint', { text: list[0].shelf + ' · ' + br.hours })
                ]),
                el('span.chip' + (avail.length ? '.chip-ok' : '.chip-warn'), {
                  text: avail.length + ' of ' + list.length + ' on the shelf' })
              ]),
              el('ul.copylist', {}, list.map(function (i) {
                var lo = E.loanForBarcode(i.barcode);
                return el('li', {}, [
                  el('span.mono.tiny', { text: i.callNo }),
                  UI.statusChip(i.status),
                  lo ? el('span.tiny.faint', { text: 'due ' + U.fmtDateShort(lo.due) }) : null
                ]);
              }))
            ]);
          }))
        ]),

        a.queue ? el('div.hintbox', { 'data-enter': '' }, [
          el('span.hintbox-ic', { text: '◆' }),
          el('div', {}, [
            el('b', { text: a.queue + ' member' + (a.queue === 1 ? ' is' : 's are') + ' waiting' }),
            el('p.small.muted', { text: 'Holds are on the title, not a particular copy — ' +
              'whichever comes back first goes to whoever has waited longest.' })
          ])
        ]) : null,

        b.eresource ? el('div.licensebox', { 'data-enter': '' }, [
          el('div.panel-title', { text: 'Online access' }),
          UI.kv([
            ['Platform', b.eresource.platform],
            ['Simultaneous users', String(b.eresource.simultaneous)],
            ['Walk-in access', b.eresource.walkIn ? 'Yes, inside the library' : 'No'],
            ['Licence until', U.fmtDate(b.eresource.licenseEnds)]
          ])
        ]) : null
      ]),
      actions: [
        b.format !== 'E-book'
          ? { label: 'Place a hold', primary: true, run: function () { doHold(bibId); } }
          : { label: 'Read online', primary: true, run: function () {
              UI.toast({ tone: 'gold', title: 'OpenURL resolver',
                detail: 'Sending you to ' + b.eresource.platform + ' — the copy the library pays for.' });
            } },
        { label: 'Suggest for purchase', run: function () { suggestPurchase(b.title); } }
      ]
    });
  }

  function doHold(bibId) {
    if (!opac.me) { signIn(function () { doHold(bibId); }); return; }
    var p = E.patron(opac.me);
    UI.form({
      eyebrow: 'Reservation',
      title: 'Place a hold on “' + E.bib(bibId).title + '”',
      intro: 'Choose where you would like to collect it. You will be notified the moment a copy ' +
             'is trapped for you.',
      submitLabel: 'Place hold',
      fields: [{ name: 'pickup', label: 'Collect at', type: 'select', value: p.branch,
        options: E.db().branches.map(function (b) { return { value: b.code, label: b.name }; }) }]
    }).then(function (d) {
      if (!d) return;
      var res = E.placeHold(opac.me, bibId, d.pickup, { channel: 'opac' });
      UI.result(res, 'gold');
      App.render('opac', false);
    });
  }

  function suggestPurchase(title) {
    UI.form({
      eyebrow: 'Purchase suggestion',
      title: 'Suggest a title',
      intro: 'Suggestions land in acquisitions as a selection record. If it is bought, the same ' +
             'record becomes the purchase order, then the invoice, then the catalogue entry.',
      submitLabel: 'Send suggestion',
      fields: [
        { name: 'title', label: 'Title', value: title || '' },
        { name: 'author', label: 'Author' },
        { name: 'note', label: 'Why do you need it?', type: 'textarea' }
      ]
    }).then(function (d) {
      if (!d || !d.title) return;
      var res = E.createOrder({
        vendor: 'ATLAS', fund: 'MONO-GEN', title: d.title, author: d.author,
        qty: 1, unitPrice: 900, status: 'suggested',
        requestedBy: opac.me ? E.patron(opac.me).name + ' (member suggestion)' : 'Public suggestion'
      });
      if (res.ok) {
        UI.toast({ tone: 'gold', title: 'Suggestion sent to acquisitions',
          detail: 'It appears in the selection column of the order pipeline right now.' });
      } else UI.result(res);
    });
  }

  /* ============================================================
     my account
     ============================================================ */

  function renderAccount(pane) {
    if (!opac.me) {
      pane.appendChild(el('div.signinbox', { 'data-enter': '' }, [
        el('div.eyebrow.no-rule', { text: 'Member sign in' }),
        el('h2.h2', { text: 'See your loans, holds and charges' }),
        el('p.lede', { text: 'This is the same account record the desk sees — renewing here and ' +
          'renewing at the counter write the identical transaction.' }),
        el('button.btn.btn-primary.btn-lg', { 'data-ripple': '', onclick: function () { signIn(); } },
           'Sign in with a library card')
      ]));
      return;
    }

    var st = E.patronState(opac.me);
    var p = st.patron;

    pane.appendChild(el('div.acctop', { 'data-enter': '' }, [
      UI.avatar(p.name, 'lg'),
      el('div.grow', {}, [
        el('h2.h2', { text: p.name }),
        el('div.small.muted', { text: E.patronTypeName(p.type) + ' · card ' + p.cardNo + ' · ' +
          E.branch(p.branch).name + ' · valid to ' + U.fmtDate(p.expires) })
      ]),
      el('button.btn.btn-sm.btn-ghost', { onclick: function () {
        opac.me = null; App.render('opac', false);
        UI.toast({ title: 'Signed out', tone: 'info' });
      } }, 'Sign out')
    ]));

    if (st.blocked) {
      pane.appendChild(el('div.warnbox', { 'data-enter': '' }, [
        el('b', { text: 'Your account is blocked: ' + st.blocks[0].label }),
        el('p.small.muted', { text: 'You can still search and renew nothing new can be borrowed ' +
          'until this is cleared. Settle online below, or speak to any service desk.' })
      ]));
    }

    pane.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
      UI.stat({ label: 'On loan', count: st.loans.length }),
      UI.stat({ label: 'Overdue', count: st.overdue.length,
        tone: st.overdue.length ? 'danger' : 'ok' }),
      UI.stat({ label: 'Holds', count: st.holds.length, tone: 'gold' }),
      UI.stat({ label: 'You owe', count: Math.round(st.outstanding), prefix: '₹',
        tone: st.outstanding ? 'warn' : 'ok' })
    ]));

    /* --- loans --- */
    pane.appendChild(App.section('Your loans', {
      count: st.loans.length,
      actions: st.loans.length ? [el('button.btn.btn-sm', { onclick: function () {
        var done = 0, refused = [];
        st.loans.slice().forEach(function (l) {
          var r = E.renew(l.id);
          if (r.ok) done++; else refused.push(E.bib(l.bibId).title + ' — ' + r.msg);
        });
        UI.toast({ tone: done ? 'ok' : 'warn',
          title: done + ' renewed' + (refused.length ? ', ' + refused.length + ' refused' : ''),
          detail: refused.length ? refused[0] : 'New due dates are on your account now.',
          duration: 7000 });
        App.render('opac', false);
      } }, 'Renew everything possible')] : null
    }, st.loans.length ? el('div.stack', { style: { '--gap': '0' } },
      st.loans.sort(U.by('due')).map(function (l) {
        var b = E.bib(l.bibId), it = E.item(l.barcode);
        var pol = E.policyFor(p.type, it.type);
        var waiting = E.db().holds.filter(function (h) {
          return h.bibId === l.bibId && (h.status === 'waiting' || h.status === 'ready'); }).length;
        var capped = l.renewals >= pol.renewals;
        return el('div.listrow', { 'data-enter': '' }, [
          el('div.grow', {}, [
            el('div.listrow-title', { text: b.title }),
            el('div.listrow-sub', { text: b.author + ' · ' + E.branch(it.homeBranch).name +
              ' · renewed ' + l.renewals + ' of ' + pol.renewals + ' times' })
          ]),
          UI.dueChip(l.due),
          el('button.btn.btn-sm', {
            disabled: capped || waiting > 0,
            title: capped ? 'Renewal limit reached' :
                   waiting ? waiting + ' member(s) are waiting for this title' : '',
            onclick: function () { UI.result(E.renew(l.id), 'ok'); App.render('opac', false); }
          }, capped ? 'Limit reached' : waiting ? 'Reserved by another' : 'Renew')
        ]);
      })) : UI.empty('You have nothing on loan', '◎')));

    /* --- holds --- */
    pane.appendChild(App.section('Your holds', { count: st.holds.length },
      st.holds.length ? el('div.stack', { style: { '--gap': '0' } }, st.holds.map(function (h) {
        var b = E.bib(h.bibId);
        return el('div.listrow', { 'data-enter': '' }, [
          el('span.listrow-ic', { text: '◆' }),
          el('div.grow', {}, [
            el('div.listrow-title', { text: b.title }),
            el('div.listrow-sub', { text: h.status === 'ready'
              ? 'Ready to collect at ' + E.branch(h.pickupBranch).name + ' until ' +
                U.fmtDate(h.expires)
              : 'Position ' + E.holdPosition(h.id) + ' in the queue · collect at ' +
                E.branch(h.pickupBranch).name })
          ]),
          h.status === 'ready'
            ? el('span.chip.chip-gold', {}, [el('span.dot.dot-pulse'),
                el('span', { text: 'Ready' })])
            : el('span.chip', { text: 'Waiting' }),
          el('button.btn.btn-sm.btn-ghost', { onclick: function () {
            UI.result(E.cancelHold(h.id, 'Cancelled by member online'), 'warn');
            App.render('opac', false);
          } }, 'Cancel')
        ]);
      })) : UI.empty('You have no holds', '◆')));

    /* --- charges --- */
    pane.appendChild(App.section('Charges', {
      count: st.fines.length,
      actions: st.outstanding ? [el('button.btn.btn-sm.btn-primary', { 'data-ripple': '',
        onclick: function () {
          UI.confirm({ eyebrow: 'Payment gateway', title: 'Pay ' + U.money(st.outstanding) + '?',
            message: 'You will be redirected to the payment gateway. The block on your account ' +
                     'lifts the moment the payment is recorded.',
            confirmLabel: 'Pay now' }).then(function (yes) {
            if (!yes) return;
            UI.result(E.payAll(opac.me, 'online'), 'ok');
            App.render('opac', false);
          });
        } }, 'Pay ' + U.money(st.outstanding))] : null
    }, st.fines.length ? el('div.stack', { style: { '--gap': '0' } }, st.fines.map(function (f) {
      return el('div.listrow', { 'data-enter': '' }, [
        el('span.listrow-ic', { text: '⊙' }),
        el('div.grow', {}, [
          el('div.listrow-title', { text: f.description }),
          el('div.listrow-sub', { text: U.titleCase(f.type) + ' · raised ' + U.fmtDate(f.created) })
        ]),
        el('b', { text: U.money(f.amount - f.paidAmount) })
      ]);
    })) : UI.empty('You owe nothing', '✓')));

    /* --- history --- */
    var history = E.loansOf(opac.me, true).filter(function (l) { return l.in; })
      .sort(U.by('in', 'desc')).slice(0, 10);
    pane.appendChild(App.section('Reading history', {
      note: p.historyOptIn ? 'you have opted in to keeping this' : 'not retained'
    }, p.historyOptIn
      ? (history.length ? el('ul.historylist', {}, history.map(function (l) {
          var b = E.bib(l.bibId);
          return el('li', {}, [
            el('span.small', { text: b ? b.title : '—' }),
            el('span.tiny.faint', { text: 'returned ' + U.fmtDate(l.in) })
          ]);
        })) : UI.empty('Nothing returned yet', '◎'))
      : el('div.privacybox', {}, [
          el('b.small', { text: 'Your reading history is not being kept.' }),
          el('p.tiny.faint', { text: 'The library stores what you have out now, because it has ' +
            'to. What you have already returned is unlinked from you.' }),
          el('button.btn.btn-sm', { style: { marginTop: '10px' }, onclick: function () {
            p.historyOptIn = true;
            UI.toast({ title: 'Reading history switched on', tone: 'info' });
            App.render('opac', false);
          } }, 'Keep my history')
        ])));
  }

  function signIn(after) {
    var dlg;
    dlg = UI.modal({
      eyebrow: 'Member sign in',
      title: 'Choose a demo card',
      size: 'md',
      body: el('div.stack', { style: { '--gap': '14px' } }, [
        el('p.small.muted', { text: 'Each of these is a real record in the demo database, with ' +
          'its own loans, holds and charges. Two of them are blocked — try those to see what a ' +
          'member sees when circulation refuses them.' }),
        el('div.cardpicker', {}, E.db().patrons.map(function (p) {
          var st = E.patronState(p.id);
          return el('button.librarycard' + (st.blocked ? '.is-blocked' : ''), {
            'data-ripple': '',
            onclick: function () {
              opac.me = p.id;
              opac.tab = 'account';
              if (dlg) dlg.close();
              UI.toast({ title: 'Signed in as ' + p.name, tone: 'ok',
                detail: st.loans.length + ' on loan · ' + st.holds.length + ' holds · ' +
                        U.money(st.outstanding) + ' owed' });
              App.render('opac', false);
              if (typeof after === 'function') after();
            }
          }, [
            el('div.librarycard-top', {}, [
              el('span.tiny', { text: 'AURELIA LIBRARY' }),
              el('span.librarycard-chip')
            ]),
            el('b', { text: p.name }),
            el('span.mono.tiny', { text: p.cardNo }),
            el('div.row-between', { style: { marginTop: '8px' } }, [
              el('span.tiny.faint', { text: E.patronTypeName(p.type) }),
              st.blocked ? el('span.chip.chip-danger.tiny', { text: 'Blocked' })
                         : el('span.tiny.faint', { text: st.loans.length + ' out' })
            ])
          ]);
        }))
      ]),
      actions: [{ label: 'Cancel', ghost: true }]
    });
    return dlg;
  }

  /* ============================================================
     self-check kiosk (SIP2)
     ============================================================ */

  function renderKiosk(pane) {
    /* Terminal state lives on the module, not this render: checking an item out
       fires db:change, which repaints the view — a kiosk that forgot its session
       every time it issued something would be worse than useless. */
    var state = opac.kiosk || (opac.kiosk = { patron: null, log: [], screen: 'idle' });

    var screen = el('div.kiosk-screen');
    var kiosk = el('div.kiosk', { 'data-enter': '' }, [
      el('div.kiosk-frame', {}, [
        el('div.kiosk-bar', {}, [
          el('span.dot.dot-pulse'),
          el('span.tiny', { text: 'SELF-SERVICE TERMINAL · SIP2 · ' +
            E.branch(E.operator.branch).name })
        ]),
        screen
      ]),
      el('div.kiosk-side', {}, [
        el('div.eyebrow', { text: 'Section 8 — self service' }),
        el('h2.h2', { text: 'The same engine, no member of staff' }),
        el('p.lede', { text: 'A self-check machine is not a separate system. It speaks SIP2 to ' +
          'the very same circulation engine the desk uses, so the policy matrix, the hold queue ' +
          'and the fine ledger all behave identically at three in the morning.' }),
        el('ul.tickitems', {}, [
          'Patron authentication over SIP2',
          'Same eligibility checks — blocks, limits, expiry',
          'Same due-date calculation from the policy matrix',
          'RFID pad reads a stack of books in one pass',
          'Security gate alarms if an item was never discharged'
        ].map(function (t) {
          return el('li', {}, [el('span.privtick', { text: '✓' }), el('span.small', { text: t })]);
        }))
      ])
    ]);
    pane.appendChild(kiosk);

    if (state.screen === 'session' && state.patron) drawSession();
    else if (state.screen === 'card') drawCardPick();
    else drawIdle();

    function drawIdle() {
      state.screen = 'idle';
      screen.innerHTML = '';
      screen.appendChild(el('div.kiosk-idle', {}, [
        el('div.kiosk-logo.breathe', { text: '⌗' }),
        el('h3.h3', { text: 'Touch to begin' }),
        el('p.small.muted', { text: 'Scan your library card to borrow' }),
        el('button.btn.btn-primary.btn-lg', { 'data-ripple': '',
          onclick: function () { drawCardPick(); } }, 'Scan card')
      ]));
    }

    function drawCardPick() {
      state.screen = 'card';
      screen.innerHTML = '';
      screen.appendChild(el('div.kiosk-step', {}, [
        el('div.eyebrow.no-rule', { text: 'Step 1 of 2' }),
        el('h3.h3', { text: 'Present your card' }),
        el('div.kiosk-cards', {}, E.db().patrons.slice(0, 6).map(function (p) {
          return el('button.pickchip', { onclick: function () {
            state.patron = p.id;
            drawSession();
          } }, [el('b', { text: p.name }), el('span', { text: p.cardNo })]);
        }))
      ]));
    }

    function drawSession() {
      state.screen = 'session';
      var st = E.patronState(state.patron);
      screen.innerHTML = '';

      if (st.blocked) {
        screen.appendChild(el('div.kiosk-step.kiosk-deny', {}, [
          el('div.kiosk-deny-ic.shake', { text: '✕' }),
          el('h3.h3', { text: 'Please see a member of staff' }),
          el('p.small', { text: st.blocks[0].label }),
          el('p.tiny.faint', { text: 'The kiosk applies exactly the same block the desk would. ' +
            'It cannot override; only a supervisor can.' }),
          el('button.btn.btn-sm', { onclick: drawIdle }, 'Start again')
        ]));
        return;
      }

      var avail = E.db().items.filter(function (i) { return i.status === 'available'; });
      screen.appendChild(el('div.kiosk-step', {}, [
        el('div.row-between', {}, [
          el('div', {}, [
            el('div.eyebrow.no-rule', { text: 'Signed in' }),
            el('h3.h3', { text: st.patron.name })
          ]),
          el('button.btn.btn-sm.btn-ghost', { onclick: function () {
            state.patron = null; state.log = []; drawIdle();
          } }, 'Finish')
        ]),
        el('p.small.muted', { text: 'Place your items on the pad, one at a time.' }),
        el('div.kiosk-pad', {}, avail.slice(0, 8).map(function (i, k) {
          var b = E.bib(i.bibId);
          return el('button.kiosk-item', { style: { animationDelay: (k * 50) + 'ms' },
            onclick: function () {
              var res = E.checkout(state.patron, i.barcode, { channel: 'self-check' });
              if (res.ok) {
                state.log.unshift({ ok: true, title: res.bib.title, due: res.loan.due });
              } else {
                state.log.unshift({ ok: false, title: b.title, msg: res.msg });
              }
              drawSession();
            } }, [
            el('b', { text: b.title.length > 26 ? b.title.slice(0, 25) + '…' : b.title }),
            el('span.tiny.faint', { text: i.barcode })
          ]);
        })),
        state.log.length ? el('div.kiosk-log', {}, state.log.map(function (l, k) {
          return el('div.kiosk-logline' + (l.ok ? '.ok' : '.bad'), {
            style: { animationDelay: (k * 70) + 'ms' } }, [
            el('span', { text: l.ok ? '✓' : '✕' }),
            el('div.grow', {}, [
              el('b.small', { text: l.title }),
              el('div.tiny.faint', { text: l.ok ? 'Due ' + U.fmtDate(l.due) : l.msg })
            ])
          ]);
        })) : null,
        state.log.filter(function (l) { return l.ok; }).length
          ? el('button.btn.btn-primary', { style: { marginTop: '14px' }, onclick: function () {
              UI.toast({ tone: 'ok', title: 'Receipt printed',
                detail: state.log.filter(function (l) { return l.ok; }).length +
                        ' items issued through the kiosk — the desk sees them already.' });
              state.log = []; state.patron = null; drawIdle();
            } }, 'Print receipt & finish')
          : null
      ]));
    }
  }

  /* ============================================================
     help / using the library
     ============================================================ */

  function renderHelp(pane) {
    var db = E.db();

    pane.appendChild(el('div.grid-2', {}, [
      App.section('Borrowing rules', { note: 'set by the policy matrix, not by the counter' },
        el('div.tbl-scroll', {}, el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, ['You are', 'Books', 'Short loan', 'DVDs', 'Fine / day']
            .map(function (h) { return el('th', { text: h }); }))),
          el('tbody', {}, ['FACULTY', 'PG', 'UG', 'CHILD', 'VISITOR'].map(function (code) {
            var book = E.policyFor(code, 'BOOK');
            var res = E.policyFor(code, 'RESERVE');
            var dvd = E.policyFor(code, 'DVD');
            return el('tr', {}, [
              el('td.small', { text: E.patronTypeName(code) }),
              el('td.tiny', { text: book.loanDays ? book.loanDays + ' days · max ' +
                book.maxItems : '—' }),
              el('td.tiny', { text: res.loanDays ? res.loanDays + ' day' +
                (res.loanDays > 1 ? 's' : '') : '—' }),
              el('td.tiny', { text: dvd.loanDays ? dvd.loanDays + ' days' : '—' }),
              el('td.tiny', { text: U.money(book.finePerDay) })
            ]);
          }))
        ]))),

      App.section('Branches & opening hours', {},
        el('div.stack', { style: { '--gap': '0' } }, db.branches.map(function (b) {
          return el('div.listrow', { 'data-enter': '' }, [
            el('span.listrow-ic', { text: '⌂' }),
            el('div.grow', {}, [
              el('div.listrow-title', { text: b.name }),
              el('div.listrow-sub', { text: b.hours })
            ]),
            el('span.chip.mono', { text: b.code })
          ]);
        })))
    ]));

    pane.appendChild(App.section('How a hold works', {}, el('div.flowline', {
      'data-reveal-group': '', 'data-stagger': '90' }, [
      ['1', 'You place a hold', 'On the title, not a copy — any copy will do.'],
      ['2', 'A copy becomes free', 'Either it is returned, or staff pull one off the shelf.'],
      ['3', 'It is trapped for you', 'It stops being “available” even though it is in the building.'],
      ['4', 'You are notified', 'Email or SMS, the moment it happens.'],
      ['5', 'You collect it', 'You have ' + db.settings.holdShelfDays + ' days, then it passes ' +
        'to the next person waiting.']
    ].map(function (s) {
      return el('div.flowstep', {}, [
        el('span.flowstep-n', { text: s[0] }),
        el('b.small', { text: s[1] }),
        el('span.tiny.faint', { text: s[2] })
      ]);
    }))));

    pane.appendChild(App.section('Your privacy', {}, el('div.stack', { style: { '--gap': '13px' } },
      [
        ['What you have out now is kept', 'The library cannot chase an overdue book without it.'],
        ['What you have returned may not be', 'Reading history is opt-in. Switch it off and ' +
          'closed loans are unlinked from you.'],
        ['Staff access is role-based', 'A student assistant at the desk cannot read your history ' +
          'or waive your charges.'],
        ['Every change is attributed', 'If someone alters your record, the audit log says who.']
      ].map(function (r) {
        return el('div.row', { style: { '--gap': '12px' }, 'data-enter': '' }, [
          el('span.privtick', { text: '✓' }),
          el('div', {}, [el('b.small', { text: r[0] }), el('div.tiny.faint', { text: r[1] })])
        ]);
      }))));
  }

  LS.opac = opac;
})(window);
