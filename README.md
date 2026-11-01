# MesaSays

**The Mexico City food guide written by the people who eat and the people who cook.**
It tells the truth about restaurants and wants them to do well. No restaurant pays to be in it.

Live: https://mesasays.com · Films: [The Dining Dispatch](https://www.youtube.com/@TheDiningDispatch)

*Español: la guía de comida de la Ciudad de México, escrita por quienes comen y quienes cocinan.*

## What this is

- A restaurant guide for Mexico City: places, menus with prices, what to order, what to skip.
- **Say**: open conversations about restaurants. No account, no stars, no scores.
- No tracking: no analytics, no cookies, no request to Google when you load a page
  (YouTube films load only when you press play).
- **No token.** There is no coin, no airdrop, no points program.

## Status: what is open, and what is still centralized

We would rather say it than have you find it. Today MesaSays is an ordinary website with
open code and open data. It is not decentralized yet.

| Part | Today | Where we want to go |
|---|---|---|
| Code | Open, AGPL-3.0 (this repo) | Same |
| Restaurant data | Open, ODbL, in [`data/`](data/) (Google-free, see below) | Contribute facts back to OpenStreetMap |
| Hosting | Vercel (one company) | Static mirror on IPFS, reachable without us |
| Domain | `mesasays.com`, a normal registrar | Keep it, add a name nobody can seize |
| Say posts | Supabase database (one company), we hold the only copy | Each post signed by its author and published on Farcaster; our database becomes a cache |
| Identity | None: you pick a name, nothing proves it is you | Optional signature with an Ethereum key |
| Moderation | One person (the founder) hides spam, no public log | Written rules, public moderation log, more moderators |
| Development | Done in a private repository, exported here (see below) | Developed here, in the open |

The right-hand column is a plan, not a promise. Nothing in it is built yet.
If you know how to do one of these well, we want to hear from you (open an issue).

## How development works (and why it is not fully open yet)

The website is developed in a private repository that also contains things we cannot publish:
the raw restaurant data (part of it was collected from sources like Google, which we are not
allowed to redistribute) and unrelated business tools. A script copies only the website code,
from an explicit list of files, into this repository, and refuses to publish anything that
looks like a secret. So this repository is the real code of mesasays.com, but the day-to-day
history happens elsewhere for now. Moving development here is on the list above.

## Signed notes

Posts and replies on Say can be signed with an Ethereum wallet (Rabby, MetaMask…). It is an
EIP-712 typed-data signature (`eth_signTypedData_v4`): free, no transaction, no gas, tied to no
chain. The signature, not our database, is the proof: each signed note carries the exact JSON
that was signed (domain `MesaSays` v1, type
`Note(kind, place, thread, parent, title, text, author, createdAt)`), and anyone can check it
with viem or ethers `verifyTypedData`. The site checks every signature again each time it shows
a post. A signature proves which address wrote the text, not who the person is; addresses we
know are labelled. Unsigned posts are still welcome and are marked "not signed".
Spec: `lib/say/signature.ts`, tests: `node scripts/test-signed-notes.mjs`.

## The data

`data/` holds the open dataset: restaurants (address, contact, hours, booking, map position)
and **menus with prices** (tens of thousands of dishes). A field is included only if it comes
from the restaurant itself (its website, menu, booking page or own Instagram), from
OpenStreetMap, or from our own check of the official site. Nothing from Google, review sites
or booking platforms. Map positions are computed from the address with OpenStreetMap
Nominatim; each record says how precise its point is. See [data/README.md](data/README.md)
and [DATA_LICENSE.md](DATA_LICENSE.md).

## Run it

```bash
npm install
npm run dev            # first run builds the catalog from data/ (open data, ODbL)
```

- `npm run build`: same step, then checks the catalog, then builds the site.
- `npm run data:open`: rebuild the catalog after editing `data/mesasays-cdmx.json` or `data/dishes.csv`.
- The catalog is generated from `data/` into `restaurant-intelligence/v1/`, which is never committed.
- Say (the conversations) needs a Supabase project of your own: copy `.env.example` to
  `.env.local` and follow the comments. Without it the guide works and Say stays empty.

Compared with mesasays.com, a build from the open data has no curated collections, no
tasting-menu prices, and fewer map pins (only positions OpenStreetMap could confirm).

Stack: Next.js, React, TypeScript, Tailwind. The design system lives in `app/styles/`.

## Honesty

- Restaurants never pay, for anything in the guide.
- We say who we are: MesaSays is made by the team behind The Dining Dispatch, which films
  restaurants. When we write about a place we filmed, we say so.
- Sources are shown on every restaurant page.
- Visual direction inspired by deepstate.sh; all code written independently by MesaSays.

## Licenses

- **Code**: [AGPL-3.0](LICENSE). Anyone can read it, run it, fork it. If you run a modified
  version online, you must publish your changes.
- **Data**: [ODbL 1.0](DATA_LICENSE.md), like OpenStreetMap.
- **Posts**: belong to their authors, shared under CC BY-SA 4.0 (the posting form says so since
  2026-10-31; posts written before that are not relicensed).
- **Fonts**: Space Grotesk and Space Mono, SIL Open Font License 1.1 (see `app/fonts/`).

## Contributing

Issues and pull requests are welcome, in English or Spanish. By contributing code you agree to
license it under AGPL-3.0; by contributing data, under ODbL.
