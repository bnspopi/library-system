/* ============================================================
   hotspots.js — what you can click inside the footage.

   Every clip is scrubbed by the scroll bar and wrapped around the
   room; nothing in it plays on its own. But the things in it are
   things: the book on the table, the whale, the man, the door. Each
   one is a hotspot here, as a rectangle of the frame (fractions of
   the cropped clip, x/y from the top left) with what happens when
   it is clicked:

     turn      turn the page: scroll on to the next beat of the hall
     reserve   open the record of the title it belongs to
     look      the camera pushes in on it
     book      take down the first book floating in the hall
     hall      walk to another hall
     take      (the orrery backdrop) take the great book down

   A hotspot can be limited to a stretch of the clip with t: [from,
   to] in seconds; the rest are live for the whole clip.

   LS.Hotspots.of(slug)                      -> [hotspot]
   LS.Hotspots.resolveBib(match, colKey)     -> bib
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var E = LS.Engine;

  function H(x, y, w, h, label, action, t) {
    var o = { x: x, y: y, w: w, h: h, label: label, action: action };
    if (t) o.t = t;
    return o;
  }
  var TURN = { type: 'turn' }, LOOK = { type: 'look' }, BOOK = { type: 'book' };
  function RES(match) { return { type: 'reserve', match: match }; }

  var SPOTS = {
    /* the arrival */
    'arrive-street':   [H(.40, .18, .18, .70, 'The man', TURN)],
    'arrive-stairs':   [H(.34, .04, .32, .40, 'The doors', TURN), H(.05, .40, .20, .40, 'The lions', LOOK)],
    'arrive-doors':    [H(.30, .06, .40, .80, 'The doors', TURN)],
    'man-corridor':    [H(.38, .12, .22, .80, 'Keep walking', TURN)],
    'man-corridor-b':  [H(.38, .12, .22, .80, 'The last door', TURN)],
    'man-turns':       [H(.38, .08, .24, .86, 'Into the reception', TURN)],
    'arrive-lamps':    [H(.36, .02, .28, .50, 'The door', TURN), H(.62, .40, .18, .30, 'The lamps', LOOK)],
    'arrive-hall':     [H(.30, .06, .40, .80, 'The doors', TURN)],

    /* the children's wing */
    'kids-nursery':          [H(.04, .30, .30, .50, 'The picture books', BOOK), H(.55, .10, .40, .40, 'The nursery shelves', LOOK)],
    'childrens-gold-path':   [H(.40, .28, .24, .50, 'The book on the path', TURN), H(.05, .30, .25, .50, 'The shelves', BOOK)],
    'kids-gold-accelerate':  [H(.38, .18, .26, .46, 'The pedestal', TURN), H(.66, .12, .30, .40, 'The orbit', LOOK)],
    'childrens-approach':    [H(.36, .22, .28, .50, 'The book that opens it', TURN)],
    'subjects-emerge':       [H(.28, .10, .44, .48, 'The whale', RES('Whale')), H(.30, .55, .40, .40, 'The picture book', TURN)],
    'man-floating-books':    [H(.06, .30, .26, .46, 'The fox', RES('Fox')), H(.36, .28, .28, .48, 'The whale', RES('Whale')), H(.66, .30, .28, .46, 'The robot', RES('Robot'))],
    'man-whale-a':           [H(.20, .16, .55, .40, 'The whale', RES('Whale')), H(.10, .55, .22, .40, 'The reader', TURN)],
    'man-whale-b':           [H(.10, .28, .70, .46, 'The whale', RES('Whale')), H(.42, .18, .16, .40, 'The rider', TURN)],

    /* the adult hall */
    'adult-quiet-stacks':    [H(.04, .20, .40, .60, 'The stacks', BOOK), H(.60, .30, .30, .40, 'The green lamps', LOOK)],
    'novels-camera-pass':    [H(.34, .20, .32, .60, 'The one out of line', BOOK)],
    'man-rotating-novels':   [H(.20, .40, .60, .40, 'The novels', BOOK), H(.62, .10, .22, .60, 'The reader', TURN)],
    'man-table-spines':      [H(.06, .34, .80, .50, 'The spines', BOOK), H(.86, .28, .12, .40, 'The reader', TURN)],
    'novel-riffle':          [H(.30, .30, .44, .50, 'Turn the page', TURN)],
    'books-reveal-objects':  [H(.30, .12, .40, .40, 'What came out of it', LOOK), H(.28, .52, .44, .42, 'The book', TURN)],

    /* voyages */
    'voyages-whale':         [H(.18, .08, .56, .50, 'The whale', RES('Whale')), H(.40, .60, .24, .34, 'The hall', TURN)],
    'expedition-canal':      [H(.30, .30, .40, .50, 'The map on the table', TURN), H(.05, .40, .22, .40, 'The boats', LOOK)],
    'popup-expedition':      [H(.34, .10, .32, .40, 'The mountain', LOOK), H(.28, .55, .44, .40, 'The atlas', TURN)],
    'book-miniature':        [H(.30, .30, .40, .50, 'The compass rose', TURN), H(.60, .10, .30, .40, 'The bridge', LOOK)],
    'kids-objects-emerge':   [H(.36, .05, .30, .40, 'The whale', RES('Whale')), H(.08, .45, .26, .40, 'The paper boats', LOOK), H(.62, .45, .30, .40, 'The puppet', RES('Pinocchio'))],

    /* science */
    'science-flythrough':    [H(.30, .20, .40, .40, 'The orrery', LOOK), H(.30, .62, .40, .34, 'The book', TURN)],
    'heart-model':           [H(.30, .06, .40, .56, 'The heart', RES('Anatomy')), H(.30, .64, .40, .34, 'The book', TURN)],
    'diagrams-lift':         [H(.26, .06, .48, .50, 'The diagrams', LOOK), H(.30, .60, .40, .36, 'The book', TURN)],
    'asteroid-ring':         [H(.30, .06, .40, .56, 'The stone in the ring', LOOK), H(.42, .60, .16, .38, 'The visitor', TURN)],
    'atom-book':             [H(.10, .04, .30, .46, 'The atom', RES('Physics')), H(.44, .02, .30, .46, 'The helix', RES('Origin')), H(.10, .52, .60, .44, 'The book', TURN)],

    /* technology */
    'tech-book-orbit':       [H(.28, .16, .44, .60, 'The screen that is a book', TURN)],
    'tech-atlas-city':       [H(.26, .06, .48, .50, 'The city', LOOK), H(.26, .58, .48, .38, 'The atlas', TURN)],
    'tech-pages-fan':        [H(.26, .06, .48, .50, 'The mechanism', LOOK), H(.26, .58, .48, .38, 'The book', TURN)],
    'city-book':             [H(.28, .10, .44, .40, 'The city in the pages', LOOK), H(.62, .04, .30, .34, 'The satellite', LOOK), H(.20, .52, .60, .44, 'The book', TURN)],
    'mechanism-book':        [H(.36, .06, .34, .50, 'The mechanism', LOOK), H(.20, .56, .60, .40, 'The book', TURN)],

    /* history */
    'atlas-dolly':           [H(.06, .30, .88, .50, 'The lecterns', BOOK), H(.34, .12, .32, .40, 'The manuscript', TURN)],
    'reading-room-man':      [H(.40, .16, .22, .60, 'The reader', TURN), H(.04, .50, .90, .40, 'The table', BOOK)],
    'reading-room-dusk':     [H(.70, .34, .20, .30, 'The lamp', LOOK), H(.04, .50, .60, .40, 'The long table', BOOK), H(.40, .20, .20, .30, 'The window', TURN)],

    /* ancient */
    'gold-path-atlas':       [H(.26, .20, .48, .60, 'The atlas', TURN)],
    'stone-city':            [H(.26, .10, .48, .46, 'The walled town', LOOK), H(.26, .58, .48, .38, 'The atlas', TURN)],
    'scroll-coastline':      [H(.20, .20, .60, .56, 'The scroll', TURN)],
    'stone-passage':         [H(.30, .06, .34, .70, 'The passage', TURN), H(.62, .30, .18, .26, 'The lantern', LOOK)],

    /* civilization */
    'living-stacks-orbit':   [H(.34, .14, .32, .60, 'The great book', TURN), H(.04, .10, .26, .50, 'The orbit', LOOK)],
    'living-stacks-monolith':[H(.30, .06, .40, .80, 'One volume, every world', TURN)],
    'book-opens-pages':      [H(.24, .04, .52, .46, 'The letters', LOOK), H(.24, .54, .52, .42, 'The book', TURN)],
    'great-hall-orbit':      [H(.36, .40, .28, .40, 'The blue book', TURN), H(.04, .06, .30, .50, 'The orbit', LOOK), H(.66, .10, .30, .50, 'The orbit', LOOK)],

    /* mythology */
    'books-dais':            [H(.06, .12, .22, .60, 'The statue', LOOK), H(.72, .12, .22, .60, 'The statue', LOOK), H(.32, .40, .36, .50, 'The books on the dais', TURN)],
    'figures-rise':          [H(.30, .02, .40, .50, 'The sun', LOOK), H(.30, .54, .40, .42, 'The blue book', TURN)],
    'pages-diorama':         [H(.28, .02, .44, .52, 'The tree in the book', LOOK), H(.28, .56, .44, .40, 'The book', TURN)],
    'tree-book':             [H(.10, .04, .40, .60, 'The tree', LOOK), H(.52, .10, .22, .30, 'The lanterns', LOOK), H(.14, .60, .56, .36, 'The book', TURN)],

    /* the closed wing */
    'aisle-push':            [H(.34, .10, .32, .80, 'The aisle', TURN)],
    'arrive-fog':            [H(.30, .20, .40, .56, 'The lectern', TURN)],
    'book-cold-fog':         [H(.24, .20, .52, .60, 'The chained book', RES('Dracula'))],
    'ashes-book':            [H(.20, .20, .60, .70, 'The Ashes: turn the page', TURN)],
    'chained-book-candle':   [H(.06, .26, .56, .60, 'The chained book', RES('Frankenstein')), H(.68, .16, .22, .50, 'The candle', LOOK)],
    'aisle-dust':            [H(.36, .16, .28, .78, 'Deeper in', TURN)],

    /* the great book, and the orrery's backdrop */
    'giant-book':            [H(.20, .16, .60, .70, 'Turn the page', TURN)],
    'orbit-books':           [H(.34, .14, .32, .60, 'The great book', { type: 'take', key: 'aurelia' })]
  };

  function of(slug) { return SPOTS[slug] || [H(.28, .18, .44, .64, 'Turn the page', TURN)]; }

  /** the title a hotspot belongs to: a keyword against the hall's shelf, then
      the whole catalogue, then the first title in the hall */
  function resolveBib(match, colKey) {
    var bibs = E.db().bibs;
    var inHall = colKey ? bibs.filter(function (b) { return b.collection === colKey; }) : bibs;
    var hit = null;
    if (match) {
      var m = match.toLowerCase();
      var test = function (b) {
        return (b.title + ' ' + b.author + ' ' + (b.subjects || []).join(' ') + ' ' + (b.summary || '')).toLowerCase().indexOf(m) > -1;
      };
      hit = inHall.filter(test)[0] || bibs.filter(test)[0] || null;
    }
    return hit || inHall[0] || bibs[0];
  }

  LS.Hotspots = { of: of, resolveBib: resolveBib, SPOTS: SPOTS };
})(window);
