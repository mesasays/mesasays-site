# MesaSays

**The unbiased restaurant guide to Mexico City.**
Real menus with real prices, copied from each restaurant's own menu and dated, plus address,
hours and how to book, in one place. No restaurant pays to be here, and there is no commission.

Live: https://mesasays.com · Films: [The Dining Dispatch](https://www.youtube.com/@TheDiningDispatch)

*Español: la guía de restaurantes imparcial de la Ciudad de México. Cartas reales, precios reales,
horarios y cómo reservar. Ningún restaurante paga por estar aquí.*

## What it does

- **Menus first.** For each restaurant, the dishes and prices as printed on its own menu (website,
  PDF or official ordering page), each with its section, source and date, re-checked every 30 days.
  Never delivery apps, review sites or third-party databases.
- **What a meal costs.** A cost per person computed from the menu itself (starter + main, three
  tacos, or the cheapest set menu), only when the menu prints enough prices.
- **One place.** Address, hours and how to book (phone, WhatsApp, the restaurant's own booking link
  or walk-in), from the restaurant's own sources.
- **Dishes and prices compared** across restaurants, by neighbourhood and cuisine.
- **Films** of the kitchens we visited, by The Dining Dispatch.
- No tracking: no analytics, no cookies, no request to Google when you load a page.

**Coming soon:** an MCP server, so ChatGPT and Claude can answer "where can I eat X, for how much,
and how do I book" from the same checked facts.

## Fair, by design

- Restaurants never pay, for anything in the guide. No ads, no sponsored placement, no commission.
- We say who we are: MesaSays is made by the team behind The Dining Dispatch, which films
  restaurants. When we write about a place we filmed, we say so.
- Sources and dates are shown on every restaurant page. Corrections: open an issue.

## How development works

The site is developed in a private repository that also holds the restaurant catalog and unrelated
business tools. A script copies only the website code, from an explicit list of files, into this
repository, and refuses anything that looks like a secret. This repository is the real code of
mesasays.com.

The restaurant data is not published here. `scripts/open-data-to-v1.mjs` can still build a
catalog from your own files in its format (`data/mesasays-cdmx.json` and `data/dishes.csv`).

## Run it

```bash
npm install
npm run data:open      # only if you have your own data/ files in the open format
npm run dev
```

Stack: Next.js, React, TypeScript. The design system lives in `app/styles/`.
Say (conversations about restaurants) is paused; its code stays here, dormant.

## Licenses

- **Code**: [AGPL-3.0](LICENSE). If you run a modified version online, publish your changes.
- **Fonts**: Space Grotesk and Space Mono, SIL Open Font License 1.1.
- Visual direction inspired by deepstate.sh; all code written independently by MesaSays.

## Contributing

Issues and pull requests are welcome, in English or Spanish. By contributing code you agree to
license it under AGPL-3.0.
