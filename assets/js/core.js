/* ============================================================
   core.js — namespace, small utilities, formatting, event bus
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS || (global.LS = {});

  /* ---------------- DOM ------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /** el('div.card#id', {attrs}, children|string) */
  function el(spec, attrs, children) {
    var m = /^([a-zA-Z0-9-]+)?((?:[.#][^.#]+)*)$/.exec(spec) || [];
    var node = document.createElement(m[1] || 'div');
    (m[2] || '').split(/(?=[.#])/).forEach(function (tok) {
      if (!tok) return;
      if (tok[0] === '.') node.classList.add(tok.slice(1));
      else node.id = tok.slice(1);
    });
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(node.style, v);
        } else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number'
          ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  /** Escape user-supplied text before it goes into an HTML string. */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- dates ---------------------------------- */
  var DAY = 86400000;

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function today() { return startOfDay(LS.clock ? LS.clock.now() : new Date()); }
  function addDays(d, n) { return new Date(startOfDay(d).getTime() + n * DAY); }
  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }
  function iso(d) {
    var x = startOfDay(d);
    return x.getFullYear() + '-' +
           String(x.getMonth() + 1).padStart(2, '0') + '-' +
           String(x.getDate()).padStart(2, '0');
  }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function fmtDate(d) {
    if (!d) return '—';
    var x = new Date(d);
    if (isNaN(x)) return '—';
    return x.getDate() + ' ' + MONTHS[x.getMonth()] + ' ' + x.getFullYear();
  }
  function fmtDateShort(d) {
    if (!d) return '—';
    var x = new Date(d);
    return x.getDate() + ' ' + MONTHS[x.getMonth()];
  }
  function fmtTime(d) {
    var x = new Date(d);
    var h = x.getHours(), m = String(x.getMinutes()).padStart(2, '0');
    var ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ap;
  }
  /** "in 5 days" / "3 days ago" / "today" */
  function relDays(d, from) {
    var n = daysBetween(from || today(), d);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
  }

  /* ---------------- numbers & money ------------------------ */
  function money(n) {
    var v = Math.abs(Number(n) || 0);
    return (n < 0 ? '-' : '') + '₹' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function money0(n) {
    var v = Math.round(Number(n) || 0);
    return '₹' + v.toLocaleString('en-IN');
  }
  function num(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  /* ---------------- misc ----------------------------------- */
  var seq = {};
  function nextId(prefix) {
    seq[prefix] = (seq[prefix] || 0) + 1;
    return prefix + '-' + String(seq[prefix]).padStart(4, '0');
  }
  function primeId(prefix, n) {
    seq[prefix] = Math.max(seq[prefix] || 0, n);
  }
  function uid() {
    return 'x' + Math.random().toString(36).slice(2, 9);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function by(key, dir) {
    dir = dir === 'desc' ? -1 : 1;
    return function (a, b) {
      var x = typeof key === 'function' ? key(a) : a[key];
      var y = typeof key === 'function' ? key(b) : b[key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * dir;
    };
  }
  function groupBy(arr, keyFn) {
    return arr.reduce(function (acc, item) {
      var k = keyFn(item);
      (acc[k] = acc[k] || []).push(item);
      return acc;
    }, {});
  }
  function sum(arr, fn) {
    return arr.reduce(function (t, x) { return t + (fn ? fn(x) : x); }, 0);
  }
  function titleCase(s) {
    return String(s).toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function initials(name) {
    return String(name).split(/\s+/).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 220);
    };
  }
  /** Loose search: every query token must appear somewhere in the haystack. */
  function matches(haystack, query) {
    if (!query) return true;
    var h = String(haystack).toLowerCase();
    return String(query).toLowerCase().split(/\s+/).filter(Boolean)
      .every(function (t) { return h.indexOf(t) !== -1; });
  }

  /* ---------------- event bus ------------------------------ */
  function Bus() { this._h = {}; }
  Bus.prototype.on = function (evt, fn) {
    (this._h[evt] = this._h[evt] || []).push(fn);
    var self = this;
    return function () { self.off(evt, fn); };
  };
  Bus.prototype.off = function (evt, fn) {
    if (!this._h[evt]) return;
    this._h[evt] = this._h[evt].filter(function (f) { return f !== fn; });
  };
  Bus.prototype.emit = function (evt, payload) {
    (this._h[evt] || []).slice().forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error('[bus:' + evt + ']', e); }
    });
    (this._h['*'] || []).slice().forEach(function (fn) {
      try { fn(evt, payload); } catch (e) { console.error('[bus:*]', e); }
    });
  };

  /* ---------------- demo clock ----------------------------- */
  /* The demo can jump forward in time so overdue fines, hold
     expiries and notice jobs are observable in a 2-minute demo. */
  LS.clock = {
    offsetDays: 0,
    now: function () {
      return new Date(Date.now() + this.offsetDays * DAY);
    },
    advance: function (days) { this.offsetDays += days; },
    reset: function () { this.offsetDays = 0; }
  };

  LS.util = {
    $: $, $$: $$, el: el, esc: esc,
    DAY: DAY,
    startOfDay: startOfDay, today: today, addDays: addDays,
    daysBetween: daysBetween, iso: iso,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtTime: fmtTime, relDays: relDays,
    money: money, money0: money0, num: num, pct: pct,
    nextId: nextId, primeId: primeId, uid: uid, clone: clone,
    by: by, groupBy: groupBy, sum: sum,
    titleCase: titleCase, initials: initials,
    debounce: debounce, matches: matches
  };
  LS.Bus = Bus;
  LS.bus = new Bus();
})(window);
