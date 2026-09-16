/* ============================================================
   engine.js — the business rules layer.

   Every desk action in the demo goes through here: eligibility,
   due-date calculation, hold capture, fine accrual, the nightly
   job. Modules never talk to each other — they all read and
   write this one shared set of records, which is what makes a
   check-in update the catalogue, the hold queue, the fine
   ledger and the statistics at the same moment.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util;
  var Engine = {};

  var db = null;

  /* ============================================================
     state
     ============================================================ */

  Engine.db = function () { return db; };

  Engine.init = function () {
    db = LS.buildSeed();
    seedActivity();
    Engine.recompute();
    LS.bus.emit('db:ready', db);
    return db;
  };

  Engine.reset = function () {
    LS.clock.reset();
    Engine.init();
    LS.bus.emit('db:reset');
  };

  /* Audit trail — every state change is recorded so the demo can
     show who changed what, and so the activity feed has a source. */
  function log(module, action, detail, tone) {
    var entry = {
      id: U.uid(),
      at: LS.clock.now().toISOString(),
      module: module,
      action: action,
      detail: detail,
      tone: tone || 'info',
      by: Engine.operator ? Engine.operator.name : 'System'
    };
    db.audit.unshift(entry);
    if (db.audit.length > 400) db.audit.length = 400;
    LS.bus.emit('audit', entry);
    return entry;
  }
  Engine.log = log;

  Engine.operator = { name: 'A. Fernandes', role: 'Circulation Supervisor', branch: 'MAIN' };

  Engine.ROLES = [
    { code: 'circ',    name: 'Circulation Supervisor', can: ['circ', 'patrons', 'catalog:read', 'reports'] },
    { code: 'cat',     name: 'Cataloguer',             can: ['catalog', 'acq:read', 'reports'] },
    { code: 'acq',     name: 'Acquisitions Officer',   can: ['acq', 'serials', 'catalog:read', 'reports'] },
    { code: 'admin',   name: 'Systems Librarian',      can: ['*'] },
    { code: 'assist',  name: 'Student Assistant',      can: ['circ:checkout', 'circ:checkin'] }
  ];

  /* ============================================================
     lookups
     ============================================================ */

  function bib(id)      { return db.bibs.find(function (b) { return b.id === id; }); }
  function item(bc)     { return db.items.find(function (i) { return i.barcode === String(bc); }); }
  function patron(id)   { return db.patrons.find(function (p) { return p.id === id; }); }
  function fund(code)   { return db.funds.find(function (f) { return f.code === code; }); }
  function branch(code) { return db.branches.find(function (b) { return b.code === code; }); }
  function loan(id)     { return db.loans.find(function (l) { return l.id === id; }); }
  function hold(id)     { return db.holds.find(function (h) { return h.id === id; }); }

  /** A patron can be looked up by id, card number, or name fragment. */
  function findPatron(needle) {
    if (!needle) return null;
    var q = String(needle).trim();
    return db.patrons.find(function (p) {
      return p.id === q || p.cardNo === q ||
             p.name.toLowerCase() === q.toLowerCase();
    }) || db.patrons.find(function (p) { return U.matches(p.name + ' ' + p.email, q); }) || null;
  }

  Engine.collection = function (key) {
    return db.collections.find(function (c) { return c.key === key; });
  };
  /** Titles and shelf availability for one collection — what the hall
      sign would say. */
  Engine.collectionStats = function (key) {
    var bibs = db.bibs.filter(function (b) { return b.collection === key; });
    var items = db.items.filter(function (i) {
      return bibs.some(function (b) { return b.id === i.bibId; });
    });
    return {
      titles: bibs.length,
      copies: items.length,
      available: items.filter(function (i) { return i.status === 'available'; }).length,
      out: items.filter(function (i) { return i.status === 'out'; }).length,
      bibs: bibs
    };
  };

  Engine.bib = bib;
  Engine.item = item;
  Engine.patron = patron;
  Engine.fund = fund;
  Engine.branch = branch;
  Engine.loan = loan;
  Engine.hold = hold;
  Engine.findPatron = findPatron;

  Engine.itemsOf = function (bibId) {
    return db.items.filter(function (i) { return i.bibId === bibId; });
  };
  Engine.openLoans = function () {
    return db.loans.filter(function (l) { return !l.in; });
  };
  Engine.loansOf = function (patronId, includeClosed) {
    return db.loans.filter(function (l) {
      return l.patronId === patronId && (includeClosed || !l.in);
    });
  };
  Engine.holdsOf = function (patronId) {
    return db.holds.filter(function (h) {
      return h.patronId === patronId && (h.status === 'waiting' || h.status === 'ready');
    });
  };
  Engine.finesOf = function (patronId, unpaidOnly) {
    return db.fines.filter(function (f) {
      return f.patronId === patronId && (!unpaidOnly || f.status === 'outstanding');
    });
  };
  Engine.loanForBarcode = function (bc) {
    return db.loans.find(function (l) { return l.barcode === String(bc) && !l.in; });
  };

  /* ============================================================
     policy
     ============================================================ */

  /** Resolve the policy row for a patron type x item type pair.
      An exact row wins; a '*' row is the fallback. */
  Engine.policyFor = function (patronType, itemType) {
    return db.policies.find(function (p) {
      return p.patronType === patronType && p.itemType === itemType;
    }) || db.policies.find(function (p) {
      return p.patronType === '*' && p.itemType === itemType;
    }) || db.policies.find(function (p) {
      return p.patronType === patronType && p.itemType === '*';
    }) || { patronType: patronType, itemType: itemType, loanDays: 0, maxItems: 0,
            renewals: 0, graceDays: 0, finePerDay: 0, fineCap: 0, holdable: false,
            missing: true };
  };

  function isClosed(d) {
    return db.settings.closedDates.indexOf(U.iso(d)) !== -1;
  }

  /** Due date = loan period from `from`, rolled forward off closed days. */
  Engine.dueDateFor = function (p, it, from) {
    var pol = Engine.policyFor(p.type, it.type);
    if (!pol.loanDays) return null;
    var d = U.addDays(from || U.today(), pol.loanDays);
    if (!db.settings.countClosedDays) {
      var guard = 0;
      while (isClosed(d) && guard++ < 14) d = U.addDays(d, 1);
    }
    return U.iso(d);
  };

  /* ============================================================
     patron standing
     ============================================================ */

  Engine.outstanding = function (patronId) {
    return U.sum(Engine.finesOf(patronId, true), function (f) {
      return f.amount - (f.paidAmount || 0);
    });
  };

  /** Everything the desk needs to decide whether to hand a book over. */
  Engine.patronState = function (patronId) {
    var p = patron(patronId);
    if (!p) return null;
    var loans = Engine.loansOf(patronId);
    var owed = Engine.outstanding(patronId);
    var today = U.today();
    var expired = U.daysBetween(today, new Date(p.expires)) < 0;
    var overdue = loans.filter(function (l) {
      return U.daysBetween(today, new Date(l.due)) < 0;
    });
    var blocks = [];
    if (expired) {
      blocks.push({ code: 'EXPIRED', label: 'Membership expired ' +
        U.fmtDate(p.expires), fixable: 'renew-membership' });
    }
    if (p.manualBlock) {
      blocks.push({ code: 'MANUAL', label: p.manualBlock, fixable: 'clear-block' });
    }
    if (owed >= db.settings.blockThreshold) {
      blocks.push({ code: 'FINES', label: 'Outstanding charges ' + U.money(owed) +
        ' exceed the ' + U.money(db.settings.blockThreshold) + ' limit', fixable: 'pay' });
    }
    return {
      patron: p, loans: loans, overdue: overdue,
      holds: Engine.holdsOf(patronId),
      fines: Engine.finesOf(patronId, true),
      outstanding: owed,
      expired: expired,
      blocks: blocks,
      blocked: blocks.length > 0
    };
  };

  /* ============================================================
     availability
     ============================================================ */

  Engine.availability = function (bibId) {
    var items = Engine.itemsOf(bibId);
    var avail = items.filter(function (i) { return i.status === 'available'; });
    return {
      total: items.length,
      available: avail.length,
      out: items.filter(function (i) { return i.status === 'out'; }).length,
      onHoldShelf: items.filter(function (i) { return i.status === 'hold-shelf'; }).length,
      inTransit: items.filter(function (i) { return i.status === 'in-transit'; }).length,
      reference: items.filter(function (i) { return i.status === 'reference'; }).length,
      lost: items.filter(function (i) { return i.status === 'lost'; }).length,
      branches: Object.keys(U.groupBy(avail, function (i) { return i.branch; })),
      queue: db.holds.filter(function (h) {
        return h.bibId === bibId && (h.status === 'waiting' || h.status === 'ready');
      }).length
    };
  };

  /* ============================================================
     CHECKOUT
     ============================================================ */

  Engine.checkout = function (patronId, barcode, opts) {
    opts = opts || {};
    var p = patron(patronId);
    var it = item(barcode);

    if (!p)  return fail('NO_PATRON', 'No patron record for “' + barcode + '”.');
    if (!it) return fail('NO_ITEM', 'Barcode ' + barcode + ' is not in the catalogue.');

    var b = bib(it.bibId);
    var st = Engine.patronState(patronId);
    var pol = Engine.policyFor(p.type, it.type);

    /* --- item-side checks ------------------------------- */
    if (it.status === 'out') {
      var cur = Engine.loanForBarcode(barcode);
      var holder = cur ? patron(cur.patronId) : null;
      return fail('ALREADY_OUT', 'Copy is already on loan' +
        (holder ? ' to ' + holder.name + ' until ' + U.fmtDate(cur.due) : '') + '.');
    }
    if (it.status === 'reference') {
      return fail('REFERENCE', 'Reference copy — library use only, never issued.');
    }
    if (it.status === 'licensed') {
      return fail('ERESOURCE', 'Licensed e-resource — access is granted online, not at the desk.');
    }
    if (it.status === 'lost' || it.status === 'withdrawn') {
      return fail('ITEM_STATUS', 'Copy is marked ' + it.status + '.');
    }
    if (it.status === 'in-transit') {
      return fail('IN_TRANSIT', 'Copy is in transit to ' + it.homeBranch + '. Receive it first.');
    }
    if (it.status === 'hold-shelf') {
      var trapped = db.holds.find(function (h) {
        return h.barcode === it.barcode && h.status === 'ready';
      });
      if (trapped && trapped.patronId !== patronId) {
        return fail('HELD_FOR_OTHER', 'On the hold shelf for ' +
          patron(trapped.patronId).name + '. Issue to them, or cancel that hold first.');
      }
    }
    if (!pol.loanDays) {
      return fail('NOT_CIRCULATING', ITEMTYPE(it.type) + ' does not circulate to ' +
        PTYPE(p.type) + ' members under current policy.');
    }

    /* --- patron-side checks ----------------------------- */
    if (st.blocked && !opts.override) {
      return fail('BLOCKED', st.blocks[0].label, { blocks: st.blocks, overridable: true });
    }
    var sameType = st.loans.filter(function (l) {
      var li = item(l.barcode);
      return li && li.type === it.type;
    }).length;
    if (sameType >= pol.maxItems && !opts.override) {
      return fail('LIMIT', PTYPE(p.type) + ' members may hold ' + pol.maxItems + ' ' +
        ITEMTYPE(it.type).toLowerCase() + ' items at a time; this one has ' + sameType + '.',
        { overridable: true });
    }

    /* --- write the transaction -------------------------- */
    var now = LS.clock.now();
    var due = Engine.dueDateFor(p, it, now);
    var lo = {
      id: U.nextId('T'),
      barcode: it.barcode,
      bibId: it.bibId,
      patronId: p.id,
      out: now.toISOString(),
      due: due,
      in: null,
      renewals: 0,
      maxRenewals: pol.renewals,
      branch: opts.branch || Engine.operator.branch,
      channel: opts.channel || 'desk',
      override: !!opts.override
    };
    db.loans.push(lo);

    it.status = 'out';
    it.circCount++;
    it.lastSeen = U.iso(now);

    /* If this copy was trapped for this very patron, close the hold. */
    var myHold = db.holds.find(function (h) {
      return h.patronId === p.id && h.bibId === it.bibId &&
             (h.status === 'ready' || h.status === 'waiting');
    });
    if (myHold) {
      myHold.status = 'fulfilled';
      myHold.fulfilled = U.iso(now);
      myHold.barcode = it.barcode;
    }

    log('Circulation', 'Issue',
        b.title + ' (' + it.barcode + ') to ' + p.name + ', due ' + U.fmtDate(due),
        'ok');
    notify(p, 'checkout', 'Issued: ' + b.title,
           'Due ' + U.fmtDate(due) + '. Renew online at any time before the due date.');

    LS.bus.emit('circ:checkout', { loan: lo, item: it, patron: p, bib: b });
    Engine.recompute();

    return {
      ok: true,
      loan: lo, item: it, patron: p, bib: b, policy: pol,
      msg: b.title + ' issued to ' + p.name,
      detail: 'Due ' + U.fmtDate(due) + ' · ' + pol.loanDays + '-day loan · ' +
              pol.renewals + ' renewals allowed',
      closedHold: myHold ? myHold.id : null
    };
  };

  /* ============================================================
     CHECK-IN
     ============================================================ */

  Engine.checkin = function (barcode, opts) {
    opts = opts || {};
    var it = item(barcode);
    if (!it) return fail('NO_ITEM', 'Barcode ' + barcode + ' is not in the catalogue.');

    var b = bib(it.bibId);
    var lo = Engine.loanForBarcode(barcode);
    var now = LS.clock.now();
    var actions = [];

    /* 1 — close the transaction */
    var p = null, fine = null;
    if (lo) {
      p = patron(lo.patronId);
      lo.in = now.toISOString();
      var overdueBy = U.daysBetween(new Date(lo.due), now);
      actions.push({ icon: '↩', text: 'Loan ' + lo.id + ' closed for ' + p.name });
      if (overdueBy > 0) {
        fine = accrueOverdue(lo, now);
        if (fine) {
          actions.push({ icon: '⚠', tone: 'warn',
            text: overdueBy + ' days overdue — ' + U.money(fine.amount) + ' charged' });
        } else {
          actions.push({ icon: '✓', tone: 'ok',
            text: overdueBy + ' days late but inside the grace period — no charge' });
        }
      }
    } else if (it.status === 'out') {
      actions.push({ icon: '!', tone: 'warn', text: 'No open transaction found — status corrected' });
    } else {
      actions.push({ icon: '·', text: 'Item was not on loan' });
    }

    /* 2 — hold queue gets first refusal on the returned copy */
    var next = db.holds
      .filter(function (h) { return h.bibId === it.bibId && h.status === 'waiting'; })
      .sort(U.by('placed'))[0];

    if (next && !opts.noTrap) {
      next.status = 'ready';
      next.barcode = it.barcode;
      next.readyAt = U.iso(now);
      next.expires = U.iso(U.addDays(now, db.settings.holdShelfDays));
      it.status = next.pickupBranch === it.branch ? 'hold-shelf' : 'in-transit';
      it.destination = next.pickupBranch;
      var np = patron(next.patronId);
      actions.push({ icon: '◆', tone: 'gold',
        text: 'Trapped for hold #' + next.id + ' — ' + np.name +
              (it.status === 'in-transit'
                ? ', routing to ' + branch(next.pickupBranch).name
                : ', on the hold shelf until ' + U.fmtDate(next.expires)) });
      notify(np, 'hold-ready', 'Ready for collection: ' + b.title,
             'Collect at ' + branch(next.pickupBranch).name + ' by ' + U.fmtDate(next.expires) + '.');
      actions.push({ icon: '✉', tone: 'info', text: 'Hold notice sent to ' + np.name });
    } else if (it.branch !== it.homeBranch) {
      it.status = 'in-transit';
      it.destination = it.homeBranch;
      actions.push({ icon: '⇢', tone: 'info',
        text: 'Belongs to ' + branch(it.homeBranch).name + ' — placed in transit' });
    } else {
      it.status = 'available';
      it.destination = null;
      actions.push({ icon: '✓', tone: 'ok', text: 'Shelved as available — live in the catalogue now' });
    }

    it.lastSeen = U.iso(now);
    log('Circulation', 'Return', b.title + ' (' + it.barcode + ')' +
        (p ? ' from ' + p.name : ''), fine ? 'warn' : 'ok');
    LS.bus.emit('circ:checkin', { item: it, loan: lo, patron: p, bib: b, fine: fine });
    Engine.recompute();

    return {
      ok: true, item: it, bib: b, loan: lo, patron: p, fine: fine,
      actions: actions,
      msg: b.title + ' returned',
      detail: actions.map(function (a) { return a.text; }).join(' · ')
    };
  };

  /* ============================================================
     RENEW
     ============================================================ */

  Engine.renew = function (loanId, opts) {
    opts = opts || {};
    var lo = loan(loanId);
    if (!lo || lo.in) return fail('NO_LOAN', 'That loan is no longer open.');

    var p = patron(lo.patronId);
    var it = item(lo.barcode);
    var b = bib(lo.bibId);
    var pol = Engine.policyFor(p.type, it.type);

    if (lo.renewals >= pol.renewals) {
      return fail('RENEW_LIMIT', 'Renewal limit reached (' + pol.renewals + ' of ' +
        pol.renewals + ' used). Return the copy to reset it.');
    }
    var waiting = db.holds.filter(function (h) {
      return h.bibId === lo.bibId && (h.status === 'waiting' || h.status === 'ready');
    });
    var avail = Engine.availability(lo.bibId).available;
    if (waiting.length > avail) {
      return fail('HELD', waiting.length + ' member' + (waiting.length > 1 ? 's are' : ' is') +
        ' waiting for this title — it cannot be renewed.');
    }
    var st = Engine.patronState(p.id);
    if (st.blocked && !opts.override) {
      return fail('BLOCKED', st.blocks[0].label, { blocks: st.blocks, overridable: true });
    }

    var now = LS.clock.now();
    var from = U.daysBetween(now, new Date(lo.due)) > 0 ? new Date(lo.due) : now;
    lo.due = Engine.dueDateFor(p, it, from);
    lo.renewals++;
    lo.lastRenewed = now.toISOString();

    log('Circulation', 'Renew', b.title + ' for ' + p.name + ' — now due ' + U.fmtDate(lo.due),
        'ok');
    notify(p, 'renewal', 'Renewed: ' + b.title, 'New due date ' + U.fmtDate(lo.due) + '.');
    LS.bus.emit('circ:renew', { loan: lo, patron: p, bib: b });
    Engine.recompute();

    return {
      ok: true, loan: lo, bib: b, patron: p,
      msg: b.title + ' renewed',
      detail: 'Now due ' + U.fmtDate(lo.due) + ' · renewal ' + lo.renewals + ' of ' + pol.renewals
    };
  };

  /* ============================================================
     HOLDS
     ============================================================ */

  Engine.placeHold = function (patronId, bibId, pickupBranch, opts) {
    opts = opts || {};
    var p = patron(patronId);
    var b = bib(bibId);
    if (!p || !b) return fail('NO_RECORD', 'Record not found.');

    var existing = db.holds.find(function (h) {
      return h.patronId === patronId && h.bibId === bibId &&
             (h.status === 'waiting' || h.status === 'ready');
    });
    if (existing) return fail('DUPLICATE', 'You already have a hold on this title (position ' +
      Engine.holdPosition(existing.id) + ').');

    var onLoanToMe = Engine.loansOf(patronId).some(function (l) { return l.bibId === bibId; });
    if (onLoanToMe) return fail('HAS_COPY', 'This title is already on loan to you — renew it instead.');

    if (Engine.holdsOf(patronId).length >= db.settings.maxHoldsPerPatron) {
      return fail('HOLD_LIMIT', 'Hold limit reached (' + db.settings.maxHoldsPerPatron + ').');
    }
    var st = Engine.patronState(patronId);
    if (st.blocked && !opts.override) {
      return fail('BLOCKED', st.blocks[0].label, { blocks: st.blocks, overridable: true });
    }
    var holdable = Engine.itemsOf(bibId).some(function (i) {
      return Engine.policyFor(p.type, i.type).holdable;
    });
    if (!holdable) return fail('NOT_HOLDABLE', 'This title cannot be reserved by ' +
      PTYPE(p.type) + ' members.');

    var now = LS.clock.now();
    var h = {
      id: U.nextId('H'),
      bibId: bibId,
      patronId: patronId,
      placed: now.toISOString(),
      pickupBranch: pickupBranch || p.branch,
      status: 'waiting',
      barcode: null,
      readyAt: null,
      expires: null,
      channel: opts.channel || 'opac'
    };
    db.holds.push(h);

    var pos = Engine.holdPosition(h.id);
    var avail = Engine.availability(bibId);
    var onShelf = avail.available > 0;

    log('Circulation', 'Hold placed',
        b.title + ' for ' + p.name + ' — position ' + pos +
        (onShelf ? ' (copy on shelf, added to pull list)' : ''), 'gold');
    LS.bus.emit('circ:hold', { hold: h, patron: p, bib: b });
    Engine.recompute();

    return {
      ok: true, hold: h, bib: b, position: pos, pullable: onShelf,
      msg: 'Hold placed on ' + b.title,
      detail: onShelf
        ? 'A copy is on the shelf — it is on today’s pull list for ' +
          branch(h.pickupBranch).name + '.'
        : 'You are number ' + pos + ' in the queue. ' + avail.out +
          ' cop' + (avail.out === 1 ? 'y is' : 'ies are') + ' on loan.'
    };
  };

  Engine.holdPosition = function (holdId) {
    var h = hold(holdId);
    if (!h) return 0;
    var queue = db.holds
      .filter(function (x) { return x.bibId === h.bibId &&
        (x.status === 'waiting' || x.status === 'ready'); })
      .sort(U.by('placed'));
    return queue.findIndex(function (x) { return x.id === holdId; }) + 1;
  };

  Engine.cancelHold = function (holdId, reason) {
    var h = hold(holdId);
    if (!h) return fail('NO_HOLD', 'Hold not found.');
    var b = bib(h.bibId), p = patron(h.patronId);
    h.status = 'cancelled';
    h.cancelled = U.iso(LS.clock.now());
    h.cancelReason = reason || 'Cancelled by request';

    /* If a copy was sitting on the shelf for this hold, free it —
       and give the next person in the queue their turn. */
    if (h.barcode) {
      var it = item(h.barcode);
      if (it && (it.status === 'hold-shelf' || it.status === 'in-transit')) {
        var next = db.holds
          .filter(function (x) { return x.bibId === h.bibId && x.status === 'waiting'; })
          .sort(U.by('placed'))[0];
        if (next) {
          next.status = 'ready';
          next.barcode = it.barcode;
          next.readyAt = U.iso(LS.clock.now());
          next.expires = U.iso(U.addDays(LS.clock.now(), db.settings.holdShelfDays));
          notify(patron(next.patronId), 'hold-ready', 'Ready for collection: ' + b.title,
                 'Collect at ' + branch(next.pickupBranch).name + ' by ' + U.fmtDate(next.expires) + '.');
        } else {
          it.status = it.branch === it.homeBranch ? 'available' : 'in-transit';
        }
      }
    }
    log('Circulation', 'Hold cancelled', b.title + ' — ' + p.name, 'warn');
    LS.bus.emit('circ:hold-cancel', { hold: h });
    Engine.recompute();
    return { ok: true, msg: 'Hold on ' + b.title + ' cancelled', hold: h };
  };

  /** Titles with a copy on the shelf and someone waiting — staff go and fetch these. */
  Engine.pullList = function (branchCode) {
    var out = [];
    db.holds.filter(function (h) { return h.status === 'waiting'; })
      .sort(U.by('placed'))
      .forEach(function (h) {
        var copy = Engine.itemsOf(h.bibId).find(function (i) {
          return i.status === 'available' &&
                 (!branchCode || i.branch === branchCode);
        });
        if (copy && !out.some(function (o) { return o.item.barcode === copy.barcode; })) {
          out.push({ hold: h, item: copy, bib: bib(h.bibId), patron: patron(h.patronId) });
        }
      });
    return out;
  };

  /** Staff capture a copy straight off the pull list. */
  Engine.trapHold = function (holdId, barcode) {
    var h = hold(holdId);
    var it = item(barcode);
    if (!h || !it) return fail('NO_RECORD', 'Record not found.');
    if (it.status !== 'available') return fail('NOT_AVAILABLE', 'That copy is no longer on the shelf.');
    var now = LS.clock.now();
    h.status = 'ready';
    h.barcode = it.barcode;
    h.readyAt = U.iso(now);
    h.expires = U.iso(U.addDays(now, db.settings.holdShelfDays));
    it.status = h.pickupBranch === it.branch ? 'hold-shelf' : 'in-transit';
    it.destination = h.pickupBranch;
    var p = patron(h.patronId), b = bib(h.bibId);
    notify(p, 'hold-ready', 'Ready for collection: ' + b.title,
           'Collect at ' + branch(h.pickupBranch).name + ' by ' + U.fmtDate(h.expires) + '.');
    log('Circulation', 'Hold trapped', b.title + ' held for ' + p.name, 'gold');
    LS.bus.emit('circ:trap', { hold: h, item: it });
    Engine.recompute();
    return { ok: true, msg: b.title + ' captured for ' + p.name,
             detail: 'Hold shelf until ' + U.fmtDate(h.expires) + ' · notice sent' };
  };

  /** Receive an in-transit copy at its destination branch. */
  Engine.receiveTransit = function (barcode) {
    var it = item(barcode);
    if (!it || it.status !== 'in-transit') return fail('NOT_TRANSIT', 'That copy is not in transit.');
    var dest = it.destination || it.homeBranch;
    it.branch = dest;
    var h = db.holds.find(function (x) { return x.barcode === it.barcode && x.status === 'ready'; });
    it.status = h ? 'hold-shelf' : 'available';
    it.destination = null;
    log('Circulation', 'Transit received',
        bib(it.bibId).title + ' arrived at ' + branch(dest).name, 'ok');
    Engine.recompute();
    return { ok: true, msg: 'Received at ' + branch(dest).name,
             detail: h ? 'Placed on the hold shelf' : 'Shelved as available' };
  };

  /* ============================================================
     FINES
     ============================================================ */

  function upsertFine(rec) {
    var found = db.fines.find(function (f) {
      return f.ref === rec.ref && f.type === rec.type && f.status === 'outstanding';
    });
    if (found) {
      found.amount = rec.amount;
      found.updated = rec.created;
      return found;
    }
    rec.id = U.nextId('F');
    rec.paidAmount = 0;
    rec.status = 'outstanding';
    db.fines.push(rec);
    return rec;
  }

  /** Charge (or update) the overdue fine on a loan, respecting grace and cap. */
  function accrueOverdue(lo, asOf) {
    var p = patron(lo.patronId);
    var it = item(lo.barcode);
    if (!p || !it) return null;
    var pol = Engine.policyFor(p.type, it.type);
    if (!pol.finePerDay) return null;
    var late = U.daysBetween(new Date(lo.due), asOf || LS.clock.now());
    var billable = late - pol.graceDays;
    if (billable <= 0) return null;
    var amount = Math.min(billable * pol.finePerDay, pol.fineCap || Infinity);
    return upsertFine({
      patronId: p.id,
      type: 'overdue',
      ref: lo.id,
      bibId: lo.bibId,
      barcode: lo.barcode,
      description: 'Overdue — ' + bib(lo.bibId).title + ' (' + billable + ' billable day' +
                   (billable === 1 ? '' : 's') + ' @ ' + U.money(pol.finePerDay) + ')',
      amount: Math.round(amount * 100) / 100,
      created: U.iso(asOf || LS.clock.now())
    });
  }
  Engine.accrueOverdue = accrueOverdue;

  Engine.payFine = function (fineId, amount, method) {
    var f = db.fines.find(function (x) { return x.id === fineId; });
    if (!f || f.status !== 'outstanding') return fail('NO_FINE', 'Nothing outstanding on that charge.');
    var owing = f.amount - f.paidAmount;
    var pay = Math.min(amount === undefined ? owing : amount, owing);
    f.paidAmount += pay;
    f.method = method || 'cash';
    if (f.paidAmount >= f.amount - 0.001) {
      f.status = 'paid';
      f.paidOn = U.iso(LS.clock.now());
    }
    var p = patron(f.patronId);
    log('Fines', 'Payment', U.money(pay) + ' from ' + p.name +
        ' (' + (method || 'cash') + ') against ' + f.id, 'ok');
    LS.bus.emit('fines:pay', { fine: f, amount: pay });
    Engine.recompute();
    return { ok: true, msg: U.money(pay) + ' received', fine: f,
             detail: f.status === 'paid' ? 'Charge cleared' :
                     U.money(f.amount - f.paidAmount) + ' still outstanding' };
  };

  Engine.payAll = function (patronId, method) {
    var owed = Engine.finesOf(patronId, true);
    var total = U.sum(owed, function (f) { return f.amount - f.paidAmount; });
    owed.forEach(function (f) { Engine.payFine(f.id, undefined, method); });
    return { ok: true, msg: U.money(total) + ' settled', detail: owed.length + ' charge(s) cleared' };
  };

  Engine.waiveFine = function (fineId, reason) {
    var f = db.fines.find(function (x) { return x.id === fineId; });
    if (!f || f.status !== 'outstanding') return fail('NO_FINE', 'Nothing outstanding on that charge.');
    f.status = 'waived';
    f.waivedOn = U.iso(LS.clock.now());
    f.waiveReason = reason || 'Waived at the desk';
    log('Fines', 'Waiver', U.money(f.amount - f.paidAmount) + ' waived for ' +
        patron(f.patronId).name + ' — ' + f.waiveReason, 'warn');
    LS.bus.emit('fines:waive', { fine: f });
    Engine.recompute();
    return { ok: true, msg: 'Charge waived', fine: f, detail: f.waiveReason };
  };

  Engine.declareLost = function (loanId) {
    var lo = loan(loanId);
    if (!lo || lo.in) return fail('NO_LOAN', 'That loan is not open.');
    var it = item(lo.barcode);
    var b = bib(lo.bibId);
    var p = patron(lo.patronId);
    var now = LS.clock.now();

    accrueOverdue(lo, now);
    upsertFine({
      patronId: p.id, type: 'lost', ref: lo.id, bibId: lo.bibId, barcode: lo.barcode,
      description: 'Lost item — ' + b.title + ' (replacement ' + U.money(it.price) +
                   ' + ' + U.money(db.settings.lostProcessingFee) + ' processing)',
      amount: it.price + db.settings.lostProcessingFee,
      created: U.iso(now)
    });

    it.status = 'lost';
    lo.in = now.toISOString();
    lo.closedAs = 'lost';
    log('Circulation', 'Declared lost', b.title + ' — billed to ' + p.name, 'danger');
    notify(p, 'lost', 'Billed: ' + b.title,
           'Replacement cost ' + U.money(it.price + db.settings.lostProcessingFee) +
           ' has been added to your account.');
    LS.bus.emit('circ:lost', { loan: lo, item: it });
    Engine.recompute();
    return { ok: true, msg: b.title + ' marked lost',
             detail: U.money(it.price + db.settings.lostProcessingFee) + ' billed to ' + p.name };
  };

  Engine.addManualCharge = function (patronId, type, amount, description) {
    var rec = upsertFine({
      patronId: patronId, type: type || 'fee', ref: U.uid(),
      description: description || 'Manual charge',
      amount: Number(amount) || 0,
      created: U.iso(LS.clock.now())
    });
    log('Fines', 'Charge added', U.money(rec.amount) + ' — ' + rec.description, 'warn');
    Engine.recompute();
    return { ok: true, msg: U.money(rec.amount) + ' charged', fine: rec };
  };

  /* ============================================================
     notices
     ============================================================ */

  function notify(p, type, subject, body) {
    if (!p) return null;
    var n = {
      id: U.uid(),
      type: type,
      patronId: p.id,
      channel: p.phone && (type === 'hold-ready' || type === 'overdue') ? 'sms' : 'email',
      to: p.phone && (type === 'hold-ready' || type === 'overdue') ? p.phone : p.email,
      subject: subject,
      body: body,
      sentAt: LS.clock.now().toISOString(),
      status: 'sent'
    };
    db.notices.unshift(n);
    if (db.notices.length > 200) db.notices.length = 200;
    LS.bus.emit('notice', n);
    return n;
  }
  Engine.notify = notify;

  /* ============================================================
     the nightly job
     ============================================================ */

  /** What runs at 02:00 while the building is dark: accrue fines,
      send notices, expire stale holds, claim late serials. */
  Engine.runNightly = function () {
    var now = LS.clock.now();
    var out = { fines: 0, fineTotal: 0, overdueNotices: 0, dueSoon: 0,
                holdReminders: 0, expiredHolds: 0, membershipWarnings: 0,
                claims: 0, transitAlerts: 0 };

    /* 1 — accrue overdue fines on every open loan */
    Engine.openLoans().forEach(function (lo) {
      var late = U.daysBetween(new Date(lo.due), now);
      if (late > 0) {
        var f = accrueOverdue(lo, now);
        if (f) { out.fines++; out.fineTotal += f.amount; }
        if (late === 1 || late % 7 === 0) {
          notify(patron(lo.patronId), 'overdue', 'Overdue: ' + bib(lo.bibId).title,
                 late + ' days overdue. Charges accrue daily until it is returned.');
          out.overdueNotices++;
        }
      } else if (late >= -2) {
        notify(patron(lo.patronId), 'due-soon', 'Due soon: ' + bib(lo.bibId).title,
               'Due ' + U.fmtDate(lo.due) + '. Renew online if you need longer.');
        out.dueSoon++;
      }
    });

    /* 2 — expire holds left on the shelf too long */
    db.holds.filter(function (h) { return h.status === 'ready' && h.expires; })
      .forEach(function (h) {
        if (U.daysBetween(new Date(h.expires), now) > 0) {
          h.status = 'expired';
          var it = item(h.barcode);
          var nxt = db.holds.filter(function (x) {
            return x.bibId === h.bibId && x.status === 'waiting';
          }).sort(U.by('placed'))[0];
          if (it) {
            if (nxt) {
              nxt.status = 'ready';
              nxt.barcode = it.barcode;
              nxt.readyAt = U.iso(now);
              nxt.expires = U.iso(U.addDays(now, db.settings.holdShelfDays));
              notify(patron(nxt.patronId), 'hold-ready',
                     'Ready for collection: ' + bib(h.bibId).title,
                     'Collect by ' + U.fmtDate(nxt.expires) + '.');
              out.holdReminders++;
            } else {
              it.status = it.branch === it.homeBranch ? 'available' : 'in-transit';
            }
          }
          out.expiredHolds++;
        } else {
          notify(patron(h.patronId), 'hold-reminder',
                 'Waiting for you: ' + bib(h.bibId).title,
                 'On the hold shelf until ' + U.fmtDate(h.expires) + '.');
          out.holdReminders++;
        }
      });

    /* 3 — membership expiry warnings */
    db.patrons.forEach(function (p) {
      var left = U.daysBetween(now, new Date(p.expires));
      if (left >= 0 && left <= 30) {
        notify(p, 'expiry', 'Your membership expires ' + U.fmtDate(p.expires),
               'Renew at any service desk or through your online account.');
        out.membershipWarnings++;
      }
    });

    /* 4 — claim serial issues that never arrived */
    db.serials.forEach(function (s) {
      s.issues.forEach(function (iss) {
        if (iss.status === 'late' && !iss.claimed &&
            U.daysBetween(new Date(iss.expected), now) > 7) {
          iss.claimed = true;
          iss.claimedOn = U.iso(now);
          out.claims++;
        }
      });
    });

    /* 5 — vendor claims for late orders */
    db.orders.forEach(function (o) {
      if (o.status === 'ordered' && o.ordered) {
        var v = db.vendors.find(function (x) { return x.code === o.vendor; });
        if (v && U.daysBetween(new Date(o.ordered), now) > v.leadDays + 14) {
          o.status = 'claimed';
          o.claimedOn = U.iso(now);
          out.claims++;
        }
      }
    });

    log('Automation', 'Nightly job',
        out.fines + ' fines accrued · ' + (out.overdueNotices + out.dueSoon + out.holdReminders +
        out.membershipWarnings) + ' notices sent · ' + out.expiredHolds + ' holds expired',
        'info');
    LS.bus.emit('job:nightly', out);
    Engine.recompute();
    return out;
  };

  /** Move the demo clock forward and run the job for each day skipped. */
  Engine.advanceDays = function (n) {
    var results = [];
    for (var i = 0; i < n; i++) {
      LS.clock.advance(1);
      results.push(Engine.runNightly());
    }
    LS.bus.emit('clock:change', LS.clock.offsetDays);
    return results.reduce(function (a, r) {
      Object.keys(r).forEach(function (k) { a[k] = (a[k] || 0) + r[k]; });
      return a;
    }, {});
  };

  /* ============================================================
     cataloguing
     ============================================================ */

  Engine.createBib = function (data) {
    var b = {
      id: 'B' + String(db.bibs.length + 1).padStart(4, '0'),
      title: data.title, author: data.author || 'Unknown',
      isbn: data.isbn || '', publisher: data.publisher || '',
      year: Number(data.year) || new Date().getFullYear(),
      lang: data.lang || 'English',
      subjects: (data.subjects || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      dewey: data.dewey || 'UNCLASSIFIED',
      format: data.format || 'Book',
      summary: data.summary || '',
      eresource: null,
      created: U.iso(LS.clock.now()),
      source: data.source || 'Original cataloguing'
    };
    db.bibs.push(b);
    log('Cataloguing', 'Bib created', b.title + ' — ' + b.id, 'gold');
    LS.bus.emit('cat:bib', b);
    Engine.recompute();
    return { ok: true, bib: b, msg: 'Bibliographic record ' + b.id + ' created',
             detail: 'Searchable in the public catalogue immediately' };
  };

  Engine.addItem = function (bibId, data) {
    var b = bib(bibId);
    if (!b) return fail('NO_BIB', 'Bibliographic record not found.');
    var existing = Engine.itemsOf(bibId).length;
    var it = {
      barcode: data.barcode || String(3900000 + db.items.length),
      bibId: bibId,
      branch: data.branch || 'MAIN',
      homeBranch: data.branch || 'MAIN',
      type: data.type || 'BOOK',
      status: data.type === 'REF' ? 'reference' : (data.status || 'in-process'),
      callNo: data.callNo || b.dewey + (existing ? ' c.' + (existing + 1) : ''),
      accession: data.accession || 'AC-' + (20000 + db.items.length),
      price: Number(data.price) || 0,
      added: U.iso(LS.clock.now()),
      circCount: 0,
      lastSeen: U.iso(LS.clock.now()),
      shelf: data.shelf || 'Processing',
      note: data.note || ''
    };
    db.items.push(it);
    log('Cataloguing', 'Item added', b.title + ' — barcode ' + it.barcode +
        ' at ' + it.branch, 'gold');
    LS.bus.emit('cat:item', it);
    Engine.recompute();
    return { ok: true, item: it, bib: b, msg: 'Copy ' + it.barcode + ' attached to ' + b.title,
             detail: it.status === 'in-process'
               ? 'In process — set to available when it reaches the shelf'
               : 'Status: ' + it.status };
  };

  Engine.setItemStatus = function (barcode, status, note) {
    var it = item(barcode);
    if (!it) return fail('NO_ITEM', 'Copy not found.');
    var was = it.status;
    it.status = status;
    if (note !== undefined) it.note = note;
    log('Cataloguing', 'Status change',
        bib(it.bibId).title + ' (' + barcode + ') ' + was + ' → ' + status,
        status === 'withdrawn' || status === 'lost' ? 'danger' : 'info');
    Engine.recompute();
    return { ok: true, item: it, msg: 'Copy ' + barcode + ' set to ' + status };
  };

  /** Simulated Z39.50 / MARC fetch — the cataloguer's normal first move. */
  Engine.importMarc = function (isbn) {
    var CANNED = {
      '9780143127741': { title: 'Being Mortal', author: 'Gawande, Atul',
        publisher: 'Metropolitan Books', year: 2014, dewey: '362.175 GAW',
        subjects: 'Terminal care, Medical ethics, Aging',
        summary: 'What matters in the end, and how medicine keeps missing it.' },
      '9780062457738': { title: 'The Subtle Art of Not Giving a F*ck', author: 'Manson, Mark',
        publisher: 'HarperOne', year: 2016, dewey: '158.1 MAN',
        subjects: 'Conduct of life, Self-actualization',
        summary: 'A counterintuitive approach to living a good life.' },
      '9789353452940': { title: 'India After Gandhi', author: 'Guha, Ramachandra',
        publisher: 'Picador India', year: 2017, dewey: '954.04 GUH',
        subjects: 'India — History, Democracy, Post-colonialism',
        summary: 'The history of the world’s largest democracy since 1947.' }
    };
    var hit = CANNED[String(isbn).replace(/[^0-9Xx]/g, '')];
    if (!hit) {
      return { ok: false, reason: 'NOT_FOUND',
               msg: 'No matching record on the union catalogue for ' + isbn +
                    '. Catalogue it originally, or try 9789353452940 / 9780143127741 / 9780062457738.' };
    }
    return { ok: true, record: Object.assign({ isbn: isbn, lang: 'English', format: 'Book',
             source: 'Z39.50 — Library of Congress' }, hit),
             msg: 'MARC record retrieved', detail: 'Z39.50 · ISO 2709 · 14 fields mapped' };
  };

  /* ============================================================
     patrons
     ============================================================ */

  Engine.registerPatron = function (data) {
    var p = {
      id: 'P' + String(db.patrons.length + 1).padStart(4, '0'),
      cardNo: data.cardNo || String(2100000 + db.patrons.length * 137),
      name: data.name,
      type: data.type || 'UG',
      branch: data.branch || 'MAIN',
      email: data.email || '',
      phone: data.phone || '',
      guarantor: data.guarantor || null,
      registered: U.iso(LS.clock.now()),
      expires: U.iso(U.addDays(LS.clock.now(), Number(data.months || 12) * 30)),
      manualBlock: null,
      notes: [],
      historyOptIn: data.historyOptIn !== false,
      pin: '1234'
    };
    db.patrons.push(p);
    log('Membership', 'Registered', p.name + ' — ' + PTYPE(p.type) + ' — card ' + p.cardNo, 'gold');
    notify(p, 'welcome', 'Welcome to ' + db.settings.libraryName,
           'Your card number is ' + p.cardNo + '. It is valid until ' + U.fmtDate(p.expires) + '.');
    LS.bus.emit('patron:new', p);
    Engine.recompute();
    return { ok: true, patron: p, msg: p.name + ' registered',
             detail: 'Card ' + p.cardNo + ' · valid to ' + U.fmtDate(p.expires) };
  };

  Engine.renewMembership = function (patronId, months) {
    var p = patron(patronId);
    if (!p) return fail('NO_PATRON', 'Patron not found.');
    var from = U.daysBetween(U.today(), new Date(p.expires)) > 0 ? new Date(p.expires) : U.today();
    p.expires = U.iso(U.addDays(from, Number(months || 12) * 30));
    log('Membership', 'Renewed', p.name + ' — valid to ' + U.fmtDate(p.expires), 'ok');
    Engine.recompute();
    return { ok: true, msg: 'Membership renewed', detail: 'Valid to ' + U.fmtDate(p.expires) };
  };

  Engine.setBlock = function (patronId, reason) {
    var p = patron(patronId);
    if (!p) return fail('NO_PATRON', 'Patron not found.');
    p.manualBlock = reason || null;
    log('Membership', reason ? 'Block applied' : 'Block cleared',
        p.name + (reason ? ' — ' + reason : ''), reason ? 'danger' : 'ok');
    Engine.recompute();
    return { ok: true, msg: reason ? 'Block applied to ' + p.name : 'Block cleared for ' + p.name };
  };

  Engine.anonymiseHistory = function (patronId) {
    var p = patron(patronId);
    var n = 0;
    db.loans.forEach(function (l) {
      if (l.patronId === patronId && l.in) { l.patronId = 'ANON'; n++; }
    });
    p.historyOptIn = false;
    log('Membership', 'History purged', n + ' closed loans anonymised for ' + p.name, 'info');
    Engine.recompute();
    return { ok: true, msg: n + ' closed loans anonymised',
             detail: 'Reading history is no longer linked to this member' };
  };

  /* ============================================================
     acquisitions
     ============================================================ */

  Engine.createOrder = function (data) {
    var total = Number(data.qty) * Number(data.unitPrice);
    var f = fund(data.fund);
    if (!f) return fail('NO_FUND', 'Fund not found.');
    var free = f.allocated - f.encumbered - f.spent;
    if (total > free) {
      return fail('OVER_BUDGET', 'Only ' + U.money0(free) + ' is free on ' + f.code +
        ' — this order needs ' + U.money0(total) + '.');
    }
    var o = {
      id: 'O' + String(db.orders.length + 1).padStart(4, '0'),
      po: 'PO-2026-' + (1040 + db.orders.length),
      vendor: data.vendor, fund: data.fund,
      title: data.title, author: data.author || '', isbn: data.isbn || '',
      qty: Number(data.qty), unitPrice: Number(data.unitPrice), total: total,
      status: data.status || 'suggested',
      requestedBy: data.requestedBy || Engine.operator.name,
      created: U.iso(LS.clock.now()),
      ordered: null, received: null, invoiced: null, invoiceNo: null, claimedOn: null
    };
    db.orders.push(o);
    log('Acquisitions', 'Order created', o.po + ' — ' + o.title + ' x' + o.qty +
        ' — ' + U.money0(total), 'gold');
    LS.bus.emit('acq:order', o);
    Engine.recompute();
    return { ok: true, order: o, msg: o.po + ' created', detail: o.title + ' · ' + U.money0(total) };
  };

  /** suggested -> ordered -> received -> invoiced, with the money moving
      from free, to encumbered, to spent. */
  Engine.advanceOrder = function (orderId, opts) {
    opts = opts || {};
    var o = db.orders.find(function (x) { return x.id === orderId; });
    if (!o) return fail('NO_ORDER', 'Order not found.');
    var f = fund(o.fund);
    var now = U.iso(LS.clock.now());

    if (o.status === 'suggested') {
      var free = f.allocated - f.encumbered - f.spent;
      if (o.total > free) return fail('OVER_BUDGET', 'Insufficient free balance on ' + f.code + '.');
      o.status = 'ordered';
      o.ordered = now;
      f.encumbered += o.total;
      log('Acquisitions', 'Order placed', o.po + ' sent to ' +
          db.vendors.find(function (v) { return v.code === o.vendor; }).name +
          ' — ' + U.money0(o.total) + ' encumbered on ' + f.code, 'gold');
      Engine.recompute();
      return { ok: true, order: o, msg: o.po + ' sent to vendor',
               detail: U.money0(o.total) + ' encumbered on ' + f.code + ' — it cannot be overspent' };
    }

    if (o.status === 'ordered' || o.status === 'claimed') {
      o.status = 'received';
      o.received = now;
      log('Acquisitions', 'Received', o.qty + ' cop' + (o.qty === 1 ? 'y' : 'ies') +
          ' of ' + o.title + ' checked in against ' + o.po, 'ok');
      Engine.recompute();
      return { ok: true, order: o, msg: o.qty + ' received against ' + o.po,
               detail: 'Ready for accessioning and cataloguing' };
    }

    if (o.status === 'received') {
      o.status = 'invoiced';
      o.invoiced = now;
      o.invoiceNo = 'INV-' + (88100 + db.orders.length);
      f.encumbered = Math.max(0, f.encumbered - o.total);
      f.spent += o.total;
      log('Acquisitions', 'Invoice posted', o.invoiceNo + ' — ' + U.money0(o.total) +
          ' moved from encumbered to spent on ' + f.code, 'ok');
      Engine.recompute();
      return { ok: true, order: o, msg: 'Invoice ' + o.invoiceNo + ' posted',
               detail: U.money0(o.total) + ' is now expenditure, not encumbrance' };
    }

    return fail('DONE', 'This order has already been invoiced.');
  };

  /** Turn a received order into a bib + the copies that were delivered. */
  Engine.accession = function (orderId, opts) {
    opts = opts || {};
    var o = db.orders.find(function (x) { return x.id === orderId; });
    if (!o) return fail('NO_ORDER', 'Order not found.');
    if (o.status !== 'received' && o.status !== 'invoiced') {
      return fail('NOT_RECEIVED', 'Receive the shipment before accessioning it.');
    }
    if (o.accessioned) return fail('DONE', 'This order has already been accessioned.');

    var res = Engine.createBib({
      title: o.title, author: o.author, isbn: o.isbn, publisher: o.vendor,
      year: new Date(LS.clock.now()).getFullYear(),
      dewey: opts.dewey || 'NEW ' + (o.author || o.title).slice(0, 3).toUpperCase(),
      subjects: opts.subjects || '', summary: 'Acquired on ' + o.po + '.',
      source: 'Acquisitions — ' + o.po
    });
    var made = [];
    for (var i = 0; i < o.qty; i++) {
      made.push(Engine.addItem(res.bib.id, {
        branch: opts.branch || 'MAIN',
        type: opts.type || 'BOOK',
        price: o.unitPrice,
        status: 'available',
        shelf: 'New acquisitions'
      }).item);
    }
    o.accessioned = U.iso(LS.clock.now());
    o.bibId = res.bib.id;
    log('Acquisitions', 'Accessioned', o.qty + ' copies of ' + o.title +
        ' catalogued and shelved from ' + o.po, 'gold');
    Engine.recompute();
    return { ok: true, bib: res.bib, items: made,
             msg: o.title + ' accessioned', detail: o.qty + ' copies live in the catalogue now' };
  };

  /* ============================================================
     serials
     ============================================================ */

  Engine.receiveIssue = function (serialId, issueId) {
    var s = db.serials.find(function (x) { return x.id === serialId; });
    if (!s) return fail('NO_SERIAL', 'Serial not found.');
    var iss = s.issues.find(function (x) { return x.id === issueId; });
    if (!iss) return fail('NO_ISSUE', 'Issue not found.');
    if (iss.received) return fail('DONE', 'That issue is already checked in.');
    iss.received = U.iso(LS.clock.now());
    iss.status = 'received';
    iss.claimed = false;
    /* predict the next one */
    var last = s.issues[s.issues.length - 1];
    if (last.id === iss.id) {
      var n = parseInt((last.label.match(/no\. (\d+)/) || [0, 0])[1], 10) + 1;
      s.issues.push({
        id: U.uid(),
        label: 'Vol. ' + s.volume + ', no. ' + n,
        expected: U.iso(U.addDays(new Date(last.expected), s.intervalDays)),
        received: null, status: 'expected', claimed: false, bound: false
      });
    }
    log('Serials', 'Issue received', s.title + ' — ' + iss.label, 'ok');
    Engine.recompute();
    return { ok: true, msg: iss.label + ' received', detail: s.title + ' · next issue predicted' };
  };

  Engine.claimIssue = function (serialId, issueId) {
    var s = db.serials.find(function (x) { return x.id === serialId; });
    var iss = s && s.issues.find(function (x) { return x.id === issueId; });
    if (!iss) return fail('NO_ISSUE', 'Issue not found.');
    iss.claimed = true;
    iss.claimedOn = U.iso(LS.clock.now());
    var v = db.vendors.find(function (x) { return x.code === s.vendor; });
    log('Serials', 'Claim sent', s.title + ' ' + iss.label + ' claimed from ' + v.name, 'warn');
    Engine.recompute();
    return { ok: true, msg: 'Claim sent to ' + v.name, detail: s.title + ' — ' + iss.label };
  };

  Engine.bindVolume = function (serialId) {
    var s = db.serials.find(function (x) { return x.id === serialId; });
    if (!s) return fail('NO_SERIAL', 'Serial not found.');
    var ready = s.issues.filter(function (i) { return i.status === 'received' && !i.bound; });
    if (ready.length < 3) return fail('TOO_FEW', 'Bind at least three received issues into a volume.');
    ready.forEach(function (i) { i.bound = true; });

    var b = db.bibs.find(function (x) { return x.title === s.title + ' — bound volumes'; });
    if (!b) {
      b = Engine.createBib({
        title: s.title + ' — bound volumes', author: s.title, isbn: s.issn,
        publisher: 'Bound in-house', dewey: 'PER ' + s.title.slice(0, 3).toUpperCase(),
        format: 'Bound serial', subjects: 'Periodicals',
        summary: 'Bound runs of ' + s.title + '.', source: 'Serials — binding'
      }).bib;
    }
    var it = Engine.addItem(b.id, {
      branch: s.branch, type: 'SERIAL', status: 'available',
      callNo: 'PER ' + s.title.slice(0, 3).toUpperCase() + ' v.' + s.volume,
      shelf: 'Bound periodicals'
    }).item;
    log('Serials', 'Volume bound', ready.length + ' issues of ' + s.title +
        ' bound as ' + it.callNo, 'gold');
    Engine.recompute();
    return { ok: true, msg: ready.length + ' issues bound',
             detail: 'New circulating item ' + it.barcode + ' — ' + it.callNo };
  };

  /* ============================================================
     reports & statistics
     ============================================================ */

  Engine.stats = function () {
    var today = U.today();
    var open = Engine.openLoans();
    var overdue = open.filter(function (l) { return U.daysBetween(today, new Date(l.due)) < 0; });
    var dueToday = open.filter(function (l) { return U.daysBetween(today, new Date(l.due)) === 0; });
    var outstanding = db.fines.filter(function (f) { return f.status === 'outstanding'; });
    var readyHolds = db.holds.filter(function (h) { return h.status === 'ready'; });
    var waiting = db.holds.filter(function (h) { return h.status === 'waiting'; });
    var circulable = db.items.filter(function (i) {
      return i.status !== 'withdrawn' && i.status !== 'licensed';
    });
    return {
      bibs: db.bibs.length,
      items: db.items.length,
      patrons: db.patrons.length,
      activePatrons: db.patrons.filter(function (p) {
        return U.daysBetween(today, new Date(p.expires)) >= 0;
      }).length,
      onLoan: open.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      holdsReady: readyHolds.length,
      holdsWaiting: waiting.length,
      pullList: Engine.pullList().length,
      inTransit: db.items.filter(function (i) { return i.status === 'in-transit'; }).length,
      available: db.items.filter(function (i) { return i.status === 'available'; }).length,
      lost: db.items.filter(function (i) { return i.status === 'lost'; }).length,
      finesOutstanding: U.sum(outstanding, function (f) { return f.amount - f.paidAmount; }),
      finesCount: outstanding.length,
      collected: U.sum(db.fines.filter(function (f) { return f.status === 'paid'; }),
                       function (f) { return f.paidAmount; }),
      utilisation: U.pct(open.length, circulable.length),
      budgetAllocated: U.sum(db.funds, function (f) { return f.allocated; }),
      budgetEncumbered: U.sum(db.funds, function (f) { return f.encumbered; }),
      budgetSpent: U.sum(db.funds, function (f) { return f.spent; }),
      noticesToday: db.notices.filter(function (n) {
        return U.iso(new Date(n.sentAt)) === U.iso(today);
      }).length,
      openOrders: db.orders.filter(function (o) {
        return o.status === 'ordered' || o.status === 'claimed';
      }).length,
      lateIssues: U.sum(db.serials, function (s) {
        return s.issues.filter(function (i) { return i.status === 'late'; }).length;
      })
    };
  };

  /** Loans per weekday, derived from the transaction file. */
  Engine.circByDay = function (days) {
    days = days || 14;
    var today = U.today();
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = U.addDays(today, -i);
      var key = U.iso(d);
      out.push({
        date: key,
        label: U.fmtDateShort(d),
        issues: db.loans.filter(function (l) { return U.iso(new Date(l.out)) === key; }).length,
        returns: db.loans.filter(function (l) { return l.in && U.iso(new Date(l.in)) === key; }).length
      });
    }
    return out;
  };

  Engine.topTitles = function (n) {
    return db.bibs.map(function (b) {
      var items = Engine.itemsOf(b.id);
      return {
        bib: b,
        copies: items.length,
        circs: U.sum(items, function (i) { return i.circCount; }),
        holds: db.holds.filter(function (h) {
          return h.bibId === b.id && (h.status === 'waiting' || h.status === 'ready');
        }).length
      };
    }).sort(U.by('circs', 'desc')).slice(0, n || 8);
  };

  /** Never-circulated copies older than a year — the weeding list. */
  Engine.deadStock = function () {
    var today = U.today();
    return db.items.filter(function (i) {
      return i.circCount === 0 && i.status !== 'licensed' &&
             U.daysBetween(new Date(i.added), today) > 365;
    }).map(function (i) { return { item: i, bib: bib(i.bibId) }; });
  };

  Engine.branchStats = function () {
    return db.branches.map(function (br) {
      var items = db.items.filter(function (i) { return i.branch === br.code; });
      var open = Engine.openLoans().filter(function (l) {
        var it = item(l.barcode);
        return it && it.homeBranch === br.code;
      });
      return {
        branch: br,
        items: items.length,
        onLoan: open.length,
        available: items.filter(function (i) { return i.status === 'available'; }).length,
        patrons: db.patrons.filter(function (p) { return p.branch === br.code; }).length,
        holds: db.holds.filter(function (h) {
          return h.pickupBranch === br.code && (h.status === 'waiting' || h.status === 'ready');
        }).length
      };
    });
  };

  /* ============================================================
     search  (the same index the OPAC and the staff client use)
     ============================================================ */

  Engine.search = function (query, filters) {
    filters = filters || {};
    var results = db.bibs.map(function (b) {
      var items = Engine.itemsOf(b.id);
      return { bib: b, items: items, avail: Engine.availability(b.id) };
    });

    if (query) {
      var q = String(query).trim();
      var field = null;
      var m = /^(title|author|isbn|subject|callno|barcode):\s*(.+)$/i.exec(q);
      if (m) { field = m[1].toLowerCase(); q = m[2]; }
      results = results.filter(function (r) {
        var b = r.bib;
        if (field === 'title')   return U.matches(b.title, q);
        if (field === 'author')  return U.matches(b.author, q);
        if (field === 'isbn')    return String(b.isbn).indexOf(q.replace(/\D/g, '')) !== -1;
        if (field === 'subject') return U.matches(b.subjects.join(' '), q);
        if (field === 'callno')  return U.matches(b.dewey, q);
        if (field === 'barcode') return r.items.some(function (i) { return i.barcode === q.trim(); });
        return U.matches([b.title, b.author, b.isbn, b.publisher, b.dewey,
                          b.subjects.join(' '), b.summary].join(' '), q);
      });
    }

    if (filters.availableNow) {
      results = results.filter(function (r) { return r.avail.available > 0; });
    }
    if (filters.branch) {
      results = results.filter(function (r) {
        return r.items.some(function (i) { return i.branch === filters.branch; });
      });
    }
    if (filters.format) {
      results = results.filter(function (r) { return r.bib.format === filters.format; });
    }
    if (filters.collection) {
      results = results.filter(function (r) { return r.bib.collection === filters.collection; });
    }
    if (filters.subject) {
      results = results.filter(function (r) { return r.bib.subjects.indexOf(filters.subject) !== -1; });
    }
    if (filters.decade) {
      var dec = parseInt(filters.decade, 10);
      results = results.filter(function (r) { return Math.floor(r.bib.year / 10) * 10 === dec; });
    }

    var sort = filters.sort || 'relevance';
    if (sort === 'title')  results.sort(U.by(function (r) { return r.bib.title; }));
    if (sort === 'year')   results.sort(U.by(function (r) { return r.bib.year; }, 'desc'));
    if (sort === 'author') results.sort(U.by(function (r) { return r.bib.author; }));
    if (sort === 'popular')results.sort(U.by(function (r) {
      return U.sum(r.items, function (i) { return i.circCount; }); }, 'desc'));

    return results;
  };

  /** Facet counts for whatever the current result set is. */
  Engine.facets = function (results) {
    function tally(list, keyFn) {
      var out = {};
      list.forEach(function (r) {
        [].concat(keyFn(r)).forEach(function (k) {
          if (k === undefined || k === null || k === '') return;
          out[k] = (out[k] || 0) + 1;
        });
      });
      return Object.keys(out).map(function (k) { return { key: k, n: out[k] }; })
        .sort(U.by('n', 'desc'));
    }
    return {
      collection: tally(results, function (r) { return r.bib.collection; }),
      format:  tally(results, function (r) { return r.bib.format; }),
      subject: tally(results, function (r) { return r.bib.subjects; }).slice(0, 10),
      branch:  tally(results, function (r) {
        return r.items.map(function (i) { return i.branch; })
          .filter(function (v, i, a) { return a.indexOf(v) === i; }); }),
      decade:  tally(results, function (r) { return Math.floor(r.bib.year / 10) * 10; })
        .sort(U.by('key', 'desc')),
      lang:    tally(results, function (r) { return r.bib.lang; })
    };
  };

  /* ============================================================
     helpers
     ============================================================ */

  function fail(reason, msg, extra) {
    return Object.assign({ ok: false, reason: reason, msg: msg }, extra || {});
  }
  function PTYPE(code) {
    var t = db.patronTypes.find(function (x) { return x.code === code; });
    return t ? t.name : code;
  }
  function ITEMTYPE(code) {
    var t = db.itemTypes.find(function (x) { return x.code === code; });
    return t ? t.name : code;
  }
  Engine.patronTypeName = PTYPE;
  Engine.itemTypeName = ITEMTYPE;

  /** Recalculated derived values + a single "something changed" signal
      so every open panel can refresh itself at once. */
  Engine.recompute = function () {
    db.stats = Engine.stats();
    LS.bus.emit('db:change', db);
  };

  /* ============================================================
     opening state — a library that is already mid-day
     ============================================================ */

  function seedActivity() {
    var t = U.today();
    function grab(bibIdx, copyIdx) {
      var bibId = 'B' + String(bibIdx).padStart(4, '0');
      return Engine.itemsOf(bibId).filter(function (i) {
        return i.status === 'available';
      })[copyIdx || 0];
    }
    function makeLoan(bibIdx, copyIdx, patronIdx, outDaysAgo, dueInDays, renewals) {
      var it = grab(bibIdx, copyIdx);
      var p = db.patrons[patronIdx - 1];
      if (!it || !p) return null;
      var lo = {
        id: U.nextId('T'),
        barcode: it.barcode, bibId: it.bibId, patronId: p.id,
        out: U.addDays(t, -outDaysAgo).toISOString(),
        due: U.iso(U.addDays(t, dueInDays)),
        in: null, renewals: renewals || 0,
        maxRenewals: Engine.policyFor(p.type, it.type).renewals,
        branch: p.branch, channel: 'desk', override: false
      };
      db.loans.push(lo);
      it.status = 'out';
      it.circCount += 1;
      return lo;
    }
    function closedLoan(bibIdx, copyIdx, patronIdx, outDaysAgo, inDaysAgo) {
      var bibId = 'B' + String(bibIdx).padStart(4, '0');
      var it = Engine.itemsOf(bibId)[copyIdx || 0];
      var p = db.patrons[patronIdx - 1];
      if (!it || !p) return;
      db.loans.push({
        id: U.nextId('T'),
        barcode: it.barcode, bibId: it.bibId, patronId: p.id,
        out: U.addDays(t, -outDaysAgo).toISOString(),
        due: U.iso(U.addDays(t, -inDaysAgo - 1)),
        in: U.addDays(t, -inDaysAgo).toISOString(),
        renewals: 0, maxRenewals: 2, branch: p.branch, channel: 'desk'
      });
    }

    /** Same as makeLoan but pins the copy to a specific branch. */
    function makeLoanAt(bibIdx, branchCode, patronIdx, outDaysAgo, dueInDays) {
      var bibId = 'B' + String(bibIdx).padStart(4, '0');
      var it = Engine.itemsOf(bibId).find(function (i) {
        return i.status === 'available' && i.branch === branchCode;
      });
      var p = db.patrons[patronIdx - 1];
      if (!it || !p) return null;
      var lo = {
        id: U.nextId('T'),
        barcode: it.barcode, bibId: it.bibId, patronId: p.id,
        out: U.addDays(t, -outDaysAgo).toISOString(),
        due: U.iso(U.addDays(t, dueInDays)),
        in: null, renewals: 0,
        maxRenewals: Engine.policyFor(p.type, it.type).renewals,
        branch: branchCode, channel: 'desk', override: false
      };
      db.loans.push(lo);
      it.status = 'out';
      it.circCount += 1;
      return lo;
    }

    /* A deterministic three weeks of completed circulation. Without it the
       daily-issues chart and the hourly heat map have nothing to plot. */
    function backfillCirculation(days) {
      var s = 20260915;                      // fixed seed -> the demo is reproducible
      function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }
      for (var d = days; d >= 1; d--) {
        var date = U.addDays(t, -d);
        var dow = date.getDay();
        var base = dow === 0 ? 3 : dow === 6 ? 9 : 14;      // quiet Sundays, busy weekdays
        var count = base + Math.floor(rnd() * 8);
        for (var k = 0; k < count; k++) {
          var it = db.items[Math.floor(rnd() * db.items.length)];
          var p  = db.patrons[Math.floor(rnd() * db.patrons.length)];
          if (!it || !p || it.type === 'REF' || it.type === 'EBOOK') continue;
          if (it.circCount === 0) continue;      // leave the never-circulated slice alone
          var pol = Engine.policyFor(p.type, it.type);
          if (!pol.loanDays) continue;
          var outAt = new Date(date);
          outAt.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
          var loanLen = Math.min(pol.loanDays, 1 + Math.floor(rnd() * d));
          var backIn = new Date(U.addDays(date, loanLen));
          backIn.setHours(10 + Math.floor(rnd() * 9), Math.floor(rnd() * 60), 0, 0);
          if (backIn > LS.clock.now()) continue;             // still notionally out
          db.loans.push({
            id: U.nextId('T'),
            barcode: it.barcode, bibId: it.bibId, patronId: p.id,
            out: outAt.toISOString(),
            due: U.iso(U.addDays(date, pol.loanDays)),
            in: backIn.toISOString(),
            renewals: 0, maxRenewals: pol.renewals,
            branch: it.branch,
            channel: rnd() > 0.72 ? 'self-check' : 'desk'
          });
          it.circCount += 1;
        }
      }
    }

    /* open loans: a mix of comfortable, due-today and overdue */
    makeLoan(2,  0, 1,  12,  16);      // Sapiens -> Ananya (PG, 28d)
    makeLoan(7,  0, 1,  20,   8);      // Clean Code -> Ananya
    makeLoan(1,  0, 2,  11,   3);      // Design of Everyday Things -> Dev (UG)
    makeLoan(9,  0, 2,  18,  -4);      // Brief History of Time -> Dev, OVERDUE
    makeLoan(3,  0, 3,  30,  26);      // Intro to Algorithms -> Prof Syed (56d)
    makeLoan(15, 0, 3,  40,  16);      // Discovery of India -> Prof Syed
    makeLoan(17, 0, 4,   9,  47);      // Contract law -> Meera (faculty)
    makeLoan(11, 0, 5,  19,  -5, 2);   // Thinking Fast and Slow -> Rohit, OVERDUE, renewals used
    makeLoan(13, 0, 5,   2,  -1);      // Principles of Economics (RESERVE) -> Rohit, overdue 1d
    makeLoan(6,  0, 6,  10,  18);      // Midnight's Children -> Sara
    makeLoan(16, 0, 6,   4,  24);      // Norwegian Wood -> Sara
    makeLoan(18, 0, 7,  14,   7);      // Educated -> Kabir (child, 21d)
    makeLoan(20, 0, 8,   3,  11);      // Blade Runner DVD -> Tanvi (staff)
    makeLoan(4,  0, 9,  46, -18);      // Things Fall Apart -> Arjun, badly overdue + expired card
    makeLoan(12, 0, 11,  6,  22);      // God of Small Things -> Vikram
    makeLoan(8,  0, 12,  5,   9);      // The Namesake -> Leela
    makeLoan(21, 0, 12,  0,   0);      // Laptop -> Leela, due today

    /* loans held on copies that belong to the other branches, so branch
       statistics and the transit workflow are not Central-only */
    makeLoanAt(2,  'NORTH', 2,  7, 7);    // Sapiens (North copy) -> Dev
    makeLoanAt(12, 'NORTH', 7,  5, 16);   // God of Small Things -> Kabir
    makeLoanAt(18, 'NORTH', 9,  22, -8);  // Educated -> Arjun, overdue
    makeLoanAt(5,  'LAW',   11, 12, 16);  // Argumentative Indian -> Vikram
    makeLoanAt(15, 'LAW',   4,  20, 36);  // Discovery of India -> Meera

    /* a returned history so the reports and charts have depth */
    [[2,2,3,40,26],[5,1,4,60,44],[10,0,6,52,38],[14,0,1,33,20],
     [19,0,3,70,55],[11,1,2,29,15],[1,2,5,25,12],[9,1,7,48,30],
     [16,1,9,63,50],[6,1,10,21,9],[7,1,11,38,24],[18,1,8,17,5]]
      .forEach(function (a) { closedLoan(a[0], a[1], a[2], a[3], a[4]); });

    backfillCirculation(21);

    /* a hold queue with one copy already on the shelf */
    db.holds.push({
      id: U.nextId('H'), bibId: 'B0009', patronId: 'P0006',
      placed: U.addDays(t, -3).toISOString(), pickupBranch: 'MAIN',
      status: 'waiting', barcode: null, readyAt: null, expires: null, channel: 'opac'
    });
    db.holds.push({
      id: U.nextId('H'), bibId: 'B0009', patronId: 'P0012',
      placed: U.addDays(t, -1).toISOString(), pickupBranch: 'MAIN',
      status: 'waiting', barcode: null, readyAt: null, expires: null, channel: 'opac'
    });
    db.holds.push({
      id: U.nextId('H'), bibId: 'B0011', patronId: 'P0002',
      placed: U.addDays(t, -2).toISOString(), pickupBranch: 'NORTH',
      status: 'waiting', barcode: null, readyAt: null, expires: null, channel: 'opac'
    });
    db.holds.push({
      id: U.nextId('H'), bibId: 'B0004', patronId: 'P0001',
      placed: U.addDays(t, -5).toISOString(), pickupBranch: 'MAIN',
      status: 'waiting', barcode: null, readyAt: null, expires: null, channel: 'mobile'
    });

    /* one hold already trapped and waiting on the pickup shelf */
    var trapCopy = Engine.itemsOf('B0012').find(function (i) { return i.status === 'available'; });
    if (trapCopy) {
      trapCopy.status = 'hold-shelf';
      db.holds.push({
        id: U.nextId('H'), bibId: 'B0012', patronId: 'P0005',
        placed: U.addDays(t, -6).toISOString(), pickupBranch: 'MAIN',
        status: 'ready', barcode: trapCopy.barcode,
        readyAt: U.iso(U.addDays(t, -2)),
        expires: U.iso(U.addDays(t, 5)), channel: 'opac'
      });
    }

    /* one copy already rolling between branches */
    var transit = Engine.itemsOf('B0002').find(function (i) {
      return i.status === 'available' && i.branch === 'NORTH';
    });
    if (transit) { transit.status = 'in-transit'; transit.destination = 'MAIN'; }

    /* accrue the fines those overdue loans have already earned */
    Engine.openLoans().forEach(function (lo) {
      if (U.daysBetween(new Date(lo.due), t) > 0) accrueOverdue(lo, t);
    });

    /* a couple of charges of other kinds, plus history */
    Engine.addManualCharge('P0009', 'damage', 340,
      'Water damage — Things Fall Apart (repair charge)');
    Engine.addManualCharge('P0010', 'membership', 500,
      'Visitor membership fee 2026');
    var paid = db.fines[db.fines.length - 1];
    paid.status = 'paid'; paid.paidAmount = paid.amount;
    paid.paidOn = U.iso(U.addDays(t, -20)); paid.method = 'card';

    db.audit.length = 0;   // start the visible audit trail clean
    log('System', 'Session opened',
        'Demo dataset loaded — ' + db.bibs.length + ' titles, ' + db.items.length +
        ' copies, ' + db.patrons.length + ' members', 'info');
  }

  LS.Engine = Engine;
})(window);
