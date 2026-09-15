/* ============================================================
   data.js — the seed database for the demo.
   Everything downstream (circulation, OPAC, reports) reads from
   the object buildSeed() returns, so the whole demo is driven by
   one shared set of records — the "integrated" part of an ILS.
   ============================================================ */
(function (global) {
  'use strict';

  var LS = global.LS;
  var U = LS.util;

  /* ---------------- reference tables ----------------------- */

  var BRANCHES = [
    { code: 'MAIN',  name: 'Central Library',      transitDays: 0, hours: 'Mon–Sat 09:00–20:00' },
    { code: 'NORTH', name: 'North Campus Branch',  transitDays: 2, hours: 'Mon–Fri 10:00–18:00' },
    { code: 'LAW',   name: 'Law & Policy Library',  transitDays: 1, hours: 'Mon–Sat 09:00–22:00' }
  ];

  var PATRON_TYPES = [
    { code: 'FACULTY', name: 'Faculty',       colour: 'gold' },
    { code: 'PG',      name: 'Postgraduate',  colour: 'info' },
    { code: 'UG',      name: 'Undergraduate', colour: 'info' },
    { code: 'STAFF',   name: 'Library Staff', colour: 'ok' },
    { code: 'CHILD',   name: 'Junior Member', colour: 'ok' },
    { code: 'VISITOR', name: 'Visitor',       colour: 'warn' }
  ];

  var ITEM_TYPES = [
    { code: 'BOOK',   name: 'Book' },
    { code: 'REF',    name: 'Reference' },
    { code: 'RESERVE',name: 'Short Loan / Reserve' },
    { code: 'DVD',    name: 'DVD' },
    { code: 'EQUIP',  name: 'Equipment' },
    { code: 'SERIAL', name: 'Bound Serial' },
    { code: 'EBOOK',  name: 'E-resource' }
  ];

  /* The policy matrix — patron type x item type -> the rules.
     This is the brain of circulation: two people scanning the same
     shelf get different due dates because of these rows. */
  var POLICIES = [
    // patron    item       loan  max  renew grace  fine/day  cap   holdable
    ['FACULTY', 'BOOK',      56,  40,   4,    3,     2.00,   400,  true ],
    ['FACULTY', 'RESERVE',    3,  40,   0,    0,    20.00,   400,  true ],
    ['FACULTY', 'DVD',        7,  40,   2,    1,     5.00,   200,  true ],
    ['FACULTY', 'EQUIP',      2,   2,   1,    0,    50.00,  2000,  true ],
    ['PG',      'BOOK',      28,  15,   3,    2,     3.00,   300,  true ],
    ['PG',      'RESERVE',    1,  15,   0,    0,    20.00,   300,  true ],
    ['PG',      'DVD',        7,  15,   1,    1,     5.00,   200,  true ],
    ['PG',      'EQUIP',      1,   1,   0,    0,    50.00,  2000,  true ],
    ['UG',      'BOOK',      14,   8,   2,    2,     3.00,   250,  true ],
    ['UG',      'RESERVE',    1,   8,   0,    0,    20.00,   250,  true ],
    ['UG',      'DVD',        3,   8,   1,    0,     5.00,   200,  true ],
    ['UG',      'EQUIP',      1,   1,   0,    0,    50.00,  2000,  true ],
    ['STAFF',   'BOOK',      42,  30,   4,    5,     0.00,     0,  true ],
    ['STAFF',   'DVD',       14,  30,   2,    5,     0.00,     0,  true ],
    ['CHILD',   'BOOK',      21,   5,   2,    5,     1.00,    60,  true ],
    ['CHILD',   'DVD',        7,   5,   1,    2,     2.00,    60,  true ],
    ['VISITOR', 'BOOK',       7,   2,   0,    0,     5.00,   150,  false],
    // Reference and e-resources never leave the building / never circulate.
    ['*',       'REF',        0,   0,   0,    0,     0.00,     0,  false],
    ['*',       'EBOOK',      0,   0,   0,    0,     0.00,     0,  false],
    ['*',       'SERIAL',     7,   5,   1,    1,     3.00,   200,  true ]
  ].map(function (r) {
    return {
      patronType: r[0], itemType: r[1], loanDays: r[2], maxItems: r[3],
      renewals: r[4], graceDays: r[5], finePerDay: r[6], fineCap: r[7],
      holdable: r[8]
    };
  });

  var SETTINGS = {
    libraryName: 'Aurelia Public & Research Library',
    blockThreshold: 250,          // ₹ outstanding above which checkout is blocked
    holdShelfDays: 7,             // days a trapped hold waits on the pickup shelf
    maxHoldsPerPatron: 6,
    lostProcessingFee: 75,
    countClosedDays: false,       // closed days are skipped when computing due dates
    noticeChannels: ['email', 'sms'],
    closedDates: []               // filled in below, relative to today
  };

  /* ---------------- bibliographic records ------------------ */
  /* copies: [branch, itemType, status, count] */

  var BIBS = [
    { title: 'The Design of Everyday Things', author: 'Norman, Donald A.',
      isbn: '9780465050659', publisher: 'Basic Books', year: 2013, lang: 'English',
      subjects: ['Industrial design', 'Human engineering', 'User interfaces'],
      dewey: '745.2 NOR', format: 'Book',
      summary: 'A foundational text on why some products delight and others frustrate — affordances, signifiers, feedback and the psychology of everyday failure.',
      copies: [['MAIN', 'BOOK', 'available', 3], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'Sapiens: A Brief History of Humankind', author: 'Harari, Yuval Noah',
      isbn: '9780062316097', publisher: 'Harper Perennial', year: 2015, lang: 'English',
      subjects: ['Human evolution', 'Civilization', 'World history'],
      dewey: '909 HAR', format: 'Book',
      summary: 'A sweeping account of how an unremarkable ape came to dominate the planet, from the cognitive revolution to the age of engineered life.',
      copies: [['MAIN', 'BOOK', 'available', 4], ['NORTH', 'BOOK', 'available', 2]] },

    { title: 'Introduction to Algorithms', author: 'Cormen, Thomas H.',
      isbn: '9780262046305', publisher: 'MIT Press', year: 2022, lang: 'English',
      subjects: ['Computer algorithms', 'Data structures', 'Computer science'],
      dewey: '005.1 COR', format: 'Book',
      summary: 'The standard graduate reference on algorithm design and analysis, now in its fourth edition.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['MAIN', 'RESERVE', 'available', 2]] },

    { title: 'Things Fall Apart', author: 'Achebe, Chinua',
      isbn: '9780385474542', publisher: 'Anchor Books', year: 1994, lang: 'English',
      subjects: ['Nigeria — Fiction', 'Colonialism — Fiction', 'African literature'],
      dewey: '823.914 ACH', format: 'Book',
      summary: 'Okonkwo’s rise and fall in an Igbo village on the eve of British colonial arrival.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'The Argumentative Indian', author: 'Sen, Amartya',
      isbn: '9780312426026', publisher: 'Picador', year: 2006, lang: 'English',
      subjects: ['India — Civilization', 'Public debate', 'Secularism'],
      dewey: '954 SEN', format: 'Book',
      summary: 'Essays on India’s long tradition of heterodoxy, argument and public reasoning.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['LAW', 'BOOK', 'available', 1]] },

    { title: 'Midnight’s Children', author: 'Rushdie, Salman',
      isbn: '9780812976533', publisher: 'Random House', year: 2006, lang: 'English',
      subjects: ['India — Fiction', 'Magic realism', 'Partition'],
      dewey: '823.914 RUS', format: 'Book',
      summary: 'Saleem Sinai, born at the stroke of Independence, is handcuffed to the history of a nation.',
      copies: [['MAIN', 'BOOK', 'available', 3]] },

    { title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Martin, Robert C.',
      isbn: '9780132350884', publisher: 'Prentice Hall', year: 2008, lang: 'English',
      subjects: ['Computer programming', 'Software engineering', 'Agile'],
      dewey: '005.1 MAR', format: 'Book',
      summary: 'Principles, patterns and practices for writing code other people can read.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 2]] },

    { title: 'The Namesake', author: 'Lahiri, Jhumpa',
      isbn: '9780618485222', publisher: 'Mariner Books', year: 2004, lang: 'English',
      subjects: ['Bengali Americans — Fiction', 'Identity', 'Immigrant families'],
      dewey: '813.54 LAH', format: 'Book',
      summary: 'Gogol Ganguli grows up between two countries and two names.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'A Brief History of Time', author: 'Hawking, Stephen W.',
      isbn: '9780553380163', publisher: 'Bantam', year: 1998, lang: 'English',
      subjects: ['Cosmology', 'Astrophysics', 'Space and time'],
      dewey: '523.1 HAW', format: 'Book',
      summary: 'Black holes, the big bang and the arrow of time, explained without a single equation but one.',
      copies: [['MAIN', 'BOOK', 'available', 3], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'Train to Pakistan', author: 'Singh, Khushwant',
      isbn: '9780143065883', publisher: 'Penguin India', year: 2009, lang: 'English',
      subjects: ['India — Partition — Fiction', 'Punjab', 'Communal violence'],
      dewey: '891.4 SIN', format: 'Book',
      summary: 'The village of Mano Majra, untouched by Partition, until a train arrives.',
      copies: [['MAIN', 'BOOK', 'available', 2]] },

    { title: 'Thinking, Fast and Slow', author: 'Kahneman, Daniel',
      isbn: '9780374533557', publisher: 'Farrar, Straus and Giroux', year: 2013, lang: 'English',
      subjects: ['Decision making', 'Cognitive bias', 'Behavioural economics'],
      dewey: '153.42 KAH', format: 'Book',
      summary: 'Two systems of thought, and the systematic errors of the fast one.',
      copies: [['MAIN', 'BOOK', 'available', 3], ['LAW', 'BOOK', 'available', 1]] },

    { title: 'The God of Small Things', author: 'Roy, Arundhati',
      isbn: '9780812979657', publisher: 'Random House', year: 2008, lang: 'English',
      subjects: ['Kerala — Fiction', 'Family', 'Caste'],
      dewey: '823.914 ROY', format: 'Book',
      summary: 'Twins Rahel and Estha, and the small things that decide a family’s fate in Ayemenem.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'Principles of Economics', author: 'Mankiw, N. Gregory',
      isbn: '9780357038314', publisher: 'Cengage Learning', year: 2020, lang: 'English',
      subjects: ['Economics', 'Microeconomics', 'Macroeconomics'],
      dewey: '330 MAN', format: 'Book',
      summary: 'The standard first-year survey, built around ten principles.',
      copies: [['MAIN', 'RESERVE', 'available', 3], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'Gray’s Anatomy for Students', author: 'Drake, Richard L.',
      isbn: '9780323934237', publisher: 'Elsevier', year: 2023, lang: 'English',
      subjects: ['Human anatomy', 'Medicine — Study and teaching'],
      dewey: '611 DRA', format: 'Book',
      summary: 'Regional anatomy for the clinical years, heavily illustrated.',
      copies: [['MAIN', 'RESERVE', 'available', 2], ['MAIN', 'REF', 'reference', 1]] },

    { title: 'The Discovery of India', author: 'Nehru, Jawaharlal',
      isbn: '9780195623598', publisher: 'Oxford University Press', year: 1989, lang: 'English',
      subjects: ['India — History', 'Nationalism', 'Indian independence movement'],
      dewey: '954 NEH', format: 'Book',
      summary: 'Written from Ahmednagar Fort prison — a nation’s past read by one of its architects.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['LAW', 'BOOK', 'available', 1]] },

    { title: 'Norwegian Wood', author: 'Murakami, Haruki',
      isbn: '9780375704024', publisher: 'Vintage International', year: 2000, lang: 'English',
      subjects: ['Japan — Fiction', 'Coming of age', 'Grief'],
      dewey: '895.6 MUR', format: 'Book',
      summary: 'Toru Watanabe remembers Tokyo in 1969, and two women who could not be reconciled.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 1]] },

    { title: 'Law of Contract and Specific Relief', author: 'Singh, Avtar',
      isbn: '9789389530568', publisher: 'Eastern Book Company', year: 2021, lang: 'English',
      subjects: ['Contracts — India', 'Specific performance', 'Commercial law'],
      dewey: '346.54 SIN', format: 'Book',
      summary: 'The standard Indian commentary on the Contract Act, 1872 with current case law.',
      copies: [['LAW', 'RESERVE', 'available', 3], ['LAW', 'REF', 'reference', 1]] },

    { title: 'Educated: A Memoir', author: 'Westover, Tara',
      isbn: '9780399590504', publisher: 'Random House', year: 2018, lang: 'English',
      subjects: ['Westover, Tara', 'Education', 'Autobiography'],
      dewey: '921 WES', format: 'Book',
      summary: 'A survivalist childhood in Idaho, and a first classroom at seventeen.',
      copies: [['MAIN', 'BOOK', 'available', 2], ['NORTH', 'BOOK', 'available', 2]] },

    { title: 'The Wonder That Was India', author: 'Basham, A. L.',
      isbn: '9780330439091', publisher: 'Picador India', year: 2004, lang: 'English',
      subjects: ['India — Civilization', 'Ancient history', 'Indology'],
      dewey: '954 BAS', format: 'Book',
      summary: 'A survey of the culture of the Indian sub-continent before the coming of the Muslims.',
      copies: [['MAIN', 'BOOK', 'available', 2]] },

    { title: 'Blade Runner 2049', author: 'Villeneuve, Denis (dir.)',
      isbn: '5051892208475', publisher: 'Warner Home Video', year: 2018, lang: 'English',
      subjects: ['Science fiction films', 'Feature films'],
      dewey: 'DVD 791.43 BLA', format: 'DVD',
      summary: 'Thirty years after the original, a new blade runner unearths a secret.',
      copies: [['MAIN', 'DVD', 'available', 2], ['NORTH', 'DVD', 'available', 1]] },

    { title: 'Loan Laptop — ThinkPad T14 (4-hour)', author: 'Aurelia Library IT Services',
      isbn: '', publisher: 'Lenovo', year: 2024, lang: '—',
      subjects: ['Equipment loan', 'Laptops'],
      dewey: 'EQUIP LAPTOP', format: 'Equipment',
      summary: 'Short-loan laptop for use inside the library. Charger and sleeve included.',
      copies: [['MAIN', 'EQUIP', 'available', 4], ['NORTH', 'EQUIP', 'available', 2]] },

    { title: 'Digital Minimalism', author: 'Newport, Cal',
      isbn: '9780525542872', publisher: 'Portfolio', year: 2019, lang: 'English',
      subjects: ['Attention', 'Technology — Social aspects', 'Self-management'],
      dewey: 'EB 303.483 NEW', format: 'E-book',
      summary: 'A philosophy of technology use built on intention rather than convenience. Licensed e-book, 3 simultaneous users.',
      copies: [['MAIN', 'EBOOK', 'licensed', 1]],
      eresource: { platform: 'ProQuest Ebook Central', simultaneous: 3, illAllowed: false,
                   walkIn: true, licenseEnds: '2027-03-31' } }
  ];

  /* ---------------- patrons -------------------------------- */
  /* regDaysAgo / expiresInDays keep the demo dataset evergreen. */

  var PATRONS = [
    { name: 'Ananya Rao',      type: 'PG',      branch: 'MAIN',  email: 'ananya.rao@aurelia.edu',    phone: '+91 98450 11234', regDaysAgo: 640,  expiresIn: 180 },
    { name: 'Dev Mehta',       type: 'UG',      branch: 'NORTH', email: 'dev.mehta@aurelia.edu',     phone: '+91 99000 55210', regDaysAgo: 320,  expiresIn: 92  },
    { name: 'Prof. Iqbal Syed',type: 'FACULTY', branch: 'MAIN',  email: 'i.syed@aurelia.edu',        phone: '+91 98111 77345', regDaysAgo: 2100, expiresIn: 410 },
    { name: 'Meera Krishnan',  type: 'FACULTY', branch: 'LAW',   email: 'm.krishnan@aurelia.edu',    phone: '+91 98202 44120', regDaysAgo: 1580, expiresIn: 300 },
    { name: 'Rohit Bansal',    type: 'UG',      branch: 'MAIN',  email: 'rohit.bansal@aurelia.edu',  phone: '+91 97400 66512', regDaysAgo: 210,  expiresIn: 40  },
    { name: 'Sara D\u2019Souza',   type: 'PG',      branch: 'MAIN',  email: 'sara.dsouza@aurelia.edu',   phone: '+91 96500 31288', regDaysAgo: 505,  expiresIn: 240 },
    { name: 'Kabir Nair',      type: 'CHILD',   branch: 'NORTH', email: 'guardian.nair@mail.com',    phone: '+91 90080 12456', regDaysAgo: 150,  expiresIn: 215, guarantor: 'Lakshmi Nair' },
    { name: 'Tanvi Shah',      type: 'STAFF',   branch: 'MAIN',  email: 't.shah@aurelia.edu',        phone: '+91 95100 88903', regDaysAgo: 980,  expiresIn: 365 },
    { name: 'Arjun Pillai',    type: 'UG',      branch: 'NORTH', email: 'arjun.pillai@aurelia.edu',  phone: '+91 93400 22781', regDaysAgo: 400,  expiresIn: -12 },
    { name: 'Nadia Farooq',    type: 'VISITOR', branch: 'MAIN',  email: 'nadia.farooq@mail.com',     phone: '+91 91600 45009', regDaysAgo: 60,   expiresIn: 30  },
    { name: 'Vikram Desai',    type: 'PG',      branch: 'LAW',   email: 'v.desai@aurelia.edu',       phone: '+91 99880 71003', regDaysAgo: 720,  expiresIn: 155 },
    { name: 'Leela Menon',     type: 'UG',      branch: 'MAIN',  email: 'leela.menon@aurelia.edu',   phone: '+91 98850 09934', regDaysAgo: 275,  expiresIn: 120 }
  ];

  /* ---------------- acquisitions --------------------------- */

  var VENDORS = [
    { code: 'ATLAS',  name: 'Atlas Book Supply',        contact: 'orders@atlasbooks.in',   edi: true,  leadDays: 18 },
    { code: 'EBC',    name: 'Eastern Book Company',     contact: 'trade@ebc.co.in',        edi: false, leadDays: 12 },
    { code: 'PROQ',   name: 'ProQuest / Ebook Central', contact: 'apac@proquest.com',      edi: true,  leadDays: 3  },
    { code: 'SWETS',  name: 'Meridian Subscriptions',   contact: 'serials@meridian.co',    edi: true,  leadDays: 30 }
  ];

  var FUNDS = [
    { code: 'MONO-GEN', name: 'Monographs — General',   allocated: 1800000 },
    { code: 'MONO-LAW', name: 'Monographs — Law',       allocated: 650000  },
    { code: 'SER-2026', name: 'Serials Subscriptions',  allocated: 2400000 },
    { code: 'ERES',     name: 'Electronic Resources',   allocated: 3100000 },
    { code: 'MEDIA',    name: 'Audio-visual & Equipment',allocated: 420000  }
  ];

  var ORDERS = [
    { vendor: 'ATLAS', fund: 'MONO-GEN', title: 'Why We Sleep', author: 'Walker, Matthew',
      isbn: '9781501144325', qty: 4, unitPrice: 899, status: 'received', daysAgo: 42, requestedBy: 'Dept. of Psychology' },
    { vendor: 'ATLAS', fund: 'MONO-GEN', title: 'The Anarchy', author: 'Dalrymple, William',
      isbn: '9781635573954', qty: 3, unitPrice: 1250, status: 'invoiced', daysAgo: 58, requestedBy: 'Dept. of History' },
    { vendor: 'EBC', fund: 'MONO-LAW', title: 'Constitutional Law of India', author: 'Jain, M. P.',
      isbn: '9789389176803', qty: 5, unitPrice: 2495, status: 'ordered', daysAgo: 11, requestedBy: 'Prof. Meera Krishnan' },
    { vendor: 'PROQ', fund: 'ERES', title: 'Cambridge Core — Law Collection 2026', author: 'Cambridge University Press',
      isbn: '', qty: 1, unitPrice: 486000, status: 'ordered', daysAgo: 6, requestedBy: 'Systems Librarian' },
    { vendor: 'ATLAS', fund: 'MONO-GEN', title: 'Poor Economics', author: 'Banerjee & Duflo',
      isbn: '9781610390934', qty: 6, unitPrice: 699, status: 'claimed', daysAgo: 74, requestedBy: 'Dept. of Economics' },
    { vendor: 'SWETS', fund: 'SER-2026', title: 'Nature — 2026 institutional renewal', author: 'Springer Nature',
      isbn: '', qty: 1, unitPrice: 372000, status: 'invoiced', daysAgo: 96, requestedBy: 'Serials Desk' },
    { vendor: 'ATLAS', fund: 'MEDIA', title: 'Document camera — IPEVO V4K (x4)', author: 'IPEVO',
      isbn: '', qty: 4, unitPrice: 8900, status: 'suggested', daysAgo: 2, requestedBy: 'Media Lab' },
    { vendor: 'EBC', fund: 'MONO-LAW', title: 'Principles of Statutory Interpretation', author: 'Singh, G. P.',
      isbn: '9789389656404', qty: 3, unitPrice: 2195, status: 'received', daysAgo: 30, requestedBy: 'Law Faculty' }
  ];

  /* ---------------- serials -------------------------------- */

  var SERIALS = [
    { title: 'Nature', issn: '0028-0836', vendor: 'SWETS', pattern: 'Weekly',
      branch: 'MAIN', volume: 641, fund: 'SER-2026', intervalDays: 7 },
    { title: 'Economic and Political Weekly', issn: '0012-9976', vendor: 'SWETS',
      pattern: 'Weekly', branch: 'MAIN', volume: 61, fund: 'SER-2026', intervalDays: 7 },
    { title: 'IEEE Spectrum', issn: '0018-9235', vendor: 'SWETS', pattern: 'Monthly',
      branch: 'NORTH', volume: 63, fund: 'SER-2026', intervalDays: 30 },
    { title: 'Journal of the Indian Law Institute', issn: '0019-5731', vendor: 'EBC',
      pattern: 'Quarterly', branch: 'LAW', volume: 68, fund: 'SER-2026', intervalDays: 91 }
  ];

  /* ============================================================
     builder
     ============================================================ */

  function buildSeed() {
    var t = U.today();
    var db = {
      settings: U.clone(SETTINGS),
      branches: U.clone(BRANCHES),
      patronTypes: U.clone(PATRON_TYPES),
      itemTypes: U.clone(ITEM_TYPES),
      policies: U.clone(POLICIES),
      vendors: U.clone(VENDORS),
      bibs: [], items: [], patrons: [], loans: [], holds: [], fines: [],
      funds: [], orders: [], serials: [], notices: [], audit: [], ill: []
    };

    /* closed days: the two upcoming Sundays plus a public holiday */
    var sunday = new Date(t);
    sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
    db.settings.closedDates = [
      U.iso(sunday),
      U.iso(U.addDays(sunday, 7)),
      U.iso(U.addDays(t, 9))
    ];

    /* --- bibs + items ------------------------------------- */
    BIBS.forEach(function (b, bi) {
      var bibId = 'B' + String(bi + 1).padStart(4, '0');
      var bib = {
        id: bibId, title: b.title, author: b.author, isbn: b.isbn,
        publisher: b.publisher, year: b.year, lang: b.lang,
        subjects: b.subjects.slice(), dewey: b.dewey, format: b.format,
        summary: b.summary, eresource: b.eresource || null,
        created: U.iso(U.addDays(t, -(300 + bi * 17))),
        source: bi % 3 === 0 ? 'Z39.50 — Library of Congress' :
                bi % 3 === 1 ? 'MARC import — union catalogue' : 'Original cataloguing'
      };
      db.bibs.push(bib);

      var copyNo = 0;
      b.copies.forEach(function (spec) {
        var branch = spec[0], itype = spec[1], status = spec[2], count = spec[3];
        for (var c = 0; c < count; c++) {
          copyNo++;
          db.items.push({
            barcode: '3' + String(bi + 1).padStart(4, '0') + String(copyNo).padStart(2, '0'),
            bibId: bibId,
            branch: branch,
            homeBranch: branch,
            type: itype,
            status: status === 'licensed' ? 'licensed' : status,
            callNo: b.dewey + (count > 1 ? ' c.' + copyNo : ''),
            accession: 'AC-' + String(10000 + bi * 20 + copyNo),
            price: b.format === 'Equipment' ? 68000 :
                   b.format === 'DVD' ? 1490 :
                   b.format === 'E-book' ? 1850 : 400 + ((bi * 137) % 2200),
            added: U.iso(U.addDays(t, -(300 + bi * 31 + c * 11))),
            /* a deliberate slice of the collection has never circulated,
               so the weeding report has something real to show */
            circCount: ((bi * 3 + c) % 9 === 0) ? 0 : (bi * 7 + c * 3) % 34 + 1,
            lastSeen: U.iso(U.addDays(t, -((bi * 5 + c) % 90))),
            shelf: branch === 'MAIN' ? 'Level ' + (1 + (bi % 3)) + ' — Open stacks'
                 : branch === 'NORTH' ? 'Ground floor — Short loan'
                 : 'Law reading room',
            note: ''
          });
        }
      });
    });

    /* --- patrons ------------------------------------------ */
    PATRONS.forEach(function (p, i) {
      db.patrons.push({
        id: 'P' + String(i + 1).padStart(4, '0'),
        cardNo: '2' + String(100000 + i * 137),
        name: p.name,
        type: p.type,
        branch: p.branch,
        email: p.email,
        phone: p.phone,
        guarantor: p.guarantor || null,
        registered: U.iso(U.addDays(t, -p.regDaysAgo)),
        expires: U.iso(U.addDays(t, p.expiresIn)),
        manualBlock: null,
        notes: [],
        historyOptIn: i % 3 !== 0,
        pin: '1234'
      });
    });

    /* --- funds -------------------------------------------- */
    FUNDS.forEach(function (f) {
      db.funds.push({ code: f.code, name: f.name, allocated: f.allocated,
                      encumbered: 0, spent: 0 });
    });

    /* --- orders ------------------------------------------- */
    ORDERS.forEach(function (o, i) {
      var created = U.addDays(t, -o.daysAgo);
      var order = {
        id: 'O' + String(i + 1).padStart(4, '0'),
        po: 'PO-2026-' + String(1040 + i),
        vendor: o.vendor, fund: o.fund,
        title: o.title, author: o.author, isbn: o.isbn,
        qty: o.qty, unitPrice: o.unitPrice,
        total: o.qty * o.unitPrice,
        status: o.status,
        requestedBy: o.requestedBy,
        created: U.iso(created),
        ordered: o.status === 'suggested' ? null : U.iso(U.addDays(created, 1)),
        received: (o.status === 'received' || o.status === 'invoiced') ? U.iso(U.addDays(created, 15)) : null,
        invoiced: o.status === 'invoiced' ? U.iso(U.addDays(created, 22)) : null,
        invoiceNo: o.status === 'invoiced' ? 'INV-' + (88100 + i) : null,
        claimedOn: o.status === 'claimed' ? U.iso(U.addDays(created, 40)) : null
      };
      db.orders.push(order);

      var fund = db.funds.find(function (f) { return f.code === o.fund; });
      if (fund) {
        if (order.status === 'ordered' || order.status === 'claimed' || order.status === 'received') {
          fund.encumbered += order.total;
        } else if (order.status === 'invoiced') {
          fund.spent += order.total;
        }
      }
    });

    /* --- serials ------------------------------------------ */
    SERIALS.forEach(function (s, i) {
      var issues = [];
      // six back issues, most received, one late -> claimable
      for (var k = 6; k >= 1; k--) {
        var expected = U.addDays(t, -(k - 1) * s.intervalDays - 3);
        var late = (k === 2 && i < 3);
        issues.push({
          id: U.uid(),
          label: 'Vol. ' + s.volume + ', no. ' + (30 - k),
          expected: U.iso(expected),
          received: late ? null : U.iso(U.addDays(expected, 1)),
          status: late ? 'late' : 'received',
          claimed: false,
          bound: false
        });
      }
      issues.push({
        id: U.uid(),
        label: 'Vol. ' + s.volume + ', no. 30',
        expected: U.iso(U.addDays(t, 4)),
        received: null, status: 'expected', claimed: false, bound: false
      });
      db.serials.push({
        id: 'S' + String(i + 1).padStart(3, '0'),
        title: s.title, issn: s.issn, vendor: s.vendor, pattern: s.pattern,
        branch: s.branch, volume: s.volume, fund: s.fund,
        intervalDays: s.intervalDays,
        issues: issues
      });
    });

    /* --- interlibrary loan -------------------------------- */
    db.ill = [
      { id: 'ILL-0001', direction: 'borrowing', title: 'Handbook of Mathematical Functions',
        patronId: 'P0003', partner: 'IIT Madras Central Library', status: 'in-transit',
        placed: U.iso(U.addDays(t, -6)), due: U.iso(U.addDays(t, 24)), protocol: 'NCIP' },
      { id: 'ILL-0002', direction: 'lending', title: 'The Wonder That Was India',
        patronId: null, partner: 'Presidency College Library', status: 'on-loan',
        placed: U.iso(U.addDays(t, -14)), due: U.iso(U.addDays(t, 7)), protocol: 'ISO ILL' }
    ];

    return db;
  }

  LS.buildSeed = buildSeed;
  LS.reference = {
    BRANCHES: BRANCHES, PATRON_TYPES: PATRON_TYPES, ITEM_TYPES: ITEM_TYPES
  };
})(window);
