# MesaSays open data · Mexico City restaurants

Restaurants of Mexico City with their address, contact, hours, booking and **menus with prices**,
collected by MesaSays (mesasays.com). Free to use under the **ODbL 1.0** ([LICENSE-ODbL.txt](LICENSE-ODbL.txt)).

## Files
- `mesasays-cdmx.json`: everything, one record per restaurant, with the sources of every field.
- `mesasays-cdmx.geojson`: the restaurants as points, ready for a map (QGIS, uMap, MapLibre…).
- `restaurants.csv`: one line per restaurant (opens in any spreadsheet).
- `dishes.csv`: one line per dish: restaurant, dish, price, currency, category.
- `report.json`: what was kept and what was left out, field by field.

## The rule
A piece of information is in this file only if we got it from **the restaurant itself** (its website,
its menu, its booking page, its own Instagram), from **OpenStreetMap**, or from **our own check of the
official site**. Nothing comes from Google, review sites, directories or booking platforms.
Map positions are computed from the address with OpenStreetMap Nominatim.

Prices change. Each record says when it was checked (`checkedAt`, `menu.observedAt`).

## Credit
"© MesaSays contributors (mesasays.com), ODbL. Map positions © OpenStreetMap contributors."
If you improve the data and share it, share it under the same license.

## Spotted a mistake?
Tell us on mesasays.com/say or open an issue on github.com/mesasays/mesasays-site.
