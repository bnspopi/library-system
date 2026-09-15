/* ============================================================
   ui.js — the shared component kit for the staff client and OPAC.
   Toasts, modals, drawers, tabs, chips, charts, receipts.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util;
  var el = U.el, esc = U.esc;
  var UI = {};

  /* ============================================================
     toasts
     ============================================================ */

  function toastHost() {
    var host = document.getElementById('toast-host');
    if (!host) {
      host = el('div#toast-host.toast-host', { 'aria-live': 'polite' });
      document.body.appendChild(host);
    }
    return host;
  }

  var TONE_ICON = { ok: '✓', warn: '!', danger: '✕', info: 'i', gold: '◆' };

  UI.toast = function (opts) {
    if (typeof opts === 'string') opts = { title: opts };
    var tone = opts.tone || 'ok';
    var node = el('div.toast.toast-' + tone, { role: 'status' }, [
      el('div.toast-mark', { text: opts.icon || TONE_ICON[tone] || '·' }),
      el('div.toast-text', {}, [
        el('div.toast-title', { text: opts.title || '' }),
        opts.detail ? el('div.toast-detail', { text: opts.detail }) : null
      ]),
      el('button.toast-x', {
        'aria-label': 'Dismiss', text: '×',
        onclick: function () { dismiss(); }
      })
    ]);
    if (opts.actions && opts.actions.length) {
      var bar = el('div.toast-actions');
      opts.actions.forEach(function (a) {
        bar.appendChild(el('button.btn.btn-sm', {
          onclick: function () { dismiss(); a.run && a.run(); }
        }, a.label));
      });
      node.querySelector('.toast-text').appendChild(bar);
    }
    toastHost().appendChild(node);

    var timer = setTimeout(dismiss, opts.sticky ? 14000 : (opts.duration || 5200));
    function dismiss() {
      clearTimeout(timer);
      if (!node.parentNode) return;
      node.classList.add('is-leaving');
      setTimeout(function () { node.remove(); }, 320);
    }
    node.addEventListener('pointerenter', function () { clearTimeout(timer); });
    node.addEventListener('pointerleave', function () {
      timer = setTimeout(dismiss, 2600);
    });
    return dismiss;
  };

  /** Turn an engine result straight into the right toast. */
  UI.result = function (res, okTone) {
    if (!res) return;
    if (res.ok) {
      UI.toast({ title: res.msg, detail: res.detail, tone: okTone || 'ok' });
    } else {
      UI.toast({ title: res.msg, detail: res.reason ? 'Rule: ' + res.reason : '',
                 tone: res.overridable ? 'warn' : 'danger' });
    }
    return res;
  };

  /* ============================================================
     modal
     ============================================================ */

  var openModals = [];

  UI.modal = function (opts) {
    var scrim = el('div.scrim', { onclick: function (e) {
      if (e.target === scrim && opts.dismissable !== false) close();
    } });
    var box = el('div.modal' + (opts.size ? '.modal-' + opts.size : ''), {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog'
    });

    if (opts.title) {
      box.appendChild(el('div.modal-head', {}, [
        el('div', {}, [
          opts.eyebrow ? el('div.eyebrow.no-rule', { text: opts.eyebrow }) : null,
          el('h3.modal-title', { text: opts.title })
        ]),
        opts.dismissable === false ? null :
          el('button.icon-btn', { 'aria-label': 'Close', text: '×', onclick: close })
      ]));
    }

    var body = el('div.modal-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    if (opts.actions && opts.actions.length) {
      var foot = el('div.modal-foot');
      opts.actions.forEach(function (a) {
        foot.appendChild(el('button.btn' + (a.primary ? '.btn-primary' : '') +
          (a.danger ? '.btn-danger' : '') + (a.ghost ? '.btn-ghost' : ''), {
          onclick: function () {
            var keep = a.run ? a.run(body, close) : false;
            if (!keep && a.keepOpen !== true) close();
          }
        }, a.label));
      });
      box.appendChild(foot);
    }

    scrim.appendChild(box);
    document.body.appendChild(scrim);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { scrim.classList.add('is-open'); });

    var firstInput = box.querySelector('input, select, textarea, button.btn-primary');
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 120);

    function onKey(e) {
      if (e.key === 'Escape' && opts.dismissable !== false) close();
    }
    document.addEventListener('keydown', onKey);
    openModals.push(close);

    function close() {
      document.removeEventListener('keydown', onKey);
      scrim.classList.remove('is-open');
      openModals = openModals.filter(function (f) { return f !== close; });
      if (!openModals.length) document.body.classList.remove('modal-open');
      setTimeout(function () { scrim.remove(); }, 280);
      if (opts.onClose) opts.onClose();
    }
    return { close: close, body: body, box: box };
  };

  UI.confirm = function (opts) {
    return new Promise(function (resolve) {
      UI.modal({
        title: opts.title || 'Are you sure?',
        eyebrow: opts.eyebrow,
        size: 'sm',
        body: el('p.muted', { text: opts.message || '' }),
        actions: [
          { label: opts.cancelLabel || 'Cancel', ghost: true, run: function () { resolve(false); } },
          { label: opts.confirmLabel || 'Confirm', primary: !opts.danger,
            danger: opts.danger, run: function () { resolve(true); } }
        ],
        onClose: function () { resolve(false); }
      });
    });
  };

  /** A small form in a modal. fields: [{name,label,type,value,options,required,hint,span}] */
  UI.form = function (opts) {
    return new Promise(function (resolve) {
      var grid = el('div.form-grid');
      (opts.fields || []).forEach(function (f) {
        var id = 'f-' + U.uid();
        var control;
        if (f.type === 'select') {
          control = el('select.select', { id: id, name: f.name });
          (f.options || []).forEach(function (o) {
            var val = typeof o === 'string' ? o : o.value;
            var lab = typeof o === 'string' ? o : o.label;
            control.appendChild(el('option', { value: val,
              selected: String(f.value) === String(val) }, lab));
          });
        } else if (f.type === 'textarea') {
          control = el('textarea.textarea', { id: id, name: f.name,
            placeholder: f.placeholder || '' }, f.value || '');
        } else if (f.type === 'checkbox') {
          control = el('label.check', {}, [
            el('input', { type: 'checkbox', id: id, name: f.name, checked: !!f.value }),
            el('span', { text: f.label })
          ]);
        } else {
          control = el('input.input', { id: id, name: f.name, type: f.type || 'text',
            value: f.value === undefined ? '' : f.value,
            placeholder: f.placeholder || '', required: f.required });
        }
        var wrap = el('div.field' + (f.span ? '.span-' + f.span : ''), {}, [
          f.type === 'checkbox' ? null : el('span.label', { text: f.label }),
          control,
          f.hint ? el('div.tiny.faint', { style: { marginTop: '5px' }, text: f.hint }) : null
        ]);
        grid.appendChild(wrap);
      });

      var body = el('div.stack', { style: { '--gap': '16px' } }, [
        opts.intro ? el('p.small.muted', { text: opts.intro }) : null,
        grid
      ]);

      UI.modal({
        title: opts.title, eyebrow: opts.eyebrow, size: opts.size || 'md', body: body,
        actions: [
          { label: 'Cancel', ghost: true, run: function () { resolve(null); } },
          { label: opts.submitLabel || 'Save', primary: true, run: function (b) {
              var data = {};
              U.$$('input, select, textarea', b).forEach(function (i) {
                if (!i.name) return;
                data[i.name] = i.type === 'checkbox' ? i.checked : i.value;
              });
              resolve(data);
            } }
        ],
        onClose: function () { resolve(null); }
      });
    });
  };

  /* ============================================================
     drawer — the record detail panel
     ============================================================ */

  var currentDrawer = null;

  UI.drawer = function (opts) {
    if (currentDrawer) currentDrawer.close(true);
    var scrim = el('div.drawer-scrim', { onclick: function (e) {
      if (e.target === scrim) close();
    } });
    var panel = el('aside.drawer', { role: 'dialog', 'aria-label': opts.title || 'Details' });

    panel.appendChild(el('div.drawer-head', {}, [
      el('div.grow', {}, [
        opts.eyebrow ? el('div.eyebrow.no-rule', { text: opts.eyebrow }) : null,
        el('h3.h3', { text: opts.title || '' }),
        opts.subtitle ? el('div.small.muted', { style: { marginTop: '4px' },
          text: opts.subtitle }) : null
      ]),
      el('button.icon-btn', { 'aria-label': 'Close', text: '×', onclick: close })
    ]));

    var body = el('div.drawer-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    panel.appendChild(body);

    if (opts.actions && opts.actions.length) {
      var foot = el('div.drawer-foot');
      opts.actions.forEach(function (a) {
        if (!a) return;
        foot.appendChild(el('button.btn.btn-sm' + (a.primary ? '.btn-primary' : '') +
          (a.danger ? '.btn-danger' : ''), {
          onclick: function () { a.run && a.run(close); if (a.closeAfter !== false && !a.keepOpen) close(); }
        }, a.label));
      });
      panel.appendChild(foot);
    }

    scrim.appendChild(panel);
    document.body.appendChild(scrim);
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { scrim.classList.add('is-open'); });
    if (global.Motion) Motion.enter(body, '[data-enter]', 40);

    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    function close(immediate) {
      document.removeEventListener('keydown', onKey);
      scrim.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      currentDrawer = null;
      if (immediate) scrim.remove();
      else setTimeout(function () { scrim.remove(); }, 320);
    }
    currentDrawer = { close: close, body: body };
    return currentDrawer;
  };

  /* ============================================================
     tabs — pill row with a sliding indicator
     ============================================================ */

  UI.tabs = function (opts) {
    var wrap = el('div.tabs' + (opts.compact ? '.tabs-compact' : ''), { role: 'tablist' });
    var ink = el('span.tabs-ink');
    wrap.appendChild(ink);
    var buttons = [];

    (opts.items || []).forEach(function (t, i) {
      var b = el('button.tab', {
        role: 'tab', 'data-key': t.key,
        onclick: function () { select(i, true); }
      }, [
        t.icon ? el('span.tab-ic', { text: t.icon }) : null,
        el('span', { text: t.label }),
        (t.badge !== undefined && t.badge !== null && t.badge !== 0)
          ? el('span.tab-badge', { text: String(t.badge) }) : null
      ]);
      buttons.push(b);
      wrap.appendChild(b);
    });

    function moveInk(i) {
      var b = buttons[i];
      if (!b) return;
      ink.style.width = b.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    }
    function select(i, fire) {
      buttons.forEach(function (b, j) {
        b.classList.toggle('is-active', j === i);
        b.setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      moveInk(i);
      if (fire && opts.onChange) opts.onChange(opts.items[i].key, i);
    }

    var startIndex = Math.max(0, (opts.items || []).findIndex(function (t) {
      return t.key === opts.active;
    }));
    requestAnimationFrame(function () { select(startIndex, false); });
    global.addEventListener('resize', U.debounce(function () {
      var idx = buttons.findIndex(function (b) { return b.classList.contains('is-active'); });
      moveInk(idx < 0 ? 0 : idx);
    }, 150));

    wrap.select = select;
    return wrap;
  };

  /* ============================================================
     record chips
     ============================================================ */

  var STATUS_META = {
    'available':  { label: 'Available',     tone: 'ok' },
    'out':        { label: 'On loan',       tone: 'info' },
    'hold-shelf': { label: 'On hold shelf', tone: 'gold' },
    'in-transit': { label: 'In transit',    tone: 'info' },
    'in-process': { label: 'In process',    tone: 'warn' },
    'reference':  { label: 'Reference only',tone: 'warn' },
    'licensed':   { label: 'Licensed',      tone: 'gold' },
    'lost':       { label: 'Lost',          tone: 'danger' },
    'damaged':    { label: 'Damaged',       tone: 'danger' },
    'withdrawn':  { label: 'Withdrawn',     tone: 'danger' }
  };
  UI.statusMeta = function (s) {
    return STATUS_META[s] || { label: U.titleCase(String(s).replace(/-/g, ' ')), tone: '' };
  };
  UI.statusChip = function (status) {
    var m = UI.statusMeta(status);
    return el('span.chip' + (m.tone ? '.chip-' + m.tone : ''), {}, [
      el('span.dot'), el('span', { text: m.label })
    ]);
  };

  /** Due-date chip that colours itself by how close the date is. */
  UI.dueChip = function (due) {
    var n = U.daysBetween(U.today(), new Date(due));
    var tone = n < 0 ? 'danger' : n === 0 ? 'warn' : n <= 2 ? 'warn' : '';
    var label = n < 0 ? Math.abs(n) + 'd overdue'
              : n === 0 ? 'Due today'
              : 'Due ' + U.fmtDateShort(due);
    return el('span.chip' + (tone ? '.chip-' + tone : ''), {}, [
      n < 0 ? el('span.dot.dot-pulse') : null, el('span', { text: label })
    ]);
  };

  UI.avatar = function (name, size) {
    return el('span.avatar' + (size ? '.avatar-' + size : ''), {
      'data-initials': U.initials(name || '?')
    }, U.initials(name || '?'));
  };

  /* ============================================================
     mini charts (inline SVG, animate on insert)
     ============================================================ */

  UI.barChart = function (data, opts) {
    opts = opts || {};
    var h = opts.height || 120;
    var max = Math.max.apply(null, data.map(function (d) {
      return Math.max(d.value || 0, d.value2 || 0);
    }).concat([1]));
    var wrap = el('div.bars', { style: { height: h + 'px' } });
    data.forEach(function (d, i) {
      var col = el('div.bar-col', { title: d.label + ': ' + d.value +
        (d.value2 !== undefined ? ' / ' + d.value2 : '') });
      var stack = el('div.bar-stack');
      var b1 = el('span.bar.bar-a', {
        style: { height: ((d.value / max) * 100) + '%', animationDelay: (i * 34) + 'ms' }
      });
      stack.appendChild(b1);
      if (d.value2 !== undefined) {
        stack.appendChild(el('span.bar.bar-b', {
          style: { height: ((d.value2 / max) * 100) + '%', animationDelay: (i * 34 + 60) + 'ms' }
        }));
      }
      col.appendChild(stack);
      if (opts.labels !== false) col.appendChild(el('span.bar-label', { text: d.label }));
      wrap.appendChild(col);
    });
    return wrap;
  };

  UI.sparkline = function (values, opts) {
    opts = opts || {};
    var w = opts.width || 160, h = opts.height || 38;
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values.concat([0]));
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      return [(i / Math.max(values.length - 1, 1)) * w,
              h - ((v - min) / span) * (h - 4) - 2];
    });
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    var area = d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z';
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'spark');
    svg.setAttribute('preserveAspectRatio', 'none');
    var fill = document.createElementNS(ns, 'path');
    fill.setAttribute('d', area);
    fill.setAttribute('class', 'spark-fill');
    var line = document.createElementNS(ns, 'path');
    line.setAttribute('d', d);
    line.setAttribute('class', 'spark-line');
    line.setAttribute('data-draw', '');
    line.setAttribute('data-draw-dur', '1200');
    svg.appendChild(fill);
    svg.appendChild(line);
    return svg;
  };

  UI.ring = function (pct, opts) {
    opts = opts || {};
    var size = opts.size || 78, sw = opts.stroke || 6;
    var r = (size - sw) / 2, c = 2 * Math.PI * r;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('class', 'ring');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    ['ring-track', 'ring-bar'].forEach(function (cls) {
      var ci = document.createElementNS(ns, 'circle');
      ci.setAttribute('cx', size / 2); ci.setAttribute('cy', size / 2);
      ci.setAttribute('r', r); ci.setAttribute('class', cls);
      ci.setAttribute('stroke-width', sw);
      if (cls === 'ring-bar') {
        ci.setAttribute('stroke-dasharray', c);
        ci.setAttribute('stroke-dashoffset', c);
        ci.setAttribute('transform', 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')');
        requestAnimationFrame(function () {
          ci.style.transition = 'stroke-dashoffset 1200ms cubic-bezier(.16,1,.3,1)';
          ci.setAttribute('stroke-dashoffset', c * (1 - Math.min(pct, 100) / 100));
        });
      }
      svg.appendChild(ci);
    });
    return el('div.ring-wrap', { style: { width: size + 'px', height: size + 'px' } }, [
      svg,
      el('span.ring-label', {}, [
        el('b', { 'data-count': Math.round(pct), 'data-suffix': '%' }, '0%'),
        opts.caption ? el('i', { text: opts.caption }) : null
      ])
    ]);
  };

  /** Horizontal meter — used for fund balances and collection splits. */
  UI.meter = function (segments, opts) {
    opts = opts || {};
    var total = opts.total || U.sum(segments, function (s) { return s.value; }) || 1;
    var bar = el('div.meter');
    segments.forEach(function (s, i) {
      bar.appendChild(el('span.meter-seg', {
        title: s.label + ': ' + (s.display || s.value),
        style: { width: ((s.value / total) * 100) + '%',
                 background: s.colour, animationDelay: (i * 90) + 'ms' }
      }));
    });
    return bar;
  };

  /* ============================================================
     misc
     ============================================================ */

  UI.stat = function (opts) {
    return el('div.stat' + (opts.tone ? '.stat-' + opts.tone : ''), {
      'data-enter': '', tabindex: opts.onclick ? '0' : null,
      onclick: opts.onclick, 'data-ripple': opts.onclick ? '' : null
    }, [
      el('div.stat-top', {}, [
        el('span.stat-label', { text: opts.label }),
        opts.hint ? el('span.stat-hint', { title: opts.hint, text: '?' }) : null
      ]),
      el('div.stat-value', {}, [
        el('b', {
          'data-count': opts.count !== undefined ? opts.count : null,
          'data-prefix': opts.prefix || null,
          'data-suffix': opts.suffix || null,
          'data-decimals': opts.decimals || null
        }, opts.count !== undefined ? '0' : (opts.value || '—'))
      ]),
      opts.foot ? el('div.stat-foot', { text: opts.foot }) : null,
      opts.spark ? el('div.stat-spark', {}, UI.sparkline(opts.spark)) : null
    ]);
  };

  UI.empty = function (text, icon) {
    return el('div.empty', {}, [
      el('span.ic', { text: icon || '◎' }),
      el('span', { text: text })
    ]);
  };

  UI.kv = function (pairs) {
    var list = el('dl.kv');
    pairs.forEach(function (p) {
      if (!p || p[1] === undefined || p[1] === null || p[1] === '') return;
      list.appendChild(el('dt', { text: p[0] }));
      var dd = el('dd');
      if (typeof p[1] === 'string' || typeof p[1] === 'number') dd.textContent = p[1];
      else dd.appendChild(p[1]);
      list.appendChild(dd);
    });
    return list;
  };

  /** Printable-looking desk receipt, used after checkout. */
  UI.receipt = function (lines, opts) {
    opts = opts || {};
    return el('div.receipt', {}, [
      el('div.receipt-head', {}, [
        el('b', { text: opts.title || 'Aurelia Library' }),
        el('span', { text: opts.sub || U.fmtDate(LS.clock.now()) + ' · ' + U.fmtTime(LS.clock.now()) })
      ]),
      el('div.receipt-perf'),
      el('ul.receipt-lines', {}, lines.map(function (l) {
        return el('li', {}, [
          el('span', { text: l[0] }),
          el('b', { text: l[1] })
        ]);
      })),
      el('div.receipt-perf'),
      el('div.receipt-foot', { text: opts.foot || 'Thank you — renew online at any time.' })
    ]);
  };

  /** Loading shimmer used while a "slow" operation is faked. */
  UI.skeleton = function (rows) {
    var w = el('div.skeleton');
    for (var i = 0; i < (rows || 3); i++) {
      w.appendChild(el('span', { style: { width: (55 + ((i * 37) % 40)) + '%' } }));
    }
    return w;
  };

  /** Run fn after a short "processing" beat so the UI feels like a real desk. */
  UI.busy = function (node, fn, ms) {
    if (!node) return fn();
    node.classList.add('is-busy');
    setTimeout(function () {
      node.classList.remove('is-busy');
      fn();
    }, Motion && Motion.reduced ? 0 : (ms || 420));
  };

  UI.copy = function (text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        UI.toast({ title: 'Copied', detail: text, tone: 'info', duration: 2000 });
      });
    }
  };

  LS.UI = UI;
})(window);
