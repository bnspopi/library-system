# Aurelia ILS

A working, clickable demonstration of an **integrated library system** — the ERP-style software
that runs a library: an inventory of items, the people who borrow them, the money spent acquiring
them, and the rules that decide who may take what and for how long.

Two pages, no build step, no backend:

| Page | What it is |
|------|------------|
| `index.html` | An animated explainer — **a scroll-scrubbed walk down the stacks**, the architecture, the data model, a module-by-module walkthrough, the life of one book, a live rules playground and the interoperability standards. |
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

## Run it locally

It is static — any web server will do, and it even works opened straight off disk.

```bash
# any one of these
python3 -m http.server 5173     # → http://localhost:5173
npx serve .
npm run dev

# or just open the file
open index.html                 # macOS
xdg-open index.html             # Linux
```

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
    landing.css       explainer page
    app.css           staff client and OPAC
  js/
    core.js           namespace, dates, money, event bus, demo clock
    motion.js         scroll reveals, counters, marquees, tilt, magnetic, parallax
    shelfwalk.js      the scroll-scrubbed walk down the aisle + reserve-a-book flow
    data.js           the seed dataset — bibs, items, patrons, funds, serials, policies
    engine.js         the business rules: circulation, holds, fines, acquisitions, the nightly job
    ui.js             toasts, modals, drawers, tabs, charts, receipts
    app.js            shell, routing, live activity rail, command palette
    views-desk.js     overview, circulation, holds & transit, fines
    views-collection.js  cataloguing, membership, acquisitions, serials, interlibrary loan
    views-system.js   reports, notices & jobs, administration
    views-opac.js     public catalogue, member account, self-check kiosk
```

Plain scripts on `window.LS`, no bundler and no dependencies, which is why it runs from `file://`.

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
