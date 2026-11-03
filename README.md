# MesaSays

**The restaurant guide written by the people who eat and the people who cook.**
It tells the truth about restaurants and wants them to do well. No restaurant pays to be in it.
It starts in Mexico City.

Live: https://mesasays.com · Farcaster: [@mesasays](https://farcaster.xyz/mesasays) (fid 3357281)
· Films: [The Dining Dispatch](https://www.youtube.com/@TheDiningDispatch)

*Español: la guía de restaurantes escrita por quienes comen y quienes cocinan. Empieza en la Ciudad de México.*

## Where we want to go

Restaurants do one of the most beautiful jobs there is, and the tools around them take a cut of
everything: around 4% of every card payment, 25–30% of every delivery order, per-cover booking
fees, review sites that sell visibility, platforms that keep the guest list. MesaSays wants to be
the opposite, and to be **unable** to become that later.

Soon, most tables will not be booked by people scrolling reviews but by **AI agents** booking for
them, and paying on their own (stablecoins, [x402](https://www.x402.org/)). Agents have no brand
loyalty: they go where the data is true and the door is open. And the more agents decide, the more
it pays to fake reviews. So MesaSays wants to be **the source of truth about restaurants that any
person or agent can read, check and book from**, with no one in the middle taking a cut.

1. **A map of the world's restaurants, built city by city.** Anyone can open a city and do there
   what we did for Mexico City: list the restaurants, their menus and prices, checked at the source.
2. **Signed visits.** A code at the table, signed by the restaurant and scanned by the guest, proves
   "I was there". It creates a public attestation that no platform owns.
3. **Real reviews, tied to real visits.** People who ate there say what to order and what to skip,
   signed by their author. A review linked to a signed visit can't be bought or faked, by a person
   or by a bot.
4. **Booking without a middleman, built for people and agents.** An open, signed format for a
   restaurant's availability, so any app or agent can book a table directly. Against no-shows (and
   agents booking four tables to keep one), a small automatic deposit, returned at check-in. Every
   honored visit builds a portable reliability record: reliable guests stop being asked for a
   deposit, everywhere on the network.
5. **Rules nobody can quietly change.** Open code, open data, posts that belong to their authors,
   and an open network underneath, so that if MesaSays ever betrayed this, everyone could leave
   with everything.

What exists today is step 1 for one city, and the start of step 3. The rest is the plan, starting
with making the guide readable by AI assistants (an MCP server) and publishing the open booking
format for comments.

## Who pays (never the restaurant)

The raw data stays open and free (ODbL). What can be paid for is what costs work: fresh, verified
answers and bookings, paid **by the apps and agents that use them**, in cents per request or per
booking, never by the restaurant and never as a commission on the bill. That money should go to
the people who build and keep the network alive: developers of the open tools, the people who keep
a city up to date, those who verify. How exactly is an open question, and will be decided in the
open. There is still **no token**: if one ever exists, it will come after real use, and pay for work,
never for the number of posts.

## What works today

- **The guide** for Mexico City: restaurants, official menus with prices, what a meal costs,
  dishes compared across places, films of the kitchens we visited.
- **Say**: conversations about restaurants, on every restaurant page, **on Farcaster** (an open
  social protocol, readable in any Farcaster app such as Firefly):
  - Already on Farcaster? Reply from your app to any MesaSays conversation.
  - Not on Farcaster? Write on mesasays.com and sign with **Face ID / a passkey** (no account, no
    seed phrase) or an Ethereum wallet. The MesaSays account publishes it for you, with your
    signature attached, so anyone can check the text is yours and was not changed by us.
  - Every message the site shows is re-checked (its hash and signature) and must belong to a
    MesaSays topic. Details: [`docs/SAY_FARCASTER.md`](docs/SAY_FARCASTER.md).
- No tracking: no analytics, no cookies, no request to Google when you load a page.
- **No token.** There is no coin, no airdrop, no points program.

## Status: what is open, and what is still centralized

| Part | Today | Next |
|---|---|---|
| Code | Open, AGPL-3.0 (this repo) | Develop here in the open, not in a private repo |
| Restaurant data | Open, ODbL, in [`data/`](data/) (Google-free) | Contribute facts back to OpenStreetMap; let others open cities |
| Conversations (Say) | On Farcaster, signed by their authors; read from a public hub | Run our own hub in the EU as a second source |
| Hosting | Vercel (one company) | Static copy on IPFS behind `mesasays.eth`, reachable without us |
| Moderation | One person; a MesaSays relay refuses unsigned posts | Written rules, a public moderation log, more moderators |
| Booking | Each page shows the restaurant's own channel (phone, WhatsApp, its site) | An open availability format, signed visits, and a free booking module that people and agents can use |

## How development works

The site is developed in a private repository that also holds things we may not publish (raw data
partly collected from sources like Google, and unrelated business tools). A script copies only the
website code, from an explicit list of files, into this repository, and refuses anything that looks
like a secret. This repository is the real code of mesasays.com; moving day-to-day development here
is on the list.

## Signatures

- **Wallet**: EIP-712 typed data (`eth_signTypedData_v4`), free, no transaction, tied to no chain.
  Domain `MesaSays` v1, type `Note(kind, place, thread, parent, title, text, author, createdAt)`.
- **Passkey**: a WebAuthn P-256 signature over the same note's EIP-712 digest.
- **Farcaster**: every cast is Ed25519-signed by its account's app key; we rebuild its bytes and
  re-check hash and signature before showing it.
- Check a relayed note yourself: `node scripts/verify-cast.mjs <fid>-<hash>`, or the `/proof` page.

## The data

`data/` holds the open dataset: restaurants (address, contact, hours, booking, map position) and
**menus with prices**. A field is included only if it comes from the restaurant itself (its website,
menu, booking page or own Instagram), from OpenStreetMap, or from our own check of the official
site. Nothing from Google, review sites or booking platforms. See [data/README.md](data/README.md)
and [DATA_LICENSE.md](DATA_LICENSE.md).

## Run it

```bash
npm install
npm run dev            # first run builds the catalog from data/ (open data, ODbL)
```

- `npm run build`: same step, then checks the catalog, then builds the site.
- `npm run data:open`: rebuild the catalog after editing `data/mesasays-cdmx.json` or `data/dishes.csv`.
- Say: set `SAY_BACKEND=farcaster` to read conversations from Farcaster (no key needed to read).
  Publishing needs a Farcaster account and app key of your own: see `docs/SAY_FARCASTER.md`.
- Tests: `node scripts/test-say-farcaster.mjs` and `node scripts/test-signed-notes.mjs`.

Stack: Next.js, React, TypeScript. The design system lives in `app/styles/`.

## Honesty

- Restaurants never pay, for anything in the guide.
- We say who we are: MesaSays was started by the team behind The Dining Dispatch, which films
  restaurants. When we write about a place we filmed, we say so.
- Sources are shown on every restaurant page.
- Visual direction inspired by deepstate.sh; all code written independently by MesaSays.

## Licenses

- **Code**: [AGPL-3.0](LICENSE). If you run a modified version online, publish your changes.
- **Data**: [ODbL 1.0](DATA_LICENSE.md), like OpenStreetMap.
- **Posts**: belong to their authors, shared under CC BY-SA 4.0.
- **Fonts**: Space Grotesk and Space Mono, SIL Open Font License 1.1.

## Contributing

Issues and pull requests are welcome, in English or Spanish. Want to open your city, or build an
open tool for restaurants? Open an issue and say hello.
By contributing code you agree to license it under AGPL-3.0; by contributing data, under ODbL.
