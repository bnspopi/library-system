/* ============================================================
   views-system.js — Reports, Notices & jobs, Administration
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine, UI = LS.UI, App = LS.App;
  var el = U.el;

  var rep = { tab: 'circulation' };
  var adm = { tab: 'policies' };

  /* ============================================================
     REPORTS
     ============================================================ */

  LS.views.reports = function (mount) {
    var s = E.stats();

    mount.appendChild(App.header({
      eyebrow: 'Module 6.9',
      title: 'Reports & statistics',
      lede: 'Nothing here is entered by hand. Every figure is derived from the same transaction, ' +
            'item and fund records the desk has been writing all day.',
      actions: [el('button.btn', { onclick: exportCsv }, '⇣ Export CSV')]
    }));

    mount.appendChild(UI.tabs({
      active: rep.tab,
      items: [
        { key: 'circulation', label: 'Circulation', icon: '⇄' },
        { key: 'collection',  label: 'Collection use', icon: '▤' },
        { key: 'budget',      label: 'Budget', icon: '▣' },
        { key: 'inventory',   label: 'Stock verification', icon: '◫' },
        { key: 'branches',    label: 'Branches', icon: '⌂' }
      ],
      onChange: function (k) { rep.tab = k; App.render('reports', false); }
    }));

    var pane = el('div.pane', { 'data-enter': '' });
    mount.appendChild(pane);

    /* ---------------- circulation ------------------------- */
    if (rep.tab === 'circulation') {
      var days = E.circByDay(21);
      var totalIssues = U.sum(days, function (d) { return d.issues; });
      var totalReturns = U.sum(days, function (d) { return d.returns; });
      var busiest = days.slice().sort(U.by('issues', 'desc'))[0];

      pane.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
        UI.stat({ label: 'Issues, 21 days', count: totalIssues,
          foot: 'Average ' + Math.round(totalIssues / 21) + ' a day',
          spark: days.map(function (d) { return d.issues; }) }),
        UI.stat({ label: 'Returns, 21 days', count: totalReturns,
          foot: 'Includes self-service book drop',
          spark: days.map(function (d) { return d.returns; }) }),
        UI.stat({ label: 'Busiest day', value: busiest.label,
          foot: busiest.issues + ' issues' }),
        UI.stat({ label: 'Self-service share',
          count: U.pct(E.db().loans.filter(function (l) {
            return l.channel === 'self-check'; }).length, E.db().loans.length),
          suffix: '%', foot: 'SIP2 kiosks and RFID gates' })
      ]));

      pane.appendChild(App.section('Issues and returns — 21 days', {
        actions: [el('span.legend', {}, [
          el('i.legend-a'), el('span', { text: 'Issues' }),
          el('i.legend-b'), el('span', { text: 'Returns' })
        ])]
      }, UI.barChart(days.map(function (d) {
        return { label: d.label.split(' ')[0], value: d.issues, value2: d.returns };
      }), { height: 190 })));

      var byHour = {};
      E.db().loans.forEach(function (l) {
        var h = new Date(l.out).getHours();
        byHour[h] = (byHour[h] || 0) + 1;
      });
      var hours = [];
      for (var h = 8; h <= 21; h++) hours.push({ h: h, n: byHour[h] || 0 });
      var maxH = Math.max.apply(null, hours.map(function (x) { return x.n; }).concat([1]));

      pane.appendChild(el('div.grid-2', {}, [
        App.section('Issues by hour of day', { note: 'when to staff the desk' },
          el('div.heat', {}, hours.map(function (x, i) {
            return el('div.heatcell', {
              style: { '--heat': (x.n / maxH).toFixed(3), animationDelay: (i * 40) + 'ms' },
              title: x.n + ' issues at ' + x.h + ':00'
            }, [
              el('b', { text: String(x.n) }),
              el('span', { text: (x.h > 12 ? x.h - 12 : x.h) + (x.h >= 12 ? 'p' : 'a') })
            ]);
          }))),

        App.section('By member category', {}, el('div.stack', { style: { '--gap': '12px' } },
          E.db().patronTypes.map(function (t) {
            var n = E.db().loans.filter(function (l) {
              var p = E.patron(l.patronId);
              return p && p.type === t.code;
            }).length;
            var total = E.db().loans.length || 1;
            return el('div', {}, [
              el('div.row-between', {}, [
                el('span.small', { text: t.name }),
                el('span.tiny.faint', { text: n + ' loans · ' + U.pct(n, total) + '%' })
              ]),
              el('div.trackbar', {}, el('span', {
                style: { width: U.pct(n, total) + '%' } }))
            ]);
          })))
      ]));
    }

    /* ---------------- collection use ---------------------- */
    if (rep.tab === 'collection') {
      var top = E.topTitles(10);
      var dead = E.deadStock();

      pane.appendChild(App.section('Most borrowed titles', {
        note: 'lifetime circulations across every copy'
      }, el('div.stack', { style: { '--gap': '11px' } }, top.map(function (t, i) {
        var max = top[0].circs || 1;
        return el('button.ranrow', { 'data-enter': '', 'data-ripple': '',
          onclick: function () { App.go('catalog', { bibId: t.bib.id }); } }, [
          el('span.ranpos', { text: String(i + 1) }),
          el('div.grow', {}, [
            el('div.row-between', {}, [
              el('b.small', { text: t.bib.title }),
              el('span.tiny.faint', { text: t.circs + ' circs · ' + t.copies + ' copies' +
                (t.holds ? ' · ' + t.holds + ' waiting' : '') })
            ]),
            el('div.trackbar', {}, el('span', {
              style: { width: U.pct(t.circs, max) + '%', animationDelay: (i * 60) + 'ms' } }))
          ])
        ]);
      }))));

      pane.appendChild(App.section('Weeding candidates', {
        count: dead.length,
        note: 'on the shelf over a year, never issued once'
      }, dead.length ? el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Title', 'Copy', 'Branch', 'Added', 'Call number', '']
          .map(function (hh) { return el('th', { text: hh }); }))),
        el('tbody', {}, dead.map(function (d) {
          return el('tr', { 'data-enter': '' }, [
            el('td.small', { text: d.bib.title }),
            el('td.mono.tiny', { text: d.item.barcode }),
            el('td.tiny', { text: d.item.branch }),
            el('td.tiny.muted', { text: U.fmtDate(d.item.added) }),
            el('td.tiny.mono', { text: d.item.callNo }),
            el('td.num', {}, el('button.btn.btn-sm.btn-danger', { onclick: function () {
              UI.confirm({ eyebrow: 'Weeding', title: 'Withdraw this copy?',
                message: d.bib.title + ' (' + d.item.barcode + '). The bibliographic record ' +
                         'stays if other copies remain.',
                confirmLabel: 'Withdraw', danger: true }).then(function (yes) {
                if (yes) UI.result(E.setItemStatus(d.item.barcode, 'withdrawn',
                  'Withdrawn — no circulation in over a year'), 'warn');
              });
            } }, 'Withdraw'))
          ]);
        }))
      ]) : UI.empty('Every copy has circulated at least once', '✓')));

      pane.appendChild(App.section('Collection composition', {},
        el('div.stack', { style: { '--gap': '14px' } },
          E.db().itemTypes.map(function (t) {
            var items = E.db().items.filter(function (i) { return i.type === t.code; });
            if (!items.length) return null;
            var out = items.filter(function (i) { return i.status === 'out'; }).length;
            return el('div', {}, [
              el('div.row-between', {}, [
                el('b.small', { text: t.name }),
                el('span.tiny.faint', { text: items.length + ' copies · ' + out + ' out · ' +
                  U.pct(out, items.length) + '% turnover' })
              ]),
              UI.meter([
                { label: 'On loan', value: out, colour: 'var(--gold)' },
                { label: 'On shelf', value: items.length - out, colour: 'var(--surface-hi)' }
              ], { total: items.length })
            ]);
          }).filter(Boolean))));
    }

    /* ---------------- budget ------------------------------ */
    if (rep.tab === 'budget') {
      var funds = E.db().funds;
      pane.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
        UI.stat({ label: 'Allocated', count: Math.round(s.budgetAllocated / 100000),
          prefix: '₹', suffix: 'L', decimals: 1, foot: 'Financial year 2026' }),
        UI.stat({ label: 'Encumbered', count: Math.round(s.budgetEncumbered / 100000),
          prefix: '₹', suffix: 'L', decimals: 1, tone: 'gold',
          foot: 'Committed on open orders' }),
        UI.stat({ label: 'Spent', count: Math.round(s.budgetSpent / 100000),
          prefix: '₹', suffix: 'L', decimals: 1, tone: 'ok', foot: 'Invoices posted' }),
        UI.stat({ label: 'Free', count: Math.round((s.budgetAllocated - s.budgetEncumbered -
          s.budgetSpent) / 100000), prefix: '₹', suffix: 'L', decimals: 1,
          foot: 'Still uncommitted' })
      ]));

      pane.appendChild(App.section('Fund by fund', { flush: true }, el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Fund', 'Allocated', 'Encumbered', 'Spent', 'Free',
          'Committed'].map(function (hh) { return el('th', { text: hh }); }))),
        el('tbody', {}, funds.map(function (f) {
          var free = f.allocated - f.encumbered - f.spent;
          var used = U.pct(f.encumbered + f.spent, f.allocated);
          return el('tr', { 'data-enter': '' }, [
            el('td', {}, [el('div.small', { text: f.name }),
              el('div.tiny.faint.mono', { text: f.code })]),
            el('td.num.tiny', { text: U.money0(f.allocated) }),
            el('td.num.tiny.gold', { text: U.money0(f.encumbered) }),
            el('td.num.tiny', { text: U.money0(f.spent) }),
            el('td.num.tiny', { text: U.money0(free) }),
            el('td', {}, el('div.row', { style: { '--gap': '10px' } }, [
              el('div.trackbar.grow', {}, el('span', { style: { width: used + '%',
                background: used > 90 ? 'var(--danger)' : 'linear-gradient(90deg,var(--gold-deep),var(--gold))' } })),
              el('b.tiny.tabnum', { text: used + '%' })
            ]))
          ]);
        }))
      ])));

      pane.appendChild(App.section('Spend by vendor', {}, el('div.stack', { style: { '--gap': '12px' } },
        E.db().vendors.map(function (v) {
          var orders = E.db().orders.filter(function (o) { return o.vendor === v.code; });
          var value = U.sum(orders, function (o) { return o.total; });
          var maxV = Math.max.apply(null, E.db().vendors.map(function (x) {
            return U.sum(E.db().orders.filter(function (o) { return o.vendor === x.code; }),
              function (o) { return o.total; }); }).concat([1]));
          return el('div', {}, [
            el('div.row-between', {}, [
              el('span.small', { text: v.name }),
              el('span.tiny.faint', { text: orders.length + ' orders · ' + U.money0(value) +
                ' · ' + v.leadDays + '-day lead · ' + (v.edi ? 'EDI' : 'email') })
            ]),
            el('div.trackbar', {}, el('span', { style: { width: U.pct(value, maxV) + '%' } }))
          ]);
        }))));
    }

    /* ---------------- inventory --------------------------- */
    if (rep.tab === 'inventory') {
      var stale = E.db().items.filter(function (i) {
        return U.daysBetween(new Date(i.lastSeen), U.today()) > 120 &&
               i.status === 'available';
      });
      pane.appendChild(el('div.hintbox', { 'data-enter': '' }, [
        el('span.hintbox-ic', { text: '◫' }),
        el('div', {}, [
          el('b', { text: 'Stock verification' }),
          el('p.small.muted', { text: 'Staff walk the shelves with an RFID wand or a barcode ' +
            'scanner. Anything the system believes is available but which has not been seen for ' +
            'months is flagged: it is either mis-shelved, stolen, or was never discharged properly.' })
        ])
      ]));

      pane.appendChild(el('div.statgrid', { 'data-reveal-group': '' }, [
        UI.stat({ label: 'Copies in stock', count: E.db().items.length }),
        UI.stat({ label: 'Not seen in 120 days', count: stale.length,
          tone: stale.length ? 'warn' : 'ok', foot: 'Shelf-check candidates' }),
        UI.stat({ label: 'Marked lost', count: s.lost, tone: s.lost ? 'danger' : 'ok',
          foot: 'Billed to members' }),
        UI.stat({ label: 'Withdrawn', count: E.db().items.filter(function (i) {
          return i.status === 'withdrawn'; }).length, foot: 'Removed from the collection' })
      ]));

      pane.appendChild(App.section('Shelf-check list', { count: stale.length, flush: true },
        stale.length ? el('div.tbl-scroll', { style: { '--tbl-h': '440px' } },
          el('table.tbl', {}, [
            el('thead', {}, el('tr', {}, ['Copy', 'Title', 'Call number', 'Branch', 'Shelf',
              'Last seen', ''].map(function (hh) { return el('th', { text: hh }); }))),
            el('tbody', {}, stale.map(function (i) {
              var b = E.bib(i.bibId);
              return el('tr', { 'data-enter': '' }, [
                el('td.mono.tiny', { text: i.barcode }),
                el('td.small', { text: b.title }),
                el('td.tiny.mono', { text: i.callNo }),
                el('td.tiny', { text: i.branch }),
                el('td.tiny.faint', { text: i.shelf }),
                el('td.tiny.muted', { text: U.fmtDate(i.lastSeen) }),
                el('td.num', {}, el('button.btn.btn-sm', { onclick: function () {
                  i.lastSeen = U.iso(LS.clock.now());
                  E.log('Inventory', 'Shelf check', b.title + ' (' + i.barcode +
                    ') sighted on the shelf', 'ok');
                  UI.toast({ title: 'Sighted — ' + b.title, tone: 'ok',
                    detail: 'Last-seen date updated to today' });
                  E.recompute();
                } }, 'Mark sighted'))
              ]);
            }))
          ])) : UI.empty('Every available copy has been seen recently', '✓')));
    }

    /* ---------------- branches ---------------------------- */
    if (rep.tab === 'branches') {
      pane.appendChild(el('div.branchgrid', { 'data-reveal-group': '', 'data-stagger': '90' },
        E.branchStats().map(function (b) {
          return el('div.card.card-hover.branchcard', { 'data-tilt': '', 'data-tilt-max': '6',
            'data-spotlight': '' }, [
            el('div.row-between', {}, [
              el('div', {}, [
                el('h3.h3', { text: b.branch.name }),
                el('div.tiny.faint', { text: b.branch.hours })
              ]),
              el('span.chip.chip-gold.mono', { text: b.branch.code })
            ]),
            el('div.branchstats', {}, [
              bstat(b.items, 'copies'), bstat(b.onLoan, 'on loan'),
              bstat(b.available, 'on shelf'), bstat(b.patrons, 'members'),
              bstat(b.holds, 'holds')
            ]),
            UI.meter([
              { label: 'On loan', value: b.onLoan, colour: 'var(--gold)' },
              { label: 'Available', value: b.available, colour: 'var(--gold-deep)' },
              { label: 'Other', value: Math.max(0, b.items - b.onLoan - b.available),
                colour: 'var(--surface-hi)' }
            ], { total: b.items }),
            el('div.tiny.faint', { style: { marginTop: '12px' },
              text: b.branch.transitDays === 0
                ? 'Hub branch — no transit delay'
                : b.branch.transitDays + '-day van run from the hub' })
          ]);
        })));

      function bstat(v, l) {
        return el('div.bstat', {}, [el('b', { 'data-count': v }, '0'), el('span', { text: l })]);
      }
    }

    function exportCsv() {
      var rows = [['Transaction', 'Title', 'Member', 'Category', 'Out', 'Due', 'Returned', 'Channel']];
      E.db().loans.forEach(function (l) {
        var p = E.patron(l.patronId), b = E.bib(l.bibId);
        rows.push([l.id, b ? b.title : '', p ? p.name : l.patronId,
          p ? E.patronTypeName(p.type) : '', U.iso(l.out), l.due,
          l.in ? U.iso(l.in) : '', l.channel || 'desk']);
      });
      var csv = rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      var a = el('a', { href: url, download: 'aurelia-circulation.csv' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      UI.toast({ title: 'Circulation export downloaded',
        detail: (rows.length - 1) + ' transactions as CSV', tone: 'ok' });
    }
  };

  /* ============================================================
     NOTICES & AUTOMATED JOBS
     ============================================================ */

  LS.views.notices = function (mount) {
    var db = E.db();

    mount.appendChild(App.header({
      eyebrow: 'Module 6.8',
      title: 'Notices & scheduled jobs',
      lede: 'Nobody sits at a desk at two in the morning deciding who is overdue. A scheduler ' +
            'walks the transaction file every night, accrues charges, expires stale holds and ' +
            'hands a batch of messages to the email and SMS gateway.',
      actions: [
        el('button.btn.btn-primary', { 'data-ripple': '', onclick: runJob }, '▶ Run the nightly job'),
        el('button.btn', { onclick: function () {
          var n = E.advanceDays(7);
          UI.toast({ tone: 'gold', title: 'Seven days elapsed',
            detail: n.fines + ' charges accrued · ' + (n.overdueNotices + n.dueSoon +
              n.holdReminders + n.membershipWarnings) + ' notices sent · ' +
              n.expiredHolds + ' holds expired' });
          App.refresh();
        } }, '⏩ Skip a week')
      ]
    }));

    /* --- scheduled jobs --- */
    var JOBS = [
      ['02:00', 'Accrue overdue charges', 'Walks every open loan, applies the fine rate and cap ' +
        'from the policy matrix past the grace period.'],
      ['02:10', 'Overdue notices', 'First notice on day one, then weekly until the item comes back.'],
      ['02:15', 'Due-soon reminders', 'Two days before the due date, so nobody is surprised.'],
      ['02:20', 'Hold shelf sweep', 'Expires uncollected holds and passes the copy to the next ' +
        'member in the queue.'],
      ['02:30', 'Membership expiry warnings', 'Thirty days out, then again on the day.'],
      ['03:00', 'Vendor claims', 'Chases orders past their lead time and serial issues that ' +
        'never arrived.'],
      ['03:30', 'Statistics rebuild', 'Refreshes the counts every report reads.'],
      ['04:00', 'Off-site replica', 'Losing the circulation database on a Monday morning is a ' +
        'disaster, so it is replicated nightly.']
    ];

    mount.appendChild(App.section('The nightly schedule', {
      note: 'runs while the building is dark'
    }, el('ol.joblist', { 'data-reveal-group': '', 'data-stagger': '55' },
      JOBS.map(function (j) {
        return el('li.jobrow', {}, [
          el('span.jobtime.mono', { text: j[0] }),
          el('div.grow', {}, [
            el('b.small', { text: j[1] }),
            el('div.tiny.faint', { text: j[2] })
          ]),
          el('span.chip.chip-ok', {}, [el('span.dot'), el('span', { text: 'Scheduled' })])
        ]);
      }))));

    /* --- notice log --- */
    var CHANNEL_IC = { email: '✉', sms: '▭' };
    mount.appendChild(App.section('Notice log', {
      count: db.notices.length,
      note: 'what the gateway actually sent'
    }, db.notices.length ? el('div.tbl-scroll', { style: { '--tbl-h': '520px' } },
      el('div.stack', { style: { '--gap': '0' } }, db.notices.slice(0, 60).map(function (n) {
        var p = E.patron(n.patronId);
        return el('div.noticerow', { 'data-enter': '' }, [
          el('span.noticeic.noticeic-' + n.type, { text: CHANNEL_IC[n.channel] || '✉' }),
          el('div.grow', {}, [
            el('div.row-between.wrapflex', {}, [
              el('b.small', { text: n.subject }),
              el('span.tiny.faint', { text: U.fmtDate(n.sentAt) + ' · ' + U.fmtTime(n.sentAt) })
            ]),
            el('div.tiny.muted', { text: n.body }),
            el('div.tiny.faint', { text: (p ? p.name : '—') + ' · ' + n.channel + ' · ' + n.to })
          ]),
          el('span.chip.chip-' + noticeTone(n.type), { text: n.type })
        ]);
      }))) : UI.empty('No notices sent yet — run the nightly job', '✉')));

    function noticeTone(t) {
      return t === 'overdue' ? 'danger' : t === 'hold-ready' ? 'gold' :
             t === 'due-soon' ? 'warn' : t === 'lost' ? 'danger' : 'info';
    }

    function runJob() {
      var host = el('div.joboutput');
      var box = UI.modal({
        eyebrow: 'Scheduler',
        title: 'Nightly job — ' + U.fmtDate(LS.clock.now()),
        size: 'md',
        body: host,
        actions: [{ label: 'Close', primary: true }]
      });
      host.appendChild(UI.skeleton(4));

      setTimeout(function () {
        var r = E.runNightly();
        host.innerHTML = '';
        var lines = [
          ['⊙', r.fines + ' overdue charges accrued', U.money(r.fineTotal) + ' added to the ledger',
            r.fines ? 'warn' : 'ok'],
          ['✉', r.overdueNotices + ' overdue notices', 'first on day one, then weekly', 'danger'],
          ['✉', r.dueSoon + ' due-soon reminders', 'sent two days ahead', 'warn'],
          ['◆', r.holdReminders + ' hold notices', 'pickup shelf reminders and new captures', 'gold'],
          ['⌛', r.expiredHolds + ' holds expired', 'copy passed to the next member in the queue',
            r.expiredHolds ? 'warn' : 'ok'],
          ['◍', r.membershipWarnings + ' membership warnings', 'expiring within thirty days', 'info'],
          ['▣', r.claims + ' claims raised', 'late vendor orders and missing serial issues', 'info']
        ];
        lines.forEach(function (l, i) {
          host.appendChild(el('div.jobline.jobline-' + l[3], {
            style: { animationDelay: (i * 110) + 'ms' } }, [
            el('span.jobline-ic', { text: l[0] }),
            el('div.grow', {}, [el('b.small', { text: l[1] }),
              el('div.tiny.faint', { text: l[2] })]),
            el('span.jobline-tick', { text: '✓' })
          ]));
        });
        host.appendChild(el('p.tiny.faint', { style: { marginTop: '16px' },
          text: 'Every one of those writes landed in the same database the desk uses. Reload the ' +
                'fines module and the numbers have already moved.' }));
        App.refresh();
      }, Motion && Motion.reduced ? 0 : 900);
    }
  };

  /* ============================================================
     ADMINISTRATION
     ============================================================ */

  LS.views.admin = function (mount) {
    var db = E.db();

    mount.appendChild(App.header({
      eyebrow: 'Module 6.9 — configuration',
      title: 'Administration',
      lede: 'The policy matrix below is the real brain of circulation. Change a number in it and ' +
            'every future due date, loan cap, renewal allowance and fine calculation changes ' +
            'with it — without touching a line of code.'
    }));

    mount.appendChild(UI.tabs({
      active: adm.tab,
      items: [
        { key: 'policies', label: 'Policy matrix', icon: '⚖' },
        { key: 'calendar', label: 'Calendar', icon: '▦' },
        { key: 'settings', label: 'Settings', icon: '⚙' },
        { key: 'security', label: 'Roles & audit', icon: '⛨' }
      ],
      onChange: function (k) { adm.tab = k; App.render('admin', false); }
    }));

    var pane = el('div.pane', { 'data-enter': '' });
    mount.appendChild(pane);

    /* ---------------- policy matrix ----------------------- */
    if (adm.tab === 'policies') {
      pane.appendChild(el('div.hintbox', { 'data-enter': '' }, [
        el('span.hintbox-ic', { text: '⚖' }),
        el('div', {}, [
          el('b', { text: 'Why two people get different due dates' }),
          el('p.small.muted', { text: 'Checkout is never “14 days for everyone”. The engine ' +
            'resolves member category × item type, then adjusts for the calendar, existing ' +
            'blocks and the hold queue. The result is a due date, a renewal cap and a fine formula.' })
        ])
      ]));

      pane.appendChild(App.section('Circulation policy matrix', {
        count: db.policies.length,
        note: 'every row is live — edit one and re-issue something',
        flush: true
      }, el('div.tbl-scroll', { style: { '--tbl-h': '560px' } }, el('table.tbl.tbl-matrix', {}, [
        el('thead', {}, el('tr', {}, ['Member category', 'Item type', 'Loan days', 'Max items',
          'Renewals', 'Grace', 'Fine / day', 'Cap', 'Holdable', '']
          .map(function (hh) { return el('th', { text: hh }); }))),
        el('tbody', {}, db.policies.map(function (p, idx) {
          return el('tr', { 'data-enter': '' }, [
            el('td', {}, el('span.chip' + (p.patronType === '*' ? '.chip-gold' : ''), {
              text: p.patronType === '*' ? 'Any member' : E.patronTypeName(p.patronType) })),
            el('td', {}, el('span.chip', { text: E.itemTypeName(p.itemType) })),
            numCell(p, 'loanDays', idx, p.loanDays ? '' : 'faint'),
            numCell(p, 'maxItems', idx),
            numCell(p, 'renewals', idx),
            numCell(p, 'graceDays', idx),
            numCell(p, 'finePerDay', idx, '', '₹'),
            numCell(p, 'fineCap', idx, '', '₹'),
            el('td', {}, el('label.check', {}, [
              el('input', { type: 'checkbox', checked: p.holdable, onchange: function (e) {
                p.holdable = e.target.checked;
                E.log('Administration', 'Policy changed',
                  E.patronTypeName(p.patronType) + ' × ' + E.itemTypeName(p.itemType) +
                  ' holdable = ' + p.holdable, 'info');
                E.recompute();
              } })
            ])),
            el('td.tiny.faint', { text: p.loanDays ? '' : 'does not circulate' })
          ]);
        }))
      ]))));

      pane.appendChild(App.section('See it applied', {
        note: 'the same copy, four different members'
      }, el('div.matrixdemo', { 'data-reveal-group': '', 'data-stagger': '70' },
        ['FACULTY', 'PG', 'UG', 'VISITOR'].map(function (code) {
          var pol = E.policyFor(code, 'BOOK');
          var due = U.addDays(LS.clock.now(), pol.loanDays);
          return el('div.card.matrixcard', { 'data-tilt': '', 'data-tilt-max': '6' }, [
            el('div.eyebrow.no-rule', { text: E.patronTypeName(code) }),
            el('div.matrixdue', {}, [
              el('b', { text: pol.loanDays ? U.fmtDateShort(due) : '—' }),
              el('span', { text: pol.loanDays ? pol.loanDays + ' days' : 'no loan' })
            ]),
            el('ul.matrixlist', {}, [
              ['Max items', pol.maxItems],
              ['Renewals', pol.renewals],
              ['Grace days', pol.graceDays],
              ['Fine / day', U.money(pol.finePerDay)],
              ['Fine cap', pol.fineCap ? U.money(pol.fineCap) : 'none']
            ].map(function (r) {
              return el('li', {}, [el('span', { text: r[0] }), el('b', { text: String(r[1]) })]);
            }))
          ]);
        }))));

      function numCell(p, key, idx, cls, prefix) {
        return el('td.num', {}, el('input.matrixinput' + (cls ? '.' + cls : ''), {
          type: 'number', value: p[key], min: '0',
          'aria-label': key,
          onchange: function (e) {
            var was = p[key];
            p[key] = parseFloat(e.target.value) || 0;
            E.log('Administration', 'Policy changed',
              E.patronTypeName(p.patronType) + ' × ' + E.itemTypeName(p.itemType) + ' — ' +
              key + ': ' + was + ' → ' + p[key], 'gold');
            UI.toast({ tone: 'gold', title: 'Policy updated',
              detail: E.patronTypeName(p.patronType) + ' × ' + E.itemTypeName(p.itemType) +
                ' · ' + key + ' is now ' + (prefix || '') + p[key] +
                '. Every future transaction uses it.' });
            E.recompute();
          }
        }));
      }
    }

    /* ---------------- calendar ---------------------------- */
    if (adm.tab === 'calendar') {
      pane.appendChild(el('div.hintbox', { 'data-enter': '' }, [
        el('span.hintbox-ic', { text: '▦' }),
        el('div', {}, [
          el('b', { text: 'Closed days move due dates' }),
          el('p.small.muted', { text: 'A due date that falls on a day the library is shut is ' +
            'unfair and unenforceable, so the engine rolls it forward to the next open day. ' +
            'Whether closed days count toward fines is a policy choice, not a law.' })
        ])
      ]));

      var today = U.today();
      var grid = el('div.calgrid');
      for (var d = 0; d < 42; d++) {
        (function (day) {
          var date = U.addDays(today, day);
          var key = U.iso(date);
          var closed = db.settings.closedDates.indexOf(key) !== -1;
          var due = E.openLoans().filter(function (l) { return l.due === key; }).length;
          grid.appendChild(el('button.calday' + (closed ? '.is-closed' : '') +
            (day === 0 ? '.is-today' : ''), {
            style: { animationDelay: (day * 14) + 'ms' },
            title: closed ? 'Closed' : due + ' items due',
            onclick: function () {
              var i = db.settings.closedDates.indexOf(key);
              if (i === -1) db.settings.closedDates.push(key);
              else db.settings.closedDates.splice(i, 1);
              E.log('Administration', 'Calendar changed',
                U.fmtDate(date) + ' is now ' + (i === -1 ? 'closed' : 'open'), 'info');
              UI.toast({ title: U.fmtDate(date) + ' marked ' + (i === -1 ? 'closed' : 'open'),
                detail: 'Due dates landing here will ' + (i === -1 ? 'roll forward' : 'stand') + '.',
                tone: 'info' });
              App.render('admin', false);
            }
          }, [
            el('b', { text: String(date.getDate()) }),
            el('span', { text: ['Su','Mo','Tu','We','Th','Fr','Sa'][date.getDay()] }),
            due ? el('i.calcount', { text: String(due) }) : null
          ]));
        })(d);
      }
      pane.appendChild(App.section('Next six weeks', {
        note: 'click a day to open or close the library'
      }, el('div.stack', { style: { '--gap': '16px' } }, [
        grid,
        el('div.row.wrapflex', { style: { '--gap': '16px' } }, [
          el('span.legenditem', {}, [el('i', { style: { background: 'var(--gold)' } }),
            el('span', { text: 'Open — items fall due' })]),
          el('span.legenditem', {}, [el('i', { style: { background: 'var(--danger)' } }),
            el('span', { text: 'Closed — due dates roll forward' })])
        ]),
        el('label.check', {}, [
          el('input', { type: 'checkbox', checked: db.settings.countClosedDays,
            onchange: function (e) {
              db.settings.countClosedDays = e.target.checked;
              UI.toast({ title: 'Fine calculation changed', tone: 'gold',
                detail: e.target.checked
                  ? 'Closed days now count toward overdue charges.'
                  : 'Closed days are skipped when computing due dates.' });
              E.log('Administration', 'Setting changed',
                'countClosedDays = ' + e.target.checked, 'gold');
              E.recompute();
            } }),
          el('span', { text: 'Count closed days when calculating due dates' })
        ])
      ])));
    }

    /* ---------------- settings ---------------------------- */
    if (adm.tab === 'settings') {
      pane.appendChild(el('div.grid-2', {}, [
        App.section('Circulation settings', {}, el('div.stack', { style: { '--gap': '18px' } }, [
          setting('Fine threshold that blocks a member', 'blockThreshold', '₹',
            'Above this, checkout is refused until the account is settled.'),
          setting('Days a trapped hold waits on the shelf', 'holdShelfDays', '',
            'After this the hold expires and passes to the next member in the queue.'),
          setting('Maximum holds per member', 'maxHoldsPerPatron', '',
            'Stops one member monopolising the queue on every popular title.'),
          setting('Lost-item processing fee', 'lostProcessingFee', '₹',
            'Charged on top of the replacement cost recorded on the item.')
        ])),

        App.section('Integrations', { note: 'what the system talks to' },
          el('div.stack', { style: { '--gap': '0' } }, [
            ['Email gateway', 'SMTP relay — notices and receipts', 'ok'],
            ['SMS gateway', 'Hold-ready and overdue alerts', 'ok'],
            ['Payment gateway', 'Card, UPI and net banking for fines', 'ok'],
            ['RFID / self-check', 'SIP2 to the kiosks and security gates', 'ok'],
            ['Union catalogue', 'Z39.50 / SRU for copy cataloguing', 'ok'],
            ['E-resource knowledge base', 'Package holdings and link resolver', 'ok'],
            ['Student information system', 'Nightly member load', 'warn'],
            ['Off-site replica', 'Encrypted nightly snapshot', 'ok']
          ].map(function (r) {
            return el('div.listrow', { 'data-enter': '' }, [
              el('span.listrow-ic', { text: r[2] === 'ok' ? '✓' : '!' }),
              el('div.grow', {}, [
                el('div.listrow-title', { text: r[0] }),
                el('div.listrow-sub', { text: r[1] })
              ]),
              el('span.chip.chip-' + r[2], {}, [
                el('span.dot' + (r[2] === 'ok' ? '' : '.dot-pulse')),
                el('span', { text: r[2] === 'ok' ? 'Connected' : 'Degraded' })
              ])
            ]);
          })))
      ]));

      function setting(label, key, prefix, hint) {
        return el('div.field', {}, [
          el('span.label', { text: label }),
          el('div.row', { style: { '--gap': '10px' } }, [
            prefix ? el('span.gold', { text: prefix }) : null,
            el('input.input', { type: 'number', value: db.settings[key],
              onchange: function (e) {
                db.settings[key] = parseFloat(e.target.value) || 0;
                E.log('Administration', 'Setting changed', key + ' = ' + db.settings[key], 'gold');
                UI.toast({ title: 'Setting saved', detail: label + ' is now ' +
                  (prefix || '') + db.settings[key], tone: 'gold' });
                E.recompute();
              } })
          ]),
          el('div.tiny.faint', { style: { marginTop: '6px' }, text: hint })
        ]);
      }
    }

    /* ---------------- security ---------------------------- */
    if (adm.tab === 'security') {
      pane.appendChild(el('div.grid-2', {}, [
        App.section('Staff roles', { note: 'a student assistant is not a systems librarian' },
          el('div.stack', { style: { '--gap': '0' } }, E.ROLES.map(function (r) {
            return el('div.listrow' + (r.name === E.operator.role ? ' is-current' : ''), {
              'data-enter': '' }, [
              el('span.listrow-ic', { text: r.name === E.operator.role ? '●' : '○' }),
              el('div.grow', {}, [
                el('div.listrow-title', { text: r.name }),
                el('div.listrow-sub', { text: r.can.indexOf('*') > -1
                  ? 'Every module, including configuration and deletion'
                  : 'Permitted: ' + r.can.join(', ') })
              ]),
              el('button.btn.btn-sm', { onclick: function () {
                E.operator.role = r.name;
                document.querySelector('.operator-text em').textContent = r.name;
                E.log('Security', 'Role change', 'Operator now acting as ' + r.name, 'info');
                UI.toast({ title: 'Acting as ' + r.name, tone: 'info' });
                App.render('admin', false);
              } }, r.name === E.operator.role ? 'Current' : 'Act as')
            ]);
          }))),

        App.section('Privacy posture', {}, el('div.stack', { style: { '--gap': '14px' } }, [
          privacy('Reading history is opt-in', db.patrons.filter(function (p) {
            return p.historyOptIn; }).length + ' of ' + db.patrons.length + ' members opted in'),
          privacy('Closed loans can be anonymised', 'Open loans are never anonymised — the ' +
            'library still has to know who holds what'),
          privacy('Every write is attributed', db.audit.length + ' entries in this session’s ' +
            'audit trail, each carrying an operator name'),
          privacy('Checkout is atomic', 'A crashed scanner cannot leave a copy both “out” and ' +
            '“in” — the transaction commits whole or not at all'),
          privacy('Role-based access', 'Permissions are checked per module, not per person')
        ]))
      ]));

      pane.appendChild(App.section('Audit trail', {
        count: db.audit.length,
        note: 'who changed what, this session',
        flush: true
      }, el('div.tbl-scroll', { style: { '--tbl-h': '420px' } }, el('table.tbl', {}, [
        el('thead', {}, el('tr', {}, ['Time', 'Module', 'Action', 'Detail', 'Operator']
          .map(function (hh) { return el('th', { text: hh }); }))),
        el('tbody', {}, db.audit.slice(0, 80).map(function (a) {
          return el('tr', {}, [
            el('td.tiny.mono.muted', { text: U.fmtTime(new Date(a.at)) }),
            el('td', {}, el('span.chip', { text: a.module })),
            el('td.small', { text: a.action }),
            el('td.tiny.muted', { text: a.detail }),
            el('td.tiny.faint', { text: a.by })
          ]);
        }))
      ]))));

      function privacy(title, note) {
        return el('div.row', { style: { '--gap': '12px' } }, [
          el('span.privtick', { text: '✓' }),
          el('div', {}, [el('b.small', { text: title }),
            el('div.tiny.faint', { text: note })])
        ]);
      }
    }
  };
})(window);
