# Aurelia ILS

A working, clickable demonstration of an **integrated library system** — the ERP-style software
that runs a library: an inventory of items, the people who borrow them, the money spent acquiring
them, and the rules that decide who may take what and for how long.

Two pages, no build step, no backend:

| Page | What it is |
|------|------------|
| `index.html` | The opening tour (arrive on foot, choose a door in the reception, walk a hall as a WebGL room built from the footage), the orrery (the great book with every hall in orbit, opened by the scroll bar), the walk down the stacks, then the explainer: architecture, data model, modules, the life of one book, a live rules playground and the standards. |
| `app.html` | The system itself. A staff client with thirteen modules and a public catalogue, both reading and writing one shared in-browser database. |

Everything is real logic. Issue a reference copy and it is refused. Return a book somebody is
waiting for and the hold traps before the copy reaches the shelf. Edit a row of the policy matrix
and the next checkout uses it. Push the demo clock forward a week and the nightly job accrues
fines, sends notices and expires stale holds for each day skipped.

---

## Walk the stacks

The centrepiece of the landing page (and the **Walk the stacks** tab of the public catalogue) is a
scroll-scrubbed walk down a library aisle. Scrolling dollies the camera through seven bays while a
figure walks ahead of you, the lamps throw pools onto the floor, dust hangs in the light, and
staged captions fade in and out.

It is real CSS 3D geometry, not video — which is the point. The spines on the last two bays are
**catalogue records**. Reach the end of the aisle and any gilt-edged spine becomes clickable: it
tips off the shelf, the book opens, and the right-hand page is the reservation — availability by
branch, who is borrowing, where to collect. Reserving writes a genuine hold into the same database
the circulation desk uses, and it appears immediately on the pull list and the member's account.

No footage, no asset downloads, no 3D library: it is `assets/css/shelfwalk.css` plus
`assets/js/shelfwalk.js`, which mounts against either the window (landing page) or the app's own
scroll pane (staff client).

## The Living Stacks: the tour, the rooms and the orrery

The page opens on a tour, and only after it does the landing page appear.

**The arrival.** You arrive on foot: a wet street, the steps, the doors, a corridor, the reading
hall. Every clip is scrubbed by the scroll bar. Nothing plays on its own.

**The reception.** A room of doorways around you. Drag to look round, or click a door or the stairs
(NW is the Children's Wing, W the Closed Wing, E the Atlas Vault, the stairs go up to Science and
Technology). Scrolling walks you through the door you face, and the hall behind it follows. The
other halls wait behind their doors until you choose them; the rail on the left reaches any of them.

**The rooms.** Inside a hall the footage is not behind the scene, it is the scene. Each clip is
wrapped round you as the floor and a curved wall of a WebGL room. Dragging turns your head inside
the shot, scrolling walks you into it while the film scrubs and the beats crossfade, and the
things in the footage are clickable: the book on the table turns the page (the scroll moves on to
the next beat), the whale opens its record, the door walks you on, the plinth pushes the camera in.
Hover anything with a gold ring and it is named. The titles on the hall's shelf float in the room
in front of the wall; click one and it comes down to you, click it again and it opens: the record
and the reservation on the left, and the hall's own clip standing up out of the right-hand page,
still driven by the scroll bar and still clickable. Escape, or a click away, puts it back.

**The orrery.** The landing page proper: the great book turning at the centre with a book for
every hall in orbit around it, the orbit clip as the backdrop. Drag to turn it. Click any book (or
its chip) and it comes to you; from there the scroll bar opens it, cover first, then page after
page with curling sheets: an ex libris, a title page with a clip standing up out of it, the hall's
captions, a film page, the live shelf (click a row to reserve it), the way to the catalogue, and
the next hall. The great book holds the system itself: what it is, its ten modules (click one to
open it in the staff client), the numbers, the standards it speaks.

Reserving anywhere writes a real hold into the same database the circulation desk uses. The same
tour is a tab in the OPAC (**Public → Collections**), pinned inside the app's own scroll pane.

### The footage

Sixty-one clips live in `public/scenes/`, catalogued by hall in `REGISTRY` in `assets/js/scenes.js`
as beats `{ src, label, lines }`. What is clickable inside each clip is in `assets/js/hotspots.js`:
rectangles of the frame with a label and an action (`turn`, `reserve`, `look`, `book`, `hall`).
Adding a clip is one line in the registry and, optionally, a line of hotspots.

Scrubbing is only frame-accurate when every frame is a keyframe, so clips are re-encoded all-intra,
muted, 1280 px wide, with a poster frame and a lighter 720 px copy for phones. Generator marks sit
in the bottom band of the frame and are cropped away, not painted over:

```bash
# 1920x1080 sources: crop the bottom 220 px
ffmpeg -i in.mp4 -an -vf "crop=1920:860:0:0,scale=1280:-2" \
  -c:v libx264 -preset slow -crf 29 -g 1 -pix_fmt yuv420p -movflags +faststart public/scenes/<slug>.mp4
# 1280x720 sources: crop the bottom 64 px
ffmpeg -i in.mp4 -an -vf "crop=1280:656:0:0" \
  -c:v libx264 -preset slow -crf 29 -g 1 -pix_fmt yuv420p -movflags +faststart public/scenes/<slug>.mp4
# the poster, and the phone copy
ffmpeg -i public/scenes/<slug>.mp4 -frames:v 1 -q:v 4 public/scenes/<slug>.jpg
ffmpeg -i public/scenes/<slug>.mp4 -an -vf "scale=720:-2" -c:v libx264 -preset slow -crf 30 -g 1 \
  -pix_fmt yuv420p -movflags +faststart public/scenes/<slug>-m.mp4
```

Seeking needs a server that answers HTTP Range requests. Vercel does; `npx serve` does;
`python -m http.server` does not, and the clips will sit on their first frame.

### What it is built on

- **three.js** (`assets/vendor/three.min.js`, MIT, r186, with the SVG loader and room environment
  bundled) draws the rooms, the books and the orrery. `assets/js/living3d.js` is the engine: a
  pool of two renderers handed to whichever pinned stage is on screen, the book (covers, curling
  sheets, canvas pages, films standing up out of the page), the reader that takes a book down and
  puts it back. `assets/js/bookfaces.js` writes the pages. `assets/js/hall3d.js` is a room,
  `assets/js/orrery.js` the landing page.
- **GSAP ScrollTrigger** (`assets/vendor/gsap.min.js`, `ScrollTrigger.min.js`, Standard "no
  charge" license) pins every stage and scrubs it.
- **scroll-craft** (`assets/vendor/scrollcraft.js`, `.css`, MIT, from
  github.com/nateherkai/scroll-craft) drives the explainer sections below the orrery: reveals,
  headings that assemble line by line, counters, the ground colour drifting as you travel. Its
  craft rules are followed on the page: no scroll cues, no section counters, no visible em dashes,
  at most one eyebrow in three sections.
- The motion vocabulary follows the HyperFrames student kit's notes (spin reveals, the hero shot
  held, the vignette breathing) and the pages follow the frontend-design guardrails (two families,
  transforms and opacity only, hover, focus and active states on everything clickable).

No build step: everything is a classic script on `window.LS`.

## Run it locally

It is static, so any web server that answers HTTP Range requests will do (the clips are seeked,
never played, and a server without Range support leaves them on their first frame):

```bash
npx serve .                     # → http://localhost:3000
npm run dev
```

`python -m http.server` and opening the files straight off disk still run the app; only the
scrubbed footage needs the Range support.

---

## Deploy to Vercel

The repository is already configured (`vercel.json`); there is nothing to build.

### Option A — from the command line

```bash
npm i -g vercel          # once
cd library-system

vercel login             # once, opens a browser
vercel                   # preview deployment, answers the setup prompts
vercel --prod            # promote to production
```

Non-interactive (CI, or to skip the prompts):

```bash
vercel --prod --yes
```

With an explicit project name, or against an org/team:

```bash
vercel --prod --yes --name aurelia-ils
vercel --prod --yes --scope <your-team-slug>
```

Using a token instead of an interactive login:

```bash
vercel --prod --yes --token "$VERCEL_TOKEN"
```

### Option B — from the Git repository

```bash
git push -u origin claude/determined-sagan-hxvzfl
```

Then in the Vercel dashboard: **Add New → Project → import this repository**, and accept the
defaults. Leave *Framework Preset* as **Other**, *Build Command* empty and *Output Directory*
empty — it is a static site served from the repository root. Every later push redeploys it.

### Useful follow-ups

```bash
vercel ls                        # list deployments
vercel inspect <deployment-url>  # details of one deployment
vercel domains add example.com   # attach a custom domain
vercel env ls                    # (none are needed — the demo has no secrets)
vercel rollback <deployment-url> # revert production to an earlier build
```

> The first `vercel` run writes a `.vercel/` directory linking the folder to the project.
> It is git-ignored.

---

## How it is put together

```
index.html            explainer page
app.html              staff client + public catalogue
assets/
  css/
    tokens.css        colour, type, spacing and motion tokens
    base.css          reset, typography, buttons, forms, tables
    motion.css        the CSS half of the animation layer
    shelfwalk.css     the 3D stacks corridor and the book-opening reservation
    scenes.css        the tour: pinned halls, the reception, rail, captions
    living3d.css      the 3D layer: canvas, hints, hotspot tags, the orrery
    landing.css       explainer page
    app.css           staff client and OPAC
  js/
    core.js           namespace, dates, money, event bus, demo clock
    motion.js         scroll reveals, counters, marquees, tilt, magnetic, parallax
    shelfwalk.js      the scroll-scrubbed walk down the aisle + reserve-a-book flow
    scenes.js         the tour: clip registry, the reception, GSAP ScrollTrigger scrubbing
    living3d.js       the 3D engine: renderer pool, the book, the reader
    bookfaces.js      what is written on the pages
    hotspots.js       what is clickable inside every clip
    hall3d.js         a hall as a room built from its footage
    orrery.js         the landing page
  vendor/             gsap, ScrollTrigger, three.js, scrollcraft
public/scenes/        the clips (all-intra H.264, 1280 px wide, plus -m phone copies) and posters
    data.js           the seed dataset — bibs, items, patrons, funds, serials, policies
    engine.js         the business rules: circulation, holds, fines, acquisitions, the nightly job
    ui.js             toasts, modals, drawers, tabs, charts, receipts
    app.js            shell, routing, live activity rail, command palette
    views-desk.js     overview, circulation, holds & transit, fines
    views-collection.js  cataloguing, membership, acquisitions, serials, interlibrary loan
    views-system.js   reports, notices & jobs, administration
    views-opac.js     public catalogue, member account, self-check kiosk
```

Plain scripts on `window.LS` and no bundler; the vendored libraries are the only dependencies.

### The layers

```
Patrons  →  OPAC · mobile · self-check kiosk
Staff    →  staff client · RFID pad
                    ↓        HTTPS / SIP2 / NCIP
         Application / API layer
         Circulation | Catalog | Acquisitions | Serials | Users | Fines | ERM
                    ↓
         Business rules + policy
         loan periods · limits · fines · hold capture · encumbrance
                    ↓
         One shared database
         bibs | items | patrons | transactions | holds | fines | funds | audit
                    ↓
         Integrations: payments, email/SMS, RFID, union catalogue, knowledge base
```

Modules are not separate applications. A single check-in closes the transaction, charges any
overdue, traps the copy for the hold queue, sends the notice and moves the statistics — one write,
every panel updated, which is what the live activity rail on the right of the staff client shows.

---

## What to try

**Staff side**

- **Circulation → Issue** — pick a member, then a copy. Try the "blocked case" chips: a reference
  copy, a copy already on loan, a licensed e-book. Each is refused with the rule that refused it.
- **Circulation → Return** — return a copy of *Midnight's Children* or *A Brief History of Time*
  and watch the hold trap instead of the copy being reshelved.
- **Holds & transit** — capture holds off the pull list, watch copies move between branches.
- **Fines** — take a payment, waive a charge, see a member cross the block threshold.
- **Cataloguing** — import a MARC record (try ISBN `9789353452940`), attach copies, view any
  record as MARC21.
- **Acquisitions** — move an order suggested → ordered → received → invoiced and watch the money
  travel from free, to encumbered, to spent. Try to raise an order the fund cannot cover.
- **Administration → Policy matrix** — change `UG × BOOK` loan days to 3, then issue a book to an
  undergraduate.
- **Notices & jobs** — run the nightly job, or skip a week and watch the fines accrue.
- The **clock chip** in the header jumps the demo forward in time.
- Press <kbd>/</kbd> for global search; <kbd>Alt</kbd>+<kbd>1…7</kbd> jumps between modules.

**Public side** — the *Public* toggle in the header

- **Walk the stacks** — scroll to the end of the aisle, pull a gilt-edged spine off the shelf and
  reserve it, then find that hold waiting on the staff side under Holds & transit.
- **Collections** — scroll the nine halls; every frame moves only when you do. Reach the end of
  one and open its shelf. Deep links work too: `app.html#/opac?collection=mythology`.
- Search, facet, place a hold, then look at the same hold from the staff side.
- Sign in with any demo library card. Two of them are blocked.
- Renew a loan; it is refused for exactly the reasons the desk would refuse it.
- The **Self-check** tab is a SIP2 kiosk hitting the same circulation engine.

---

## Notes

- All data is fictional and lives in memory. Reloading, or **Reset demo** in the sidebar, rebuilds
  the opening dataset.
- Respects `prefers-reduced-motion`: every animation is disabled and content renders immediately.
- Works at phone width; the staff rail becomes a scrolling row.
