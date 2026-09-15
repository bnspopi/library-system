/* ============================================================
   landing.js — content and interaction for the explainer page.
   The rules playground runs the same engine the demo app uses.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util, E = LS.Engine;
  var el = U.el;

  /* ============================================================
     who uses it
     ============================================================ */

  var ROLES = [
    ['◍', 'Patron / member', 'Searches, reserves, renews, pays a fine, checks a reading history.',
     'OPAC · mobile · self-check'],
    ['⇄', 'Circulation staff', 'Issues, returns, renews, collects fines and registers members.',
     'Desk client · barcode & RFID'],
    ['▤', 'Cataloguer', 'Creates bibliographic and item records, classifies, imports MARC from other libraries.',
     'Staff client · Z39.50'],
    ['▣', 'Acquisitions staff', 'Selects, orders, receives, invoices and accessions — and guards the budget.',
     'Staff client · EDI'],
    ['≣', 'Serials staff', 'Tracks journal issues, claims missing parts, binds completed volumes.',
     'Staff client · check-in card'],
    ['⚙', 'Systems librarian', 'Owns the policies, backups, roles, reports and every integration.',
     'Full administrative access'],
    ['⌂', 'Branch & consortium staff', 'The same system with different location codes, and sometimes shared patrons.',
     'Staff client · transit lists']
  ];

  function buildRoles() {
    var host = document.getElementById('roles');
    if (!host) return;
    ROLES.forEach(function (r) {
      host.appendChild(el('article.rolecardl', { 'data-tilt': '', 'data-tilt-max': '6' }, [
        el('div.rolecardl-ic', { text: r[0] }),
        el('h4', { text: r[1] }),
        el('p', { text: r[2] }),
        el('div.rolecardl-face', { text: r[3] })
      ]));
    });
  }

  /* ============================================================
     core records
     ============================================================ */

  var RECORDS = [
    ['◈', 'Bibliographic record', 'The work, not the copy',
     ['title', 'author', 'isbn / issn', 'publisher', 'year', 'language', 'subjects[]', 'dewey / lc', 'marc fields'],
     'Describes the work. One bibliographic record can carry a hundred copies across every branch — ' +
     'which is why holds are placed on it rather than on any particular copy.'],
    ['⌗', 'Item / holding record', 'The physical or licensed copy',
     ['barcode', 'rfid tag', 'call number', 'branch', 'shelf', 'item type', 'status', 'price', 'circ count'],
     'This is what circulation actually issues. Its type and location decide which policy row ' +
     'applies, and its status is what the public catalogue shows.'],
    ['◍', 'Patron record', 'The person and their standing',
     ['name', 'card number', 'category', 'branch', 'registered', 'expires', 'blocks', 'notes'],
     'Category is not decoration — it is the row the policy matrix looks up. Change someone from ' +
     'undergraduate to faculty and every future due date changes with them.'],
    ['⇄', 'Transaction record', 'The live “who has what” file',
     ['patron_id', 'item_id', 'checkout_time', 'due_date', 'checkin_time', 'renew_count', 'channel'],
     'The single most consulted file in the building. Every overdue notice, fine, renewal and ' +
     'circulation statistic is derived from it.'],
    ['◆', 'Hold / reservation', 'The queue',
     ['bib_id', 'patron_id', 'placed', 'pickup branch', 'position', 'status', 'expiry'],
     'Title-level or item-level. When a copy is trapped it stops being “available” even though it ' +
     'is physically in the building, and the clock starts on the pickup shelf.'],
    ['⊙', 'Fine / fee record', 'Money owed',
     ['patron_id', 'type', 'amount', 'raised', 'paid / waived', 'method', 'reference'],
     'Overdue, lost, damage and membership charges share one ledger, because the block that stops ' +
     'a checkout is computed from the total, not from any one charge.'],
    ['▣', 'Order / invoice / fund', 'Money spent',
     ['vendor', 'fund code', 'po number', 'quantity', 'unit price', 'receipt status', 'invoice'],
     'Placing an order encumbers the money immediately — reserved but not yet spent — so a budget ' +
     'already committed cannot be overspent by a second order.'],
    ['⚖', 'Policy table', 'Not user data — control data',
     ['patron type', 'item type', 'location', 'loan days', 'max items', 'renewals', 'grace', 'fine rate'],
     'A matrix rather than a set of rules in code. It is why the same shelf hands two people two ' +
     'different due dates, and why a library can change its own rules without a release.']
  ];

  function buildRecords() {
    var host = document.getElementById('records-grid');
    if (!host) return;
    RECORDS.forEach(function (r) {
      var card = el('button.reccard', { type: 'button', 'aria-expanded': 'false' }, [
        el('div.reccard-head', {}, [
          el('span.reccard-key', { text: r[0] }),
          el('span', {}, [el('b', { text: r[1] }), el('span', { text: r[2] })]),
          el('span.reccard-caret', { text: '▾' })
        ]),
        el('div.reccard-fold', {}, el('div', {}, [
          el('div.reccard-fields', {}, r[3].map(function (f) {
            return el('span', { text: f });
          })),
          el('p.reccard-note', { text: r[4] })
        ]))
      ]);
      card.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      host.appendChild(card);
    });
  }

  /* ============================================================
     modules
     ============================================================ */

  var MODULES = [
    { n: '6.1', name: 'Cataloguing', link: 'catalog',
      lede: 'Describing what the library owns. Cataloguers rarely type from scratch — they search a ' +
            'union catalogue, import the MARC record and overlay it, then attach the copies that ' +
            'actually arrived.',
      steps: [
        ['Search and import', 'Z39.50 or SRU against WorldCat, the Library of Congress or a national union catalogue. ISO 2709 in, fourteen fields mapped.'],
        ['Create or overlay', 'A new bibliographic record, or an update to one that already exists. Duplicate detection runs here.'],
        ['Authority control', '“Rowling, J. K.” is one heading, always, so every book by that author groups together no matter who typed it.'],
        ['Attach item records', 'Print the barcode, assign the call number, set the collection — general, reference, rare, short loan.'],
        ['It goes live', 'Searchable in the public catalogue and issuable at the desk in the same instant. There is no second entry.']
      ],
      note: 'Special cases: on-the-fly cataloguing at the desk when a book arrives without a record, and batch import of whole e-book packages.' },

    { n: '6.2', name: 'Acquisitions', link: 'acquisitions',
      lede: 'Buying and receiving. The module exists to stop a library spending money it has already ' +
            'committed, which is why the order — not the invoice — is what moves the budget.',
      steps: [
        ['Selection', 'A librarian, a faculty member or a reader suggests a title. It sits as a selection record until someone funds it.'],
        ['Order', 'A purchase order against a fund. The money is encumbered — reserved but not yet spent — and the fund refuses anything it cannot cover.'],
        ['Send to vendor', 'EDI for the large suppliers, email for everyone else.'],
        ['Receive', 'Match the shipment to the purchase order and barcode the copies that arrived. Anything short is claimed.'],
        ['Accession', 'Assign accession numbers and hand off to cataloguing — often from the order record itself.'],
        ['Pay', 'The invoice is posted and the encumbrance becomes expenditure.']
      ],
      note: 'In a corporate or law library the same module tracks database licences and renewal dates instead of book trucks.' },

    { n: '6.3', name: 'Serials', link: 'serials',
      lede: 'A journal is not one book — it is an expected stream of issues. The system stores a ' +
            'prediction pattern, and every arrival is checked in against it.',
      steps: [
        ['Predict', 'Weekly, monthly, quarterly — volume and issue numbering generated ahead of time.'],
        ['Check in', 'Each arriving issue is matched to its prediction, and the next one is generated.'],
        ['Claim', 'An issue that never turns up is claimed from the subscription agent automatically by the nightly job.'],
        ['Bind', 'Several received issues become one bound volume with a brand-new, circulating item record.'],
        ['Electronic serials', 'Handled by electronic resource management plus a knowledge base of which packages the library licenses.']
      ],
      note: 'The check-in card is the oldest interface in librarianship and the one users miss most when a system gets it wrong.' },

    { n: '6.4', name: 'Circulation', link: 'circulation',
      lede: 'The module patrons feel. Every action reads three files — the item file, the patron file ' +
            'and the transaction file — and writes exactly one transaction.',
      steps: [
        ['Scan the card', 'Load the patron. Check expiry, manual blocks, outstanding charges and how many items they already hold.'],
        ['Scan the item', 'Load the copy. Check it is not already out, not reference-only, not trapped for somebody else.'],
        ['Apply the policy matrix', 'Patron category × item type × location produces the due date, the renewal cap and the fine formula.'],
        ['Write the transaction', 'Atomically. Item status becomes “on loan”, the available count drops, the receipt prints, the notice queues.'],
        ['Check in', 'Close the transaction, charge any overdue past the grace period, then offer the copy to the hold queue before reshelving it.'],
        ['Renew', 'Allowed only under the renewal cap, with nobody waiting, and with the member unblocked.']
      ],
      note: 'A self-check kiosk speaking SIP2 hits exactly this engine, so the rules behave identically at three in the morning.' },

    { n: '6.5', name: 'OPAC & discovery', link: 'opac',
      lede: 'The public search layer, sitting on the same truth. Modern discovery layers search ' +
            'e-journals and databases in the same box as the print catalogue.',
      steps: [
        ['Search', 'Keyword, title, author, ISBN, subject or call number — with qualified searching for staff and power users.'],
        ['Facet', 'Available now, branch, format, year, language. Counts are computed from the live result set.'],
        ['Real-time availability', 'Because the OPAC reads the same item status circulation just wrote.'],
        ['Account', 'Current loans, charges, hold position, and a reading history only if the privacy policy and the member allow it.']
      ],
      note: 'Primo, EBSCO Discovery and VuFind are discovery layers bolted on top of an ILS — the catalogue underneath is still the one described here.' },

    { n: '6.6', name: 'Membership', link: 'patrons',
      lede: 'Registering people and deciding what they are allowed to do. Almost every circulation ' +
            'argument at a desk traces back to a category set wrongly here.',
      steps: [
        ['Register', 'Issue a card and a barcode, assign a category, set an expiry.'],
        ['Guarantors', 'Junior accounts carry a responsible adult.'],
        ['Batch load', 'Nightly feed from a university student information system or a municipal identity system.'],
        ['Privacy', 'Purge and anonymise old loans. What is out now must be kept; what has been returned need not be.'],
        ['Roles', 'Staff permissions are per module — a student assistant may check out but may not delete a bibliographic record.']
      ],
      note: 'Category drives loan limits, loan length, renewal caps and fine rates. It is the single most consequential field in the record.' },

    { n: '6.7', name: 'Interlibrary loan', link: 'ill',
      lede: 'When the local catalogue has nothing, the request goes out to another library over ' +
            'ISO ILL, NCIP or a consortium broker.',
      steps: [
        ['Request', 'Placed against a partner library or a broker on behalf of a named member.'],
        ['Incoming', 'Treated as a temporary item with a due date the lending library sets, not one this library computes.'],
        ['Outgoing', 'The local copy’s status becomes “on ILL” so nobody here can borrow it.'],
        ['Return', 'Both sides close their transaction and the temporary record is retired.']
      ],
      note: 'Licence terms decide whether an electronic resource may travel this way at all — most may not.' },

    { n: '6.8', name: 'Notices & automation', link: 'notices',
      lede: 'Nobody sits at a desk at two in the morning deciding who is overdue. A scheduler walks ' +
            'the transaction file every night.',
      steps: [
        ['Accrue', 'Overdue charges applied at the rate and cap the policy matrix sets, past the grace period.'],
        ['Notify', 'Overdue notices, due-soon reminders, hold-available alerts and membership expiry warnings to email and SMS.'],
        ['Expire', 'Uncollected holds expire and the copy passes to the next member in the queue.'],
        ['Claim', 'Vendor orders past their lead time, and serial issues that never arrived.'],
        ['Replicate', 'An off-site snapshot, every night, without exception.']
      ],
      note: 'In the demo you can push the clock forward and watch every one of these run for each day skipped.' },

    { n: '6.9', name: 'Reports & administration', link: 'reports',
      lede: 'Nothing in a library report is entered by hand. Every figure is derived from records the ' +
            'desk has been writing all day.',
      steps: [
        ['Circulation statistics', 'By branch, item type, member category and hour of the day — which is how a desk rota gets written.'],
        ['Collection use', 'Which titles never circulate. The weeding list is a report, not an opinion.'],
        ['Budget', 'Spent against encumbered against allocated, fund by fund and vendor by vendor.'],
        ['Stock verification', 'Walk the shelves with a wand; the system lists what it believes is there but has not seen for months.'],
        ['Configuration', 'Opening hours, closed dates, fine holidays, branch transit times, and the policy matrix itself.']
      ],
      note: 'Due dates skip closed days because a due date the library cannot accept a return on is unenforceable.' },

    { n: '6.10', name: 'Electronic resources', link: 'catalog',
      lede: 'In a Library Services Platform, licensed content sits in the same workflow as print — ' +
            'which is the main thing that separates an LSP from a classic ILS.',
      steps: [
        ['Knowledge base', 'Which titles each subscribed package actually contains, maintained centrally.'],
        ['Activation', 'Portfolios switched on and off as subscriptions change.'],
        ['Licence terms', 'Simultaneous users, walk-in access, whether interlibrary loan is permitted at all.'],
        ['Link resolver', 'OpenURL takes a citation and sends the reader to the copy the library actually pays for.'],
        ['Usage', 'COUNTER reports pulled automatically over SUSHI, to justify the next renewal.']
      ],
      note: 'An e-resource never “circulates” — it is never issued at a desk, so it needs its own policy row that lends for zero days.' }
  ];

  function buildModules() {
    var list = document.getElementById('modlist');
    var panel = document.getElementById('modpanel');
    if (!list || !panel) return;

    MODULES.forEach(function (m, i) {
      var b = el('button.modbtn', { type: 'button', role: 'tab', 'data-ripple': '',
        'aria-selected': i === 3 ? 'true' : 'false' }, [
        el('span.modbtn-n', { text: m.n }),
        el('span', { text: m.name })
      ]);
      b.addEventListener('click', function () { select(i); });
      list.appendChild(b);
    });

    function select(i) {
      var m = MODULES[i];
      U.$$('.modbtn', list).forEach(function (b, j) {
        b.classList.toggle('is-active', j === i);
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      panel.innerHTML = '';
      panel.appendChild(el('div', {}, [
        el('div.eyebrow.no-rule', { text: 'Module ' + m.n }),
        el('h3.h2', { style: { marginTop: '10px' }, text: m.name }),
        el('p.modpanel-lede', { text: m.lede }),
        el('div.modsteps', {}, m.steps.map(function (s, k) {
          return el('div.modstep', { style: { animationDelay: (k * 70) + 'ms' } }, [
            el('span.modstep-n', { text: String(k + 1) }),
            el('div', {}, [el('b', { text: s[0] }), el('p', { text: s[1] })])
          ]);
        })),
        el('div.modpanel-foot', {}, [
          el('p.tiny.faint', { style: { margin: 0, maxWidth: '52ch' }, text: m.note }),
          el('a.btn.btn-sm', { href: 'app.html#/' + m.link, 'data-ripple': '' },
             'Open ' + m.name.toLowerCase() + ' →')
        ])
      ]));
      if (global.Motion) {
        Motion.enter(panel, '.modstep', 70);
        Motion.scan(panel);
      }
    }
    select(3);                                   // open circulation first
  }

  /* ============================================================
     life of one book
     ============================================================ */

  var LIFE = [
    ['Acquisitions', 'A selector asks for it',
     'A librarian or a faculty member requests the title. It becomes a selection record — no money has moved yet.'],
    ['Acquisitions', 'The order encumbers a fund',
     'A purchase order goes to the vendor over EDI and the money is reserved against a fund immediately, so it cannot be committed twice.'],
    ['Acquisitions', 'The shipment is received',
     'Staff match the delivery to the purchase order, barcode the copies and assign accession numbers. Anything missing is claimed.'],
    ['Cataloguing', 'It is described once',
     'A MARC record is imported or created, item records are attached, and a spine label and barcode are printed.'],
    ['Catalogue', 'It becomes available',
     'Status flips to available. The public catalogue shows it on the shelf the same second, at the right branch, with the right call number.'],
    ['OPAC', 'A reader finds it',
     'Either they walk to the shelf, or they place a hold on the title from home and wait their turn.'],
    ['Circulation', 'It is issued',
     'Card scanned, copy scanned, policy matrix applied. A due date is computed from who they are and what they took.'],
    ['OPAC', 'They renew it once',
     'Online, at midnight, under the renewal cap — and only because nobody else was waiting for it.'],
    ['Fines', 'It comes back late',
     'The check-in closes the transaction and raises an overdue charge past the grace period, at the rate and cap the policy sets.'],
    ['Circulation', 'Another reader’s hold is trapped',
     'The copy never reaches the shelf. It goes to the pickup shelf and an SMS goes out within the minute.'],
    ['Reports', 'Years later it is weeded',
     'A collection-use report shows no circulation in over a year. The copy is withdrawn; the bibliographic record survives if other copies remain.']
  ];

  function buildLife() {
    var host = document.getElementById('life');
    if (!host) return;
    LIFE.forEach(function (s, i) {
      host.appendChild(el('div.lifestep', { 'data-reveal': '', 'data-delay': String(i * 40) }, [
        el('div.lifestep-mod', { text: s[0] }),
        el('h4', { text: s[1] }),
        el('p', { text: s[2] })
      ]));
    });

    /* fill the spine as the section scrolls through the viewport */
    var fill = document.getElementById('life-fill');
    if (!fill || (global.Motion && Motion.reduced)) return;
    var ticking = false;
    function update() {
      var r = host.getBoundingClientRect();
      var vh = global.innerHeight;
      var p = (vh * 0.62 - r.top) / r.height;
      fill.style.height = Math.max(0, Math.min(1, p)) * 100 + '%';
      ticking = false;
    }
    global.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ============================================================
     rules playground — driven by the real engine
     ============================================================ */

  function buildPlayground() {
    var pSel = document.getElementById('pg-patron');
    var iSel = document.getElementById('pg-item');
    var bSel = document.getElementById('pg-branch');
    var closed = document.getElementById('pg-closed');
    var out = document.getElementById('pg-out');
    if (!pSel || !out) return;

    var db = E.db();

    db.patronTypes.forEach(function (t) {
      pSel.appendChild(el('option', { value: t.code, selected: t.code === 'UG' }, t.name));
    });
    db.itemTypes.forEach(function (t) {
      iSel.appendChild(el('option', { value: t.code, selected: t.code === 'BOOK' }, t.name));
    });
    db.branches.forEach(function (b) {
      bSel.appendChild(el('option', { value: b.code }, b.name));
    });

    [pSel, iSel, bSel].forEach(function (s) { s.addEventListener('change', render); });
    closed.addEventListener('change', function () {
      db.settings.countClosedDays = closed.checked;
      render();
    });

    function render() {
      var ptype = pSel.value, itype = iSel.value, br = bSel.value;
      var pol = E.policyFor(ptype, itype);
      var fakePatron = { type: ptype, branch: br };
      var fakeItem = { type: itype, branch: br };
      var due = pol.loanDays ? E.dueDateFor(fakePatron, fakeItem, U.today()) : null;
      var naive = pol.loanDays ? U.iso(U.addDays(U.today(), pol.loanDays)) : null;
      var rolled = due && naive && due !== naive;

      out.innerHTML = '';
      out.appendChild(el('div', {}, [
        el('div.eyebrow.no-rule', {
          text: E.patronTypeName(ptype) + ' borrowing a ' + E.itemTypeName(itype).toLowerCase() +
                ' at ' + E.branch(br).name }),

        el('div.playdue', { style: { marginTop: '16px' } },
          pol.loanDays ? [
            el('b', { text: U.fmtDate(due) }),
            el('span', { text: pol.loanDays + '-day loan · due ' + U.relDays(due) })
          ] : [
            el('b', { text: 'Not issued' }),
            el('span', { text: 'This combination does not circulate at all' })
          ]),

        el('div.playrules', {}, [
          rule(pol.loanDays ? pol.loanDays : '—', 'loan days'),
          rule(pol.maxItems ? pol.maxItems : '—', 'max items'),
          rule(pol.renewals, 'renewals'),
          rule(pol.graceDays, 'grace days'),
          rule(pol.finePerDay ? U.money(pol.finePerDay) : '—', 'fine / day'),
          rule(pol.fineCap ? U.money(pol.fineCap) : 'none', 'fine cap'),
          rule(pol.holdable ? 'Yes' : 'No', 'holdable')
        ]),

        el('div.playexplain', { html: explain(ptype, itype, pol, rolled, due) })
      ]));

      if (global.Motion) Motion.scan(out);
    }

    function rule(v, label) {
      return el('div.playrule', {}, [
        el('b', { text: String(v) }), el('span', { text: label })
      ]);
    }

    function explain(ptype, itype, pol, rolled, due) {
      var parts = [];
      if (!pol.loanDays) {
        parts.push('The engine resolved <code>' + U.esc(ptype) + ' × ' + U.esc(itype) +
          '</code> to a zero-day loan, so circulation refuses the transaction outright rather than ' +
          'writing a half-record. Reference copies and licensed e-resources sit here.');
      } else {
        parts.push('The engine resolved <code>' + U.esc(ptype) + ' × ' + U.esc(itype) +
          '</code> from the policy matrix — an exact row if one exists, otherwise the ' +
          '<code>*</code> fallback — then added ' + pol.loanDays + ' days to today.');
      }
      if (rolled) {
        parts.push('That landed on a day the library is closed, so it rolled forward to <code>' +
          U.esc(U.fmtDate(due)) + '</code>. A due date the library cannot accept a return on is ' +
          'unenforceable.');
      }
      if (pol.finePerDay) {
        parts.push('Past ' + pol.graceDays + ' grace day' + (pol.graceDays === 1 ? '' : 's') +
          ', the nightly job charges ' + U.money(pol.finePerDay) + ' a day, capped at ' +
          U.money(pol.fineCap) + '. Cross ' + U.money(E.db().settings.blockThreshold) +
          ' outstanding in total and checkout is blocked.');
      } else if (pol.loanDays) {
        parts.push('No overdue charge applies to this combination — a policy choice, not a ' +
          'technical limit.');
      }
      parts.push('At the desk the engine would still check membership expiry, manual blocks, how ' +
        'many items this member already holds, and whether anyone is waiting for the title.');
      return parts.join(' ');
    }

    render();
  }

  /* ============================================================
     standards marquees
     ============================================================ */

  var STANDARDS = [
    ['MARC21', 'bibliographic exchange'],
    ['UNIMARC', 'bibliographic exchange'],
    ['BIBFRAME', 'linked-data successor to MARC'],
    ['ISO 2709', 'the MARC file format'],
    ['Z39.50', 'search another library’s catalogue'],
    ['SRU / SRW', 'the same search, over HTTP'],
    ['SIP2', 'self-check machines and gates'],
    ['NCIP', 'circulation between systems'],
    ['EDI', 'orders and invoices with vendors'],
    ['COUNTER', 'e-resource usage statistics'],
    ['SUSHI', 'harvesting those statistics'],
    ['OpenURL', 'citation to the licensed copy'],
    ['RDA', 'resource description and access'],
    ['DDC / LC', 'classification schemes'],
    ['ISO ILL', 'interlibrary request and supply'],
    ['OAI-PMH', 'metadata harvesting']
  ];

  function buildStandards() {
    [['std-a', 0], ['std-b', 1]].forEach(function (pair) {
      var host = document.getElementById(pair[0]);
      if (!host) return;
      STANDARDS.filter(function (_, i) { return i % 2 === pair[1]; })
        .concat(STANDARDS.filter(function (_, i) { return i % 2 !== pair[1]; }).slice(0, 3))
        .forEach(function (s) {
          host.appendChild(el('li.std', {}, [
            el('b', { text: s[0] }), el('span', { text: s[1] })
          ]));
        });
    });
  }

  /* ============================================================
     security cards
     ============================================================ */

  var SECURITY = [
    ['⛨', 'Role-based access', 'A student assistant at the desk is not a systems librarian. ' +
      'Permissions are checked per module, so the person who can issue a book cannot delete a ' +
      'bibliographic record or waive a charge.'],
    ['◍', 'Patron data is personal data', 'A circulation file is a record of what people read. ' +
      'Retention of reading history is minimised, opt-in, and purgeable on request.'],
    ['⇄', 'Atomic transactions', 'A checkout either fully succeeds or rolls back. A crashed scanner ' +
      'can never leave a copy both “out” and “in” at once, which is how inventory stays equal to reality.'],
    ['▤', 'Audit log', 'Who changed a fine. Who deleted a bibliographic record. Who overrode a ' +
      'block, and under whose name. Every write is attributed and kept.'],
    ['⊘', 'Blocks that mean something', 'Stolen cards, expired membership, billed lost items and ' +
      'unpaid charges above a threshold all stop circulation automatically — no judgement call at the desk.'],
    ['⟳', 'Off-site replica', 'Losing the circulation database on a Monday morning is a disaster, ' +
      'so it is replicated nightly and the restore is rehearsed.']
  ];

  function buildSecurity() {
    var host = document.getElementById('sec-grid');
    if (!host) return;
    SECURITY.forEach(function (s) {
      host.appendChild(el('article.seccard', { 'data-tilt': '', 'data-tilt-max': '5' }, [
        el('div.seccard-ic', { text: s[0] }),
        el('h4', { text: s[1] }),
        el('p', { text: s[2] })
      ]));
    });
  }

  /* ============================================================
     boot
     ============================================================ */

  global.addEventListener('DOMContentLoaded', function () {
    E.init();                       // the playground runs the real engine

    /* keep the hero counters honest against the dataset that actually loaded,
       before the counters are wired up rather than after */
    var db = E.db();
    var facts = U.$$('.hero-facts .fact b');
    [null, db.bibs.length, db.items.length, db.policies.length, null]
      .forEach(function (v, i) {
        if (v !== null && facts[i]) facts[i].setAttribute('data-count', v);
      });

    buildRoles();
    buildRecords();
    buildModules();
    buildLife();
    buildStandards();
    buildSecurity();
    buildPlayground();
    Motion.boot();
  });
})(window);
