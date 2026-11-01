# MesaSays

**The Mexico City food guide written by the people who eat and the people who cook.**
It tells the truth about restaurants and wants them to do well. No restaurant pays to be in it.

Live: https://mesasays.com · Films: [The Dining Dispatch](https://www.youtube.com/@TheDiningDispatch)

*Español: la guía de comida de la Ciudad de México, escrita por quienes comen y quienes cocinan.*

## What this is

- A restaurant guide for Mexico City: places, menus with prices, what to order, what to skip.
- **Say**: open conversations about restaurants. No account, no stars, no scores.
- No tracking: no analytics, no cookies, no request to Google when you load a page.

## Why it is open source

A community guide must not be something one company can buy, close or quietly change.
Food communities have died that way before (Chowhound, 1997–2022). So:

- **Code**: [AGPL-3.0](LICENSE). Anyone can read it, run it, fork it. If you run a modified
  version online, you must publish your changes.
- **Data**: [ODbL](DATA_LICENSE.md), like OpenStreetMap (release in progress).
- **Posts**: belong to their authors, CC BY-SA 4.0.

Where we are going: each Say signed by its author's Ethereum key and published on Farcaster,
readable from any Farcaster app; restaurant facts contributed back to OpenStreetMap.

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev
```

The site reads its catalog from `restaurant-intelligence/v1/` (not included yet, see
[DATA_LICENSE.md](DATA_LICENSE.md)). The design system lives in `app/styles/`: `tokens.css` (colours, type, spacing) and `mesa.css` (base, layout, components).
Stack: Next.js, React, TypeScript, Tailwind.

## Honesty

- Restaurants never pay, for anything in the guide.
- We say who we are: MesaSays is made by the team behind The Dining Dispatch, which films
  restaurants. When we write about a place we filmed, we say so.
- Sources are shown on every restaurant page, including the ones we are replacing.

## Fonts

Space Grotesk and Space Mono, SIL Open Font License 1.1 (see `app/fonts/`).

## Contributing

Issues and pull requests are welcome. By contributing code you agree to license it under AGPL-3.0.
