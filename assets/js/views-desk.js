/* ============================================================
   views-desk.js — Overview, Circulation, Holds & transit, Fines
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine, UI = LS.UI, App = LS.App;
  var el = U.el;

  /* View-local state survives the re-render that follows every write. */
  var circ  = { tab: 'issue', patronId: null, barcode: '', last: null };
  var holds = { tab: 'queue' };
  var fines = { tab: 'outstanding' };

  /* ============================================================
     OVERVIEW
     ============================================================ */

  LS.views.overview = function (mount) {
    var s = E.stats();
    var db = E.db();

    mount.appendChild(App.header({
      eyebrow: 'Service desk',
      title: 'Good ' + partOfDay() + ', ' + E.operator.name.split(' ').pop(),
      lede: db.settings.libraryName + ' · ' + E.branch(E.operator.branch).name + ' · ' +
            U.fmtDate(LS.clock.now()) + '. ' + s.onLoan + ' items are out, ' + s.overdue +
            ' are overdue and ' + s.pullList + ' holds are waiting to be pulled from the shelves.',
      actions: [
        el('button.btn.btn-primary', { 'data-ripple': '',
          onclick: function () { circ.tab = 'issue'; App.go('circulation'); } }, '⇄ Open circulation'),
        el('button.btn', { 'data-ripple': '',
          onclick: function () { App.go('notices'); } }, '✉ Run nightly job')
      ]
    }));

    /* --- stat strip --- */
    var strip = el('div.statgrid', { 'data-reveal-group': '', 'data-stagger': '60' }, [
      UI.stat({ label: 'Items on loan', count: s.onLoan, foot: s.utilisation + '% of the circulating stock',
        onclick: function () { App.go('circulation'); },
        spark: E.circByDay(14).map(function (d) { return d.issues; }) }),
      UI.stat({ label: 'Overdue', count: s.overdue, tone: s.overdue ? 'danger' : 'ok',
        foot: s.overdue ? 'Fines accruing nightly' : 'Nothing overdue',
        onclick: function () { fines.tab = 'outstanding'; App.go('fines'); } }),
      UI.stat({ label: 'Holds waiting', count: s.holdsWaiting + s.holdsReady,
        foot: s.pullList + ' to pull · ' + s.holdsReady + ' on the shelf', tone: 'gold',
        onclick: function () { holds.tab = 'pull'; App.go('holds'); } }),
      UI.stat({ label: 'Charges outstanding', count: Math.round(s.finesOutstanding),
        prefix: '₹', foot: s.finesCount + ' open charges · ' + U.money0(s.collected) + ' collected',
        onclick: function () { App.go('fines'); } }),
      UI.stat({ label: 'Active members', count: s.activePatrons,
        foot: (s.patrons - s.activePatrons) + ' expired', onclick: function () { App.go('patrons'); } }),
      UI.stat({ label: 'Notices sent today', count: s.noticesToday,
        foot: 'Email & SMS gateway', onclick: function () { App.go('notices'); } })
    ]);
    mount.appendChild(strip);

    /* --- charts row --- */
    var chart = E.circByDay(14);
    mount.appendChild(el('div.grid-2', {}, [
      App.section('Circulation — last 14 days', {
        note: 'issues vs returns',
        actions: [el('span.legend', {}, [
          el('i.legend-a'), el('span', { text: 'Issues' }),
          el('i.legend-b'), el('span', { text: 'Returns' })
        ])]
      }, UI.barChart(chart.map(function (d) {
        return { label: d.label.split(' ')[0], value: d.issues, value2: d.returns };
      }), { height: 150 })),

      App.section('Collection at a glance', {}, el('div.stack', { style: { '--gap': '16px' } }, [
        el('div.row', { style: { '--gap': '20px' } }, [
          UI.ring(s.utilisation, { caption: 'on loan' }),
          el('div.grow.stack', { style: { '--gap': '9px' } }, [
            miniRow('On the shelf', s.available, 'ok'),
            miniRow('On loan', s.onLoan, 'info'),
            miniRow('On the hold shelf', s.holdsReady, 'gold'),
            miniRow('In transit between branches', s.inTransit, 'info'),
            miniRow('Lost or billed', s.lost, s.lost ? 'danger' : '')
          ])
        ]),
        el('div.hairline'),
        el('div.stack', { style: { '--gap': '10px' } }, E.branchStats().map(function (b) {
          return el('div.branchrow', {}, [
            el('div.row-between', {}, [
              el('b.small', { text: b.branch.name }),
              el('span.tiny.faint', { text: b.onLoan + ' out · ' + b.available + ' on shelf · ' +
                b.holds + ' holds' })
            ]),
            UI.meter([
              { label: 'On loan',   value: b.onLoan,    colour: 'var(--info)' },
              { label: 'Available', value: b.available, colour: 'var(--gold)' },
              { label: 'Other',     value: Math.max(0, b.items - b.onLoan - b.available),
                colour: 'var(--surface-hi)' }
            ], { total: b.items })
          ]);
        }))
      ]))
    ]));

    /* --- work queues --- */
    var todayLoans = E.openLoans().filter(function (l) {
      return U.daysBetween(U.today(), new Date(l.due)) <= 0;
    }).sort(U.by('due'));

    mount.appendChild(el('div.grid-2', {}, [
      App.section('Needs attention today', {
        count: todayLoans.length,
        note: 'due today and overdue'
      }, todayLoans.length ? el('div.stack', { style: { '--gap': '0' } },
        todayLoans.slice(0, 8).map(function (l) {
          var p = E.patron(l.patronId), b = E.bib(l.bibId);
          return el('button.listrow', { 'data-enter': '', 'data-ripple': '',
            onclick: function () { App.go('patrons', { patronId: p.id }); } }, [
            UI.avatar(p.name, 'sm'),
            el('div.grow', {}, [
              el('div.listrow-title', { text: b.title }),
              el('div.listrow-sub', { text: p.name + ' · ' + E.patronTypeName(p.type) +
                ' · copy ' + l.barcode })
            ]),
            UI.dueChip(l.due)
          ]);
        })) : UI.empty('Nothing due today — the desk is clear', '✓')),

      App.section('Holds to pull from the shelves', {
        count: E.pullList().length,
        actions: [el('button.btn.btn-sm', { onclick: function () {
          holds.tab = 'pull'; App.go('holds'); } }, 'Open pull list')]
      }, (function () {
        var list = E.pullList().slice(0, 6);
        return list.length ? el('div.stack', { style: { '--gap': '0' } }, list.map(function (x) {
          return el('div.listrow', { 'data-enter': '' }, [
            el('span.listrow-ic', { text: '◆' }),
            el('div.grow', {}, [
              el('div.listrow-title', { text: x.bib.title }),
              el('div.listrow-sub', { text: x.item.callNo + ' · ' + x.item.shelf +
                ' · for ' + x.patron.name })
            ]),
            el('button.btn.btn-sm', { onclick: function (ev) {
              ev.stopPropagation();
              UI.result(E.trapHold(x.hold.id, x.item.barcode), 'gold');
            } }, 'Capture')
          ]);
        })) : UI.empty('No holds waiting on shelved copies', '◆');
      })())
    ]));

    /* --- quick actions --- */
    mount.appendChild(App.section('Quick actions', { note: 'the ten things the desk does all day' },
      el('div.quickgrid', { 'data-reveal-group': '', 'data-stagger': '45' }, [
        quick('⇄', 'Issue an item', 'Scan a card, scan a barcode', function () {
          circ.tab = 'issue'; App.go('circulation'); }),
        quick('↩', 'Return an item', 'Traps holds, charges overdues', function () {
          circ.tab = 'return'; App.go('circulation'); }),
        quick('↻', 'Renew a loan', 'Checks the renewal cap and hold queue', function () {
          circ.tab = 'renew'; App.go('circulation'); }),
        quick('◆', 'Place a hold', 'Title-level, with a pickup branch', function () {
          App.go('opac'); }),
        quick('⊙', 'Take a payment', 'Cash, card or online', function () { App.go('fines'); }),
        quick('◍', 'Register a member', 'Card, category, expiry', function () {
          App.go('patrons', { register: true }); }),
        quick('▤', 'Catalogue a title', 'Import MARC or create original', function () {
          App.go('catalog', { create: true }); }),
        quick('▣', 'Raise an order', 'Encumbers a fund immediately', function () {
          App.go('acquisitions'); }),
        quick('≣', 'Check in an issue', 'Predicts the next one', function () { App.go('serials'); }),
        quick('◫', 'Run a report', 'Circulation, budget, weeding', function () { App.go('reports'); })
      ])));

    function miniRow(label, n, tone) {
      return el('div.row-between.minirow', {}, [
        el('span.small.muted', {}, [
          el('span.dot' + (tone ? '.tone-' + tone : ''), { style: { marginRight: '8px' } }),
          el('span', { text: label })
        ]),
        el('b.tabnum', { text: U.num(n) })
      ]);
    }
    function quick(icon, title, sub, run) {
      return el('button.quickcard', { 'data-ripple': '', 'data-tilt': '', 'data-tilt-max': '7',
        onclick: run }, [
        el('span.quickcard-ic', { text: icon }),
        el('b', { text: title }),
        el('span.tiny.faint', { text: sub })
      ]);
    }
    function partOfDay() {
      var h = new Date().getHours();
      return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    }
  };

  /* ============================================================
     CIRCULATION
     ============================================================ */

  LS.views.circulation = function (mount, params) {
    if (params && params.barcode) { circ.tab = 'return'; circ.barcode = params.barcode; }
    if (params && params.patronId) { circ.tab = 'issue'; circ.patronId = params.patronId; }

    var s = E.stats();
    mount.appendChild(App.header({
      eyebrow: 'Module 6.4',
      title: 'Circulation desk',
      lede: 'Issue, return and renew. Every action reads the item file, the member file and the ' +
            'policy matrix, then writes one transaction — which the catalogue, the hold queue ' +
            'and the fine ledger all see immediately.'
    }));

    mount.appendChild(UI.tabs({
      active: circ.tab,
      items: [
        { key: 'issue',  label: 'Issue',   icon: '⇄' },
        { key: 'return', label: 'Return',  icon: '↩' },
        { key: 'renew',  label: 'Renew',   icon: '↻' },
        { key: 'recent', label: 'Recent transactions', icon: '▤', badge: s.onLoan }
      ],
      onChange: function (k) { circ.tab = k; App.render('circulation', false); }
    }));

    var pane = el('div.pane', { 'data-enter': '' });
    mount.appendChild(pane);

    if (circ.tab === 'issue')  renderIssue(pane);
    if (circ.tab === 'return') renderReturn(pane);
    if (circ.tab === 'renew')  renderRenew(pane);
    if (circ.tab === 'recent') renderRecent(pane);
  };

  /* ---------------- issue ---------------------------------- */

  function renderIssue(pane) {
    var st = circ.patronId ? E.patronState(circ.patronId) : null;

    var scanCard = App.section('1 · Scan the member card', {
      note: 'card number, name, or pick a demo member'
    }, el('div.stack', { style: { '--gap': '14px' } }, [
      el('div.scanline', {}, [
        el('span.scanline-ic', { text: '◍' }),
        el('input#patron-scan.input.scanline-input', {
          placeholder: 'Scan or type a card number…',
          value: st ? st.patron.cardNo : '',
          onkeydown: function (e) {
            if (e.key !== 'Enter') return;
            var p = E.findPatron(e.target.value);
            if (!p) { UI.toast({ title: 'No member matched “' + e.target.value + '”',
                                 tone: 'danger' }); shake(e.target); return; }
            circ.patronId = p.id; circ.last = null; App.render('circulation', false);
          }
        }),
        el('button.btn.btn-sm', { onclick: function () {
          var v = document.getElementById('patron-scan').value;
          var p = E.findPatron(v);
          if (!p) { UI.toast({ title: 'No member matched', tone: 'danger' }); return; }
          circ.patronId = p.id; circ.last = null; App.render('circulation', false);
        } }, 'Look up')
      ]),
      el('div.row.wrapflex', { style: { '--gap': '7px' } },
        [el('span.tiny.faint', { text: 'Demo members:' })].concat(
          E.db().patrons.slice(0, 6).map(function (p) {
            return el('button.pickchip' + (circ.patronId === p.id ? '.is-active' : ''), {
              onclick: function () { circ.patronId = p.id; circ.last = null;
                                     App.render('circulation', false); }
            }, [
              el('b', { text: p.name.split(' ')[0] }),
              el('span', { text: E.patronTypeName(p.type) })
            ]);
          })))
    ]));
    pane.appendChild(scanCard);

    if (!st) {
      pane.appendChild(el('div.hintbox', { 'data-enter': '' }, [
        el('span.hintbox-ic', { text: '⇡' }),
        el('div', {}, [
          el('b', { text: 'Start by identifying the member.' }),
          el('p.small.muted', { text: 'The policy matrix cannot compute a due date until it ' +
            'knows the member category — a faculty member gets 56 days on a book where an ' +
            'undergraduate gets 14.' })
        ])
      ]));
      return;
    }

    /* --- member standing card --- */
    pane.appendChild(patronStandingCard(st));

    /* --- item scan --- */
    var candidates = E.db().items.filter(function (i) { return i.status === 'available'; }).slice(0, 60);
    pane.appendChild(App.section('2 · Scan the item', {
      note: 'barcode, or pick a copy off the shelf'
    }, el('div.stack', { style: { '--gap': '14px' } }, [
      el('div.scanline', {}, [
        el('span.scanline-ic', { text: '⌗' }),
        el('input#item-scan.input.scanline-input', {
          placeholder: 'Scan a copy barcode…', value: circ.barcode || '',
          onkeydown: function (e) { if (e.key === 'Enter') doIssue(e.target.value); }
        }),
        el('button.btn.btn-primary.btn-sm', { 'data-ripple': '', onclick: function () {
          doIssue(document.getElementById('item-scan').value);
        } }, 'Issue →')
      ]),
      el('div.row.wrapflex', { style: { '--gap': '7px' } },
        [el('span.tiny.faint', { text: 'On the shelf now:' })].concat(
          pickSample(candidates, 6).map(function (i) {
            var b = E.bib(i.bibId);
            return el('button.pickchip', { onclick: function () { doIssue(i.barcode); } }, [
              el('b', { text: b.title.length > 24 ? b.title.slice(0, 23) + '…' : b.title }),
              el('span', { text: i.barcode + ' · ' + E.itemTypeName(i.type) })
            ]);
          }))),
      el('div.row.wrapflex', { style: { '--gap': '7px' } },
        [el('span.tiny.faint', { text: 'Try a blocked case:' })].concat([
          tryChip('Reference copy', function () {
            var r = E.db().items.find(function (i) { return i.status === 'reference'; });
            return r && r.barcode; }),
          tryChip('A copy already out', function () {
            var r = E.db().items.find(function (i) { return i.status === 'out'; });
            return r && r.barcode; }),
          tryChip('Licensed e-book', function () {
            var r = E.db().items.find(function (i) { return i.status === 'licensed'; });
            return r && r.barcode; })
        ]))
    ])));

    if (circ.last) pane.appendChild(issueResult(circ.last));

    function tryChip(label, getBarcode) {
      return el('button.pickchip.pickchip-warn', { onclick: function () {
        var bc = getBarcode();
        if (bc) doIssue(bc);
      } }, [el('b', { text: label })]);
    }
  }

  function doIssue(barcode, override) {
    if (!barcode || !String(barcode).trim()) {
      UI.toast({ title: 'Scan an item barcode first', tone: 'warn' });
      return;
    }
    var res = E.checkout(circ.patronId, String(barcode).trim(), { override: override });
    circ.barcode = '';

    if (!res.ok) {
      UI.toast({
        title: res.msg,
        detail: res.overridable ? 'A supervisor may override this block.' : 'Rule: ' + res.reason,
        tone: res.overridable ? 'warn' : 'danger',
        actions: res.overridable ? [{ label: 'Override', run: function () {
          UI.confirm({
            eyebrow: 'Supervisor override',
            title: 'Override this block?',
            message: res.msg + ' Overrides are written to the audit log against your name.',
            confirmLabel: 'Override and issue', danger: true
          }).then(function (yes) {
            if (!yes) return;
            E.log('Security', 'Override', E.operator.name + ' overrode: ' + res.msg, 'danger');
            doIssue(barcode, true);
          });
        } }] : null
      });
      circ.last = { failed: res };
      App.render('circulation', false);
      return;
    }
    circ.last = res;
    UI.toast({ title: res.msg, detail: res.detail, tone: 'ok' });
    App.render('circulation', false);
  }

  function issueResult(res) {
    if (res.failed) {
      return App.section('Result', { class: 'panel-fail' }, el('div.resultfail', { 'data-enter': '' }, [
        el('span.resultfail-ic', { text: '✕' }),
        el('div', {}, [
          el('b', { text: res.failed.msg }),
          el('p.small.muted', { text: 'Reason code ' + res.failed.reason +
            '. Circulation refuses the transaction rather than writing a half-record — ' +
            'checkout is atomic.' })
        ])
      ]));
    }
    var pol = res.policy;
    return App.section('Issued', { class: 'panel-ok' },
      el('div.issuedone', { 'data-enter': '' }, [
        el('div.grow.stack', { style: { '--gap': '14px' } }, [
          el('div.row', { style: { '--gap': '14px' } }, [
            el('span.bigtick', { text: '✓' }),
            el('div', {}, [
              el('h3.h3', { text: res.bib.title }),
              el('div.small.muted', { text: res.bib.author + ' · copy ' + res.item.barcode })
            ])
          ]),
          UI.kv([
            ['Member', res.patron.name + ' (' + E.patronTypeName(res.patron.type) + ')'],
            ['Due date', el('b.gold', { text: U.fmtDate(res.loan.due) })],
            ['Policy applied', pol.loanDays + '-day loan · max ' + pol.maxItems + ' items · ' +
              pol.renewals + ' renewals · ' + U.money(pol.finePerDay) + '/day after ' +
              pol.graceDays + ' grace days'],
            ['Transaction', res.loan.id],
            ['Closed hold', res.closedHold ? 'Yes — ' + res.closedHold : null]
          ]),
          el('p.tiny.faint', { text:
            'The copy is now “on loan” in the catalogue, the available count on the ' +
            'bibliographic record has dropped, and the statistics have already moved.' })
        ]),
        UI.receipt([
          ['Member', res.patron.name],
          ['Card', res.patron.cardNo],
          ['Title', res.bib.title.length > 26 ? res.bib.title.slice(0, 25) + '…' : res.bib.title],
          ['Barcode', res.item.barcode],
          ['Due', U.fmtDate(res.loan.due)],
          ['Renewals left', String(pol.renewals)]
        ], { sub: res.loan.id + ' · ' + E.branch(res.loan.branch).name })
      ]));
  }

  function patronStandingCard(st) {
    var p = st.patron;
    return el('section.standing' + (st.blocked ? '.is-blocked' : ''), { 'data-enter': '' }, [
      el('div.standing-head', {}, [
        UI.avatar(p.name, 'lg'),
        el('div.grow', {}, [
          el('div.row.wrapflex', { style: { '--gap': '9px' } }, [
            el('h3.h3', { text: p.name }),
            App.patronChip(p),
            st.blocked ? el('span.chip.chip-danger', {}, [el('span.dot.dot-pulse'),
              el('span', { text: 'Blocked' })]) : el('span.chip.chip-ok', { text: 'Good standing' })
          ]),
          el('div.small.muted', { text: 'Card ' + p.cardNo + ' · ' + E.branch(p.branch).name +
            ' · expires ' + U.fmtDate(p.expires) + ' · ' + p.email })
        ]),
        el('button.btn.btn-sm.btn-ghost', {
          onclick: function () { App.go('patrons', { patronId: p.id }); } }, 'Full record')
      ]),
      el('div.standing-stats', {}, [
        standStat(st.loans.length, 'on loan'),
        standStat(st.overdue.length, 'overdue', st.overdue.length ? 'danger' : ''),
        standStat(st.holds.length, 'holds'),
        standStat(U.money(st.outstanding), 'owed', st.outstanding > 0 ? 'warn' : '')
      ]),
      st.blocks.length ? el('div.blocklist', {}, st.blocks.map(function (b) {
        return el('div.blockrow', {}, [
          el('span.blockrow-ic', { text: '⚠' }),
          el('div.grow', {}, [
            el('b.small', { text: b.label }),
            el('div.tiny.faint', { text: 'Block code ' + b.code +
              ' — circulation will refuse until this is cleared or overridden.' })
          ]),
          b.fixable === 'pay' ? el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.payAll(p.id, 'card'), 'ok');
          } }, 'Settle ' + U.money(st.outstanding)) : null,
          b.fixable === 'renew-membership' ? el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.renewMembership(p.id, 12), 'ok');
          } }, 'Renew 12 months') : null,
          b.fixable === 'clear-block' ? el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.setBlock(p.id, null), 'ok');
          } }, 'Clear block') : null
        ]);
      })) : null
    ]);

    function standStat(v, label, tone) {
      return el('div.standstat' + (tone ? '.tone-' + tone : ''), {}, [
        el('b', { text: String(v) }), el('span', { text: label })
      ]);
    }
  }

  /* ---------------- return --------------------------------- */

  function renderReturn(pane) {
    var out = E.db().items.filter(function (i) { return i.status === 'out'; });

    pane.appendChild(App.section('Check in', {
      note: 'one scan, five things happen'
    }, el('div.stack', { style: { '--gap': '14px' } }, [
      el('div.scanline', {}, [
        el('span.scanline-ic', { text: '↩' }),
        el('input#return-scan.input.scanline-input', {
          placeholder: 'Scan the returned copy…', value: circ.barcode || '',
          onkeydown: function (e) { if (e.key === 'Enter') doReturn(e.target.value); }
        }),
        el('button.btn.btn-primary.btn-sm', { 'data-ripple': '', onclick: function () {
          doReturn(document.getElementById('return-scan').value);
        } }, 'Check in')
      ]),
      el('div.row.wrapflex', { style: { '--gap': '7px' } },
        [el('span.tiny.faint', { text: 'Currently out:' })].concat(
          pickSample(out, 7).map(function (i) {
            var b = E.bib(i.bibId);
            var l = E.loanForBarcode(i.barcode);
            var late = l && U.daysBetween(U.today(), new Date(l.due)) < 0;
            return el('button.pickchip' + (late ? '.pickchip-warn' : ''), {
              onclick: function () { doReturn(i.barcode); } }, [
              el('b', { text: b.title.length > 22 ? b.title.slice(0, 21) + '…' : b.title }),
              el('span', { text: late ? 'overdue · ' + i.barcode : i.barcode })
            ]);
          }))),
      el('p.tiny.faint', { text:
        'Returning a title that someone is waiting for will trap the copy for the hold queue ' +
        'instead of reshelving it — try any copy of “Midnight’s Children” or “A Brief History of Time”.' })
    ])));

    if (circ.lastReturn) pane.appendChild(returnResult(circ.lastReturn));

    var bookdrop = E.db().items.filter(function (i) { return i.status === 'in-transit'; });
    if (bookdrop.length) {
      pane.appendChild(App.section('In transit — awaiting receipt', { count: bookdrop.length },
        el('div.stack', { style: { '--gap': '0' } }, bookdrop.map(function (i) {
          var b = E.bib(i.bibId);
          return el('div.listrow', { 'data-enter': '' }, [
            el('span.listrow-ic', { text: '⇢' }),
            el('div.grow', {}, [
              el('div.listrow-title', { text: b.title }),
              el('div.listrow-sub', { text: 'Copy ' + i.barcode + ' · ' + E.branch(i.branch).name +
                ' → ' + E.branch(i.destination || i.homeBranch).name })
            ]),
            el('button.btn.btn-sm', { onclick: function () {
              UI.result(E.receiveTransit(i.barcode), 'ok');
            } }, 'Receive')
          ]);
        }))));
    }
  }

  function doReturn(barcode) {
    if (!barcode || !String(barcode).trim()) {
      UI.toast({ title: 'Scan a barcode first', tone: 'warn' });
      return;
    }
    var res = E.checkin(String(barcode).trim());
    circ.barcode = '';
    if (!res.ok) {
      UI.toast({ title: res.msg, tone: 'danger' });
      return;
    }
    circ.lastReturn = res;
    UI.toast({ title: res.msg, tone: res.fine ? 'warn' : 'ok',
               detail: res.fine ? U.money(res.fine.amount) + ' overdue charge raised'
                                : res.actions[res.actions.length - 1].text });
    App.render('circulation', false);
  }

  function returnResult(res) {
    return App.section('What just happened', { class: 'panel-ok', note: 'one scan · ' +
      res.actions.length + ' downstream effects' },
      el('div.stack', { style: { '--gap': '16px' } }, [
        el('div.row', { style: { '--gap': '14px' } }, [
          el('span.bigtick', { text: '✓' }),
          el('div', {}, [
            el('h3.h3', { text: res.bib.title }),
            el('div.small.muted', { text: 'Copy ' + res.item.barcode +
              (res.patron ? ' · returned by ' + res.patron.name : '') })
          ])
        ]),
        el('ol.effects', {}, res.actions.map(function (a, i) {
          return el('li.effect' + (a.tone ? '.effect-' + a.tone : ''), {
            style: { animationDelay: (i * 140) + 'ms' } }, [
            el('span.effect-ic', { text: a.icon }),
            el('span', { text: a.text })
          ]);
        })),
        res.fine ? el('div.row-between.finebar', {}, [
          el('div', {}, [
            el('b', { text: U.money(res.fine.amount) + ' charged to ' + res.patron.name }),
            el('div.tiny.faint', { text: res.fine.description })
          ]),
          el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.payFine(res.fine.id, undefined, 'cash'), 'ok');
          } }, 'Take payment now')
        ]) : null
      ]));
  }

  /* ---------------- renew ---------------------------------- */

  function renderRenew(pane) {
    var open = E.openLoans().sort(U.by('due'));
    pane.appendChild(App.section('Open loans', {
      count: open.length,
      note: 'renewal is refused when the cap is reached or someone is waiting'
    }, el('div.tbl-scroll', { style: { '--tbl-h': '540px' } },
      el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Title', 'Member', 'Copy', 'Due', 'Renewals', '']
          .map(function (h) { return el('th', { text: h }); }))),
        el('tbody', {}, open.map(function (l) {
          var p = E.patron(l.patronId), b = E.bib(l.bibId), it = E.item(l.barcode);
          var pol = E.policyFor(p.type, it.type);
          var waiting = E.db().holds.filter(function (h) {
            return h.bibId === l.bibId && (h.status === 'waiting' || h.status === 'ready');
          }).length;
          return el('tr', {}, [
            el('td', {}, [
              el('div.small', { text: b.title }),
              el('div.tiny.faint', { text: b.author })
            ]),
            el('td', {}, [
              el('button.linkish', { onclick: function () {
                App.go('patrons', { patronId: p.id }); }, text: p.name }),
              el('div.tiny.faint', { text: E.patronTypeName(p.type) })
            ]),
            el('td.mono.tiny', { text: l.barcode }),
            el('td', {}, UI.dueChip(l.due)),
            el('td', {}, el('span.chip' + (l.renewals >= pol.renewals ? '.chip-warn' : ''), {
              text: l.renewals + ' / ' + pol.renewals })),
            el('td.num', {}, el('button.btn.btn-sm', {
              disabled: l.renewals >= pol.renewals || waiting > 0,
              title: waiting ? waiting + ' member(s) waiting for this title' : '',
              onclick: function () { UI.result(E.renew(l.id), 'ok'); }
            }, waiting ? 'Held' : 'Renew'))
          ]);
        }))
      ]))));
  }

  /* ---------------- recent --------------------------------- */

  function renderRecent(pane) {
    var rows = E.db().loans.slice().sort(U.by(function (l) {
      return l.in || l.out; }, 'desc')).slice(0, 60);
    pane.appendChild(App.section('Transaction file', {
      count: E.db().loans.length,
      note: 'the live “who has what” record'
    }, el('div.tbl-scroll', { style: { '--tbl-h': '620px' } },
      el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Txn', 'Title', 'Member', 'Out', 'Due', 'Returned', 'Channel']
          .map(function (h) { return el('th', { text: h }); }))),
        el('tbody', {}, rows.map(function (l) {
          var p = E.patron(l.patronId), b = E.bib(l.bibId);
          return el('tr', {}, [
            el('td.mono.tiny', { text: l.id }),
            el('td.small', { text: b ? b.title : '—' }),
            el('td.small', { text: p ? p.name : (l.patronId === 'ANON' ? 'anonymised' : '—') }),
            el('td.tiny.muted', { text: U.fmtDateShort(l.out) }),
            el('td.tiny', {}, l.in ? el('span.faint', { text: U.fmtDateShort(l.due) })
                                   : UI.dueChip(l.due)),
            el('td.tiny', {}, l.in
              ? el('span.chip.chip-ok', { text: U.fmtDateShort(l.in) })
              : el('span.chip.chip-info', { text: 'open' })),
            el('td', {}, el('span.chip', { text: l.channel || 'desk' }))
          ]);
        }))
      ]))));
  }

  /* ============================================================
     HOLDS & TRANSIT
     ============================================================ */

  LS.views.holds = function (mount) {
    var db = E.db();
    var pull = E.pullList();
    var ready = db.holds.filter(function (h) { return h.status === 'ready'; });
    var waiting = db.holds.filter(function (h) { return h.status === 'waiting'; });
    var transit = db.items.filter(function (i) { return i.status === 'in-transit'; });

    mount.appendChild(App.header({
      eyebrow: 'Module 6.4 — reservations',
      title: 'Holds & transit',
      lede: 'A hold is placed on the title, not the copy. When a copy is returned or pulled, the ' +
            'first person in the queue gets it, a notice goes out, and the copy stops being ' +
            '“available” even though it is physically in the building.'
    }));

    mount.appendChild(UI.tabs({
      active: holds.tab,
      items: [
        { key: 'queue',   label: 'Queue',       icon: '◆', badge: waiting.length },
        { key: 'pull',    label: 'Pull list',   icon: '⇡', badge: pull.length },
        { key: 'shelf',   label: 'Hold shelf',  icon: '▤', badge: ready.length },
        { key: 'transit', label: 'In transit',  icon: '⇢', badge: transit.length }
      ],
      onChange: function (k) { holds.tab = k; App.render('holds', false); }
    }));

    var pane = el('div.pane', { 'data-enter': '' });
    mount.appendChild(pane);

    if (holds.tab === 'queue') {
      var byBib = U.groupBy(waiting.concat(ready), function (h) { return h.bibId; });
      var keys = Object.keys(byBib);
      pane.appendChild(App.section('Title-level hold queues', { count: keys.length },
        keys.length ? el('div.stack', { style: { '--gap': '14px' } }, keys.map(function (bid) {
          var b = E.bib(bid);
          var a = E.availability(bid);
          var queue = byBib[bid].sort(U.by('placed'));
          return el('div.queuecard', { 'data-enter': '' }, [
            el('div.row-between.wrapflex', {}, [
              el('div', {}, [
                el('b', { text: b.title }),
                el('div.tiny.faint', { text: b.author + ' · ' + a.total + ' copies · ' +
                  a.available + ' on the shelf · ' + a.out + ' on loan' })
              ]),
              el('button.btn.btn-sm.btn-ghost', { onclick: function () {
                App.go('catalog', { bibId: bid }); } }, 'Record')
            ]),
            el('ol.queue', {}, queue.map(function (h, i) {
              var p = E.patron(h.patronId);
              return el('li.queueitem' + (h.status === 'ready' ? '.is-ready' : ''), {
                style: { animationDelay: (i * 70) + 'ms' } }, [
                el('span.queuepos', { text: String(i + 1) }),
                UI.avatar(p.name, 'sm'),
                el('div.grow', {}, [
                  el('div.small', { text: p.name }),
                  el('div.tiny.faint', { text: 'Placed ' + U.fmtDate(h.placed) + ' · pickup at ' +
                    E.branch(h.pickupBranch).name + ' · via ' + h.channel })
                ]),
                h.status === 'ready'
                  ? el('span.chip.chip-gold', { text: 'On shelf to ' + U.fmtDateShort(h.expires) })
                  : el('span.chip', { text: 'Waiting' }),
                el('button.icon-btn', { title: 'Cancel this hold', text: '×',
                  onclick: function () {
                    UI.confirm({ title: 'Cancel hold for ' + p.name + '?',
                      message: 'The next member in the queue is notified automatically.',
                      danger: true, confirmLabel: 'Cancel hold' }).then(function (yes) {
                      if (yes) UI.result(E.cancelHold(h.id, 'Cancelled at the desk'), 'warn');
                    });
                  } })
              ]);
            }))
          ]);
        })) : UI.empty('No one is waiting for anything', '◆')));
    }

    if (holds.tab === 'pull') {
      pane.appendChild(App.section('Today’s pull list', {
        count: pull.length,
        note: 'copies sitting on the shelf that somebody is waiting for',
        actions: pull.length ? [el('button.btn.btn-sm.btn-primary', { 'data-ripple': '',
          onclick: function () {
            var n = 0;
            pull.forEach(function (x) { if (E.trapHold(x.hold.id, x.item.barcode).ok) n++; });
            UI.toast({ tone: 'gold', title: n + ' copies captured',
              detail: 'Each is on its pickup shelf and every member has been notified.' });
          } }, 'Capture all')] : null
      }, pull.length ? el('div.stack', { style: { '--gap': '0' } }, pull.map(function (x) {
        return el('div.listrow', { 'data-enter': '' }, [
          el('span.listrow-ic', { text: '◆' }),
          el('div.grow', {}, [
            el('div.listrow-title', { text: x.bib.title }),
            el('div.listrow-sub', { text: x.item.callNo + ' · ' + E.branch(x.item.branch).name +
              ' · ' + x.item.shelf }),
            el('div.tiny.faint', { text: 'For ' + x.patron.name + ' — pickup at ' +
              E.branch(x.hold.pickupBranch).name +
              (x.hold.pickupBranch !== x.item.branch ? ' (will go into transit)' : '') })
          ]),
          el('span.chip.mono.tiny', { text: x.item.barcode }),
          el('button.btn.btn-sm', { 'data-ripple': '', onclick: function () {
            UI.result(E.trapHold(x.hold.id, x.item.barcode), 'gold');
          } }, 'Capture')
        ]);
      })) : UI.empty('Nothing to pull — every hold is already trapped or waiting on a loan', '✓')));
    }

    if (holds.tab === 'shelf') {
      pane.appendChild(App.section('Pickup shelf', {
        count: ready.length,
        note: 'expires after ' + E.db().settings.holdShelfDays + ' days, then passes to the next member'
      }, ready.length ? el('div.stack', { style: { '--gap': '0' } }, ready.map(function (h) {
        var p = E.patron(h.patronId), b = E.bib(h.bibId);
        var left = U.daysBetween(U.today(), new Date(h.expires));
        return el('div.listrow', { 'data-enter': '' }, [
          UI.avatar(p.name, 'sm'),
          el('div.grow', {}, [
            el('div.listrow-title', { text: b.title }),
            el('div.listrow-sub', { text: p.name + ' · copy ' + h.barcode + ' · ' +
              E.branch(h.pickupBranch).name })
          ]),
          el('span.chip' + (left <= 1 ? '.chip-warn' : '.chip-gold'), {
            text: left < 0 ? 'Expired' : left + ' day' + (left === 1 ? '' : 's') + ' left' }),
          el('button.btn.btn-sm.btn-primary', { onclick: function () {
            circ.patronId = p.id;
            circ.tab = 'issue';
            App.go('circulation');
            setTimeout(function () { doIssue(h.barcode); }, 260);
          } }, 'Issue to member')
        ]);
      })) : UI.empty('The pickup shelf is empty', '▤')));
    }

    if (holds.tab === 'transit') {
      pane.appendChild(App.section('Items moving between branches', {
        count: transit.length,
        note: 'the system tracks the van'
      }, transit.length ? el('div.stack', { style: { '--gap': '0' } }, transit.map(function (i) {
        var b = E.bib(i.bibId);
        var dest = E.branch(i.destination || i.homeBranch);
        return el('div.listrow', { 'data-enter': '' }, [
          el('span.listrow-ic.transit-ic', { text: '⇢' }),
          el('div.grow', {}, [
            el('div.listrow-title', { text: b.title }),
            el('div.listrow-sub', {}, [
              el('span', { text: E.branch(i.branch).name }),
              el('span.transit-arrow', { text: ' ⟶ ' }),
              el('b', { text: dest.name }),
              el('span.faint', { text: ' · ' + dest.transitDays + ' day van run' })
            ])
          ]),
          el('span.chip.mono.tiny', { text: i.barcode }),
          el('button.btn.btn-sm', { onclick: function () {
            UI.result(E.receiveTransit(i.barcode), 'ok');
          } }, 'Receive at ' + dest.code)
        ]);
      })) : UI.empty('Nothing is in transit', '⇢')));
    }
  };

  /* ============================================================
     FINES & FEES
     ============================================================ */

  LS.views.fines = function (mount) {
    var db = E.db();
    var open = db.fines.filter(function (f) { return f.status === 'outstanding'; });
    var settled = db.fines.filter(function (f) { return f.status !== 'outstanding'; });
    var total = U.sum(open, function (f) { return f.amount - f.paidAmount; });

    mount.appendChild(App.header({
      eyebrow: 'Module 6.4 — charges',
      title: 'Fines & fees',
      lede: 'Overdue charges accrue nightly at a rate the policy matrix sets, capped per item. ' +
            'Cross ' + U.money(db.settings.blockThreshold) + ' outstanding and circulation blocks ' +
            'the member automatically until it is paid or waived.',
      actions: [
        el('button.btn', { onclick: openCharge }, '＋ Add a charge'),
        el('button.btn.btn-primary', { 'data-ripple': '', onclick: function () {
          App.go('notices');
        } }, 'Run the nightly job')
      ]
    }));

    mount.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
      UI.stat({ label: 'Outstanding', count: Math.round(total), prefix: '₹',
        tone: total > 0 ? 'warn' : 'ok', foot: open.length + ' open charges' }),
      UI.stat({ label: 'Blocked members', count: db.patrons.filter(function (p) {
        return E.outstanding(p.id) >= db.settings.blockThreshold; }).length,
        tone: 'danger', foot: 'Above the ' + U.money(db.settings.blockThreshold) + ' threshold' }),
      UI.stat({ label: 'Collected', count: Math.round(U.sum(db.fines.filter(function (f) {
        return f.status === 'paid'; }), function (f) { return f.paidAmount; })), prefix: '₹',
        tone: 'ok', foot: 'Cash, card and online' }),
      UI.stat({ label: 'Waived', count: Math.round(U.sum(db.fines.filter(function (f) {
        return f.status === 'waived'; }), function (f) { return f.amount; })), prefix: '₹',
        foot: 'Every waiver is in the audit log' })
    ]));

    mount.appendChild(UI.tabs({
      active: fines.tab,
      items: [
        { key: 'outstanding', label: 'Outstanding', icon: '⊙', badge: open.length },
        { key: 'bymember',    label: 'By member',   icon: '◍' },
        { key: 'settled',     label: 'Settled',     icon: '✓', badge: settled.length }
      ],
      onChange: function (k) { fines.tab = k; App.render('fines', false); }
    }));

    var pane = el('div.pane', { 'data-enter': '' });
    mount.appendChild(pane);

    if (fines.tab === 'outstanding') {
      pane.appendChild(App.section('Open charges', { count: open.length },
        open.length ? el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, ['Charge', 'Member', 'Type', 'Raised', 'Amount', '']
            .map(function (h) { return el('th', { text: h }); }))),
          el('tbody', {}, open.sort(U.by('created', 'desc')).map(function (f) {
            var p = E.patron(f.patronId);
            return el('tr', { 'data-enter': '' }, [
              el('td', {}, [
                el('div.small', { text: f.description }),
                el('div.tiny.faint.mono', { text: f.id + (f.ref ? ' · ' + f.ref : '') })
              ]),
              el('td', {}, el('button.linkish', { text: p.name, onclick: function () {
                App.go('patrons', { patronId: p.id }); } })),
              el('td', {}, el('span.chip.chip-' + fineTone(f.type), { text: f.type })),
              el('td.tiny.muted', { text: U.fmtDate(f.created) }),
              el('td.num', {}, el('b', { text: U.money(f.amount - f.paidAmount) })),
              el('td.num', {}, el('div.row', { style: { '--gap': '6px', justifyContent: 'flex-end' } }, [
                el('button.btn.btn-sm', { onclick: function () { takePayment(f); } }, 'Pay'),
                el('button.btn.btn-sm.btn-ghost', { onclick: function () {
                  UI.form({
                    eyebrow: 'Waiver', title: 'Waive ' + U.money(f.amount - f.paidAmount) + '?',
                    intro: 'Waivers are written to the audit log against your name and role.',
                    submitLabel: 'Waive charge',
                    fields: [{ name: 'reason', label: 'Reason', type: 'select',
                      options: ['Library error', 'Item was returned on time', 'Bereavement / illness',
                                'Goodwill — first offence', 'Supervisor discretion'] }]
                  }).then(function (d) { if (d) UI.result(E.waiveFine(f.id, d.reason), 'warn'); });
                } }, 'Waive')
              ]))
            ]);
          }))
        ]) : UI.empty('Nothing outstanding — every account is clear', '✓')));
    }

    if (fines.tab === 'bymember') {
      var groups = U.groupBy(open, function (f) { return f.patronId; });
      var ids = Object.keys(groups).sort(function (a, b) {
        return U.sum(groups[b], function (f) { return f.amount - f.paidAmount; }) -
               U.sum(groups[a], function (f) { return f.amount - f.paidAmount; });
      });
      pane.appendChild(App.section('Members with charges', { count: ids.length },
        ids.length ? el('div.stack', { style: { '--gap': '12px' } }, ids.map(function (id) {
          var p = E.patron(id);
          var owed = U.sum(groups[id], function (f) { return f.amount - f.paidAmount; });
          var blocked = owed >= db.settings.blockThreshold;
          return el('div.debtcard' + (blocked ? '.is-blocked' : ''), { 'data-enter': '' }, [
            el('div.row-between.wrapflex', {}, [
              el('div.row', { style: { '--gap': '12px' } }, [
                UI.avatar(p.name),
                el('div', {}, [
                  el('b', { text: p.name }),
                  el('div.tiny.faint', { text: E.patronTypeName(p.type) + ' · card ' + p.cardNo })
                ])
              ]),
              el('div.row', { style: { '--gap': '10px' } }, [
                blocked ? el('span.chip.chip-danger', {}, [el('span.dot.dot-pulse'),
                  el('span', { text: 'Circulation blocked' })]) : null,
                el('b.gold', { text: U.money(owed) }),
                el('button.btn.btn-sm.btn-primary', { onclick: function () {
                  UI.result(E.payAll(id, 'card'), 'ok');
                } }, 'Settle all')
              ])
            ]),
            el('ul.debtlines', {}, groups[id].map(function (f) {
              return el('li', {}, [
                el('span.small.muted', { text: f.description }),
                el('b.tiny', { text: U.money(f.amount - f.paidAmount) })
              ]);
            })),
            UI.meter([
              { label: 'Owed', value: Math.min(owed, db.settings.blockThreshold),
                colour: blocked ? 'var(--danger)' : 'var(--gold)' },
              { label: 'Headroom', value: Math.max(0, db.settings.blockThreshold - owed),
                colour: 'var(--surface-hi)' }
            ], { total: db.settings.blockThreshold })
          ]);
        })) : UI.empty('No member owes anything', '✓')));
    }

    if (fines.tab === 'settled') {
      pane.appendChild(App.section('Settled charges', { count: settled.length },
        settled.length ? el('table.tbl', {}, [
          el('thead', {}, el('tr', {}, ['Charge', 'Member', 'Amount', 'Outcome', 'When']
            .map(function (h) { return el('th', { text: h }); }))),
          el('tbody', {}, settled.sort(U.by(function (f) {
            return f.paidOn || f.waivedOn; }, 'desc')).map(function (f) {
            var p = E.patron(f.patronId);
            return el('tr', {}, [
              el('td.small', { text: f.description }),
              el('td.small', { text: p ? p.name : '—' }),
              el('td.num', { text: U.money(f.amount) }),
              el('td', {}, el('span.chip.chip-' + (f.status === 'paid' ? 'ok' : 'warn'), {
                text: f.status === 'paid' ? 'Paid · ' + (f.method || 'cash') : 'Waived' })),
              el('td.tiny.muted', { text: U.fmtDate(f.paidOn || f.waivedOn) })
            ]);
          }))
        ]) : UI.empty('Nothing settled yet', '◎')));
    }

    function takePayment(f) {
      var owing = f.amount - f.paidAmount;
      UI.form({
        eyebrow: 'Payment', title: 'Take payment',
        intro: f.description + ' — ' + U.money(owing) + ' outstanding.',
        submitLabel: 'Record payment',
        fields: [
          { name: 'amount', label: 'Amount received', type: 'number', value: owing.toFixed(2) },
          { name: 'method', label: 'Method', type: 'select',
            options: ['cash', 'card', 'online', 'UPI'] }
        ]
      }).then(function (d) {
        if (!d) return;
        UI.result(E.payFine(f.id, parseFloat(d.amount), d.method), 'ok');
      });
    }

    function openCharge() {
      UI.form({
        eyebrow: 'Manual charge', title: 'Add a charge',
        intro: 'Damage, replacement, membership fees and printing all sit in the same ledger.',
        submitLabel: 'Raise charge',
        fields: [
          { name: 'patronId', label: 'Member', type: 'select',
            options: db.patrons.map(function (p) {
              return { value: p.id, label: p.name + ' — ' + p.cardNo }; }) },
          { name: 'type', label: 'Charge type', type: 'select',
            options: ['damage', 'replacement', 'membership', 'printing', 'fee'] },
          { name: 'amount', label: 'Amount (₹)', type: 'number', value: '250' },
          { name: 'description', label: 'Description', placeholder: 'What is this for?' }
        ]
      }).then(function (d) {
        if (!d) return;
        UI.result(E.addManualCharge(d.patronId, d.type, parseFloat(d.amount), d.description), 'warn');
      });
    }

    function fineTone(t) {
      return t === 'overdue' ? 'warn' : t === 'lost' ? 'danger' :
             t === 'damage' ? 'danger' : 'info';
    }
  };

  /* ============================================================
     helpers shared in this file
     ============================================================ */

  function pickSample(list, n) {
    var out = [], step = Math.max(1, Math.floor(list.length / n));
    for (var i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
    return out;
  }
  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
  }

  LS.desk = { circ: circ, holds: holds, fines: fines, doIssue: doIssue, doReturn: doReturn };
})(window);
