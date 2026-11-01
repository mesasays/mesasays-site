#!/usr/bin/env node
// Build restaurant-intelligence/v1/ from the open MesaSays dataset (ODbL), so the site runs
// without the private catalog.
//
//   node scripts/open-data-to-v1.mjs               build (or rebuild) the open v1 folder
//   node scripts/open-data-to-v1.mjs --if-missing  do nothing when v1/registry.json already exists
//   node scripts/open-data-to-v1.mjs --data <dir>  read the open files from <dir> (default: data/)
//
// Inputs (data/): mesasays-cdmx.json, dishes.csv, optionally films.json (our own documentaries).
// Output: only what the open files contain. No ratings, review counts, distinctions, editorial
// text, photos or Google links: those fields stay empty and the pages show less.
//
// Safety: a v1 folder that this script did not write (the private catalog) is never touched.
// The script only replaces a v1 folder carrying its own marker file (OPEN_DATA_BUILD.json).
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V1 = join(ROOT, "restaurant-intelligence", "v1");
const MARKER = "OPEN_DATA_BUILD.json";

const args = process.argv.slice(2);
const ifMissing = args.includes("--if-missing");
const dataArg = args.indexOf("--data");
const DATA = dataArg >= 0 ? resolve(args[dataArg + 1] ?? "") : join(ROOT, "data");

const die = (message) => {
  console.error(`open-data-to-v1: ${message}`);
  process.exit(1);
};

// --- Never overwrite the private catalog -------------------------------------------------
const hasMarker = existsSync(join(V1, MARKER));
const hasRegistry = existsSync(join(V1, "registry.json"));
if (existsSync(V1) && !hasMarker) {
  const empty = readdirSync(V1).length === 0;
  if (!empty) {
    if (ifMissing && hasRegistry) {
      console.log("open-data-to-v1: restaurant-intelligence/v1 already holds a catalog (not an open build): left untouched.");
      process.exit(0);
    }
    die(`${V1} exists and was not written by this script. Refusing to touch it.`);
  }
}
if (ifMissing && hasRegistry) {
  console.log("open-data-to-v1: open catalog already built (run `npm run data:open` to rebuild).");
  process.exit(0);
}

// --- Inputs --------------------------------------------------------------------------------
const jsonPath = join(DATA, "mesasays-cdmx.json");
const csvPath = join(DATA, "dishes.csv");
for (const path of [jsonPath, csvPath]) {
  if (!existsSync(path)) die(`missing ${path}. The open dataset (data/mesasays-cdmx.json + data/dishes.csv) is required.`);
}
const open = JSON.parse(readFileSync(jsonPath, "utf8"));
if (!Array.isArray(open?.restaurants)) die(`${jsonPath} has no restaurants array`);

/** RFC 4180 CSV (quoted fields, doubled quotes, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== "");
  return body.map((r) => Object.fromEntries(header.map((key, i) => [key.replace(/^﻿/, ""), r[i] ?? ""])));
}

// --- Helpers -------------------------------------------------------------------------------
const GOOGLE_MAPS = /(^|\.)google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/|maps\.app\.goo\.gl/i;
/** Web URL or null. Map links from Google never enter the open build. */
function webUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (GOOGLE_MAPS.test(`${url.hostname}${url.pathname}`)) return null;
    return url.href;
  } catch {
    return null;
  }
}
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const json = (value) => JSON.stringify(value, null, 2) + "\n";

// Field-level source lists ({ field: [url | "MesaSays verification 2026-10-18" | "openstreetmap"] })
// become the record's source links; plain-text entries only name the source.
function sourcesOf(record) {
  const out = [];
  const seen = new Set();
  const push = (source, url) => {
    const key = `${source}|${url ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url ? { source, url } : { source });
  };
  for (const field of Object.keys(record.sources ?? {}).sort()) {
    for (const entry of record.sources[field] ?? []) {
      if (typeof entry !== "string") continue;
      const url = webUrl(entry);
      if (url) push(field, url);
      else if (/^mesasays verification/i.test(entry)) push("mesasays_verification");
      else if (/openstreetmap/i.test(entry)) push("openstreetmap");
    }
  }
  const menuUrl = webUrl(record.menu?.sourceUrl);
  if (menuUrl) push("menu", menuUrl);
  if (typeof record.osm === "string" && /^(node|way|relation)\/\d+$/.test(record.osm)) {
    push("openstreetmap", `https://www.openstreetmap.org/${record.osm}`);
  }
  return out;
}

function coordinatesOf(record) {
  const { latitude, longitude } = record.coordinates ?? {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // Mexico City metro area only: a stray geocode must not put a pin in another country.
  if (latitude < 18.9 || latitude > 20.1 || longitude < -99.7 || longitude > -98.6) return null;
  return { latitude, longitude };
}

// --- Build ---------------------------------------------------------------------------------
const dishes = parseCsv(readFileSync(csvPath, "utf8"));
const dishesBySlug = new Map();
for (const dish of dishes) {
  const name = text(dish.name);
  if (!dish.restaurant || !name) continue;
  const price = dish.price === "" ? null : Number(dish.price);
  const currency = text(dish.currency) ?? "MXN";
  const list = dishesBySlug.get(dish.restaurant) ?? [];
  list.push({
    name,
    price: Number.isFinite(price) && price > 0 && currency === "MXN" ? price : null,
    currency: "MXN",
    category: text(dish.category),
  });
  dishesBySlug.set(dish.restaurant, list);
}

const registry = [];
const enriched = new Map();
const menus = new Map();
const skipped = [];
const seenSlugs = new Set();

for (const record of open.restaurants) {
  const slug = record?.slug;
  const name = text(record?.name);
  if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug) || !name) {
    skipped.push(String(slug));
    continue;
  }
  if (seenSlugs.has(slug)) die(`duplicate slug in open data: ${slug}`);
  seenSlugs.add(slug);

  const checkedAt = isDate(record.checkedAt) ? record.checkedAt : isDate(record.menu?.observedAt) ? record.menu.observedAt : null;
  const reservation = record.reservation && text(record.reservation.platform)
    ? {
        platform: text(record.reservation.platform),
        url: webUrl(record.reservation.url),
        phone: text(record.reservation.phone),
        notes: null,
      }
    : null;

  registry.push({ name, status: "on_site", slug, stage: null, action: null, v1State: "open_data" });
  enriched.set(slug, {
    slug,
    name,
    location: {
      address: text(record.address),
      neighborhood: text(record.neighbourhood),
      borough: text(record.borough),
      postalCode: text(record.postcode),
      coordinates: coordinatesOf(record),
    },
    contact: {
      phone: text(record.phone),
      website: webUrl(record.website),
      instagram: text(record.instagram),
    },
    hours: Array.isArray(record.hours) ? record.hours.filter((row) => typeof row === "string" && row.trim()) : [],
    food: { cuisine: text(record.cuisine), priceLevel: null },
    reservation,
    sources: sourcesOf(record),
    schemaVersion: "tdd.v1.enriched",
    enrichedAt: checkedAt,
    editorial: { status: "not_reviewed" },
    seo: { indexable: false },
  });

  const menuUrl = webUrl(record.menu?.sourceUrl);
  const observedAt = isDate(record.menu?.observedAt) ? record.menu.observedAt : null;
  const items = dishesBySlug.get(slug) ?? [];
  if (menuUrl && observedAt && items.length) {
    menus.set(slug, {
      slug,
      name,
      url: menuUrl,
      status: "source_reviewed",
      observedAt,
      publication: {
        coverage: "selection",
        sourceLabel: "Restaurant's own menu",
        checkedAt: observedAt,
        recheckAfter: addDays(observedAt, 30),
        language: "es",
        note: "Dishes and prices read from the restaurant's own menu (MesaSays open data, ODbL); prices in MXN, may change.",
      },
      items: items.map((item) => ({ ...item, sourceUrl: menuUrl, observedAt })),
    });
  }
}
if (!registry.length) die("the open dataset produced no restaurant");

// Our own documentaries (data/films.json): kept only for restaurants in the open build,
// and only the fields we own.
let films = [];
const filmsPath = join(DATA, "films.json");
if (existsSync(filmsPath)) {
  films = JSON.parse(readFileSync(filmsPath, "utf8"))
    .filter((film) => seenSlugs.has(film.restaurantSlug) && /^[A-Za-z0-9_-]{6,20}$/.test(film.videoId ?? ""))
    .map(({ videoId, restaurantSlug, title, publishedAt, durationSeconds, summary }) => ({
      videoId, restaurantSlug, title, publishedAt, durationSeconds, summary,
    }));
}

// --- Write (to a temp folder, then swap) ---------------------------------------------------
const TMP = `${V1}.open-tmp`;
rmSync(TMP, { recursive: true, force: true });
for (const dir of ["enriched", "menus", "verified", "site-data/restaurants"]) mkdirSync(join(TMP, dir), { recursive: true });

writeFileSync(join(TMP, "registry.json"), json(registry));
for (const [slug, record] of enriched) writeFileSync(join(TMP, "enriched", `${slug}.json`), json(record));
for (const [slug, menu] of menus) writeFileSync(join(TMP, "menus", `${slug}.json`), json(menu));
writeFileSync(join(TMP, "site-data", "collections.json"), json([])); // neighbourhood/borough/cuisine collections are derived at runtime
writeFileSync(join(TMP, "social.json"), json({}));
writeFileSync(join(TMP, "geo-corrections.json"), json({}));
writeFileSync(join(TMP, "films.json"), json(films));
const summary = {
  mode: "open",
  dataset: open.meta?.name ?? null,
  version: open.meta?.version ?? null,
  license: open.meta?.license ?? "ODbL-1.0",
  attribution: open.meta?.attribution ?? null,
  restaurants: registry.length,
  menus: menus.size,
  dishes: [...menus.values()].reduce((sum, menu) => sum + menu.items.length, 0),
  withCoordinates: [...enriched.values()].filter((record) => record.location.coordinates).length,
  films: films.length,
  skipped,
};
writeFileSync(join(TMP, MARKER), json(summary));

rmSync(V1, { recursive: true, force: true }); // only reached when V1 is absent, empty or an open build
mkdirSync(dirname(V1), { recursive: true });
renameSync(TMP, V1);
console.log(`open-data-to-v1: wrote ${V1}\n${JSON.stringify(summary)}`);
