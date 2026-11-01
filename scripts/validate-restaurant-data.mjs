#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const v1Root = resolve(root, "restaurant-intelligence/v1");
const siteRoot = resolve(v1Root, "site-data");
const fail = (message) => {
  throw new Error(message);
};
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

// Open build (scripts/open-data-to-v1.mjs, public repo): the private hard counts do not apply.
if (existsSync(resolve(v1Root, "OPEN_DATA_BUILD.json"))) {
  validateOpenBuild();
  process.exit(0);
}

function validateOpenBuild() {
  const isDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && !Number.isNaN(Date.parse(date));
  const isWeb = (url) => {
    if (url == null || url === "") return true;
    try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; }
  };
  const googleMaps = /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl/i;
  const registry = readJson(resolve(v1Root, "registry.json"));
  if (!Array.isArray(registry) || !registry.length) fail("Open build: registry is empty");
  const slugs = registry.map((row) => row.slug);
  if (new Set(slugs).size !== slugs.length) fail("Open build: registry has duplicate slugs");
  if (!Array.isArray(readJson(resolve(siteRoot, "collections.json")))) fail("Open build: collections.json must be an array");
  let menus = 0;
  let dishes = 0;
  for (const slug of slugs) {
    if (!/^[a-z0-9-]+$/.test(slug ?? "")) fail(`Open build: invalid slug ${slug}`);
    const enrichedPath = resolve(v1Root, "enriched", `${slug}.json`);
    if (!existsSync(enrichedPath)) fail(`Open build: missing enriched/${slug}.json`);
    const record = readJson(enrichedPath);
    if (record.slug !== slug || !record.name) fail(`Open build: ${slug} has no slug/name`);
    if (record.seo?.indexable === true) fail(`Open build: ${slug} is indexable`);
    const urls = [record.contact?.website, record.reservation?.url, ...(record.sources ?? []).map((source) => source.url)];
    for (const url of urls) {
      if (!isWeb(url)) fail(`Open build: ${slug} has a non-web URL`);
      if (url && googleMaps.test(url)) fail(`Open build: ${slug} has a Google Maps link`);
    }
    const menuPath = resolve(v1Root, "menus", `${slug}.json`);
    if (!existsSync(menuPath)) continue;
    const menu = readJson(menuPath);
    const publication = menu.publication;
    menus += 1;
    if (!publication || !isWeb(menu.url) || !menu.url) fail(`Open build: ${slug} menu lacks a source`);
    if (!isDate(publication.checkedAt) || !isDate(publication.recheckAfter)) fail(`Open build: ${slug} menu dates invalid`);
    if (!Array.isArray(menu.items) || !menu.items.length) fail(`Open build: ${slug} menu has no items`);
    for (const item of menu.items) {
      if (!item.name || !isWeb(item.sourceUrl) || !isDate(item.observedAt)) fail(`Open build: ${slug} dish lacks provenance`);
      if (item.price !== null && (!Number.isFinite(item.price) || item.price <= 0 || item.currency !== "MXN")) fail(`Open build: ${slug} invalid dish price`);
    }
    dishes += menu.items.length;
  }
  console.log(JSON.stringify({ valid: true, mode: "open", restaurants: slugs.length, menus, dishes }, null, 2));
}

const registry = readJson(resolve(v1Root, "registry.json"));
const allowlist = readJson(resolve(v1Root, "allowlist.json"));
const collections = readJson(resolve(siteRoot, "collections.json"));
const siteFiles = readdirSync(resolve(siteRoot, "restaurants"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));
const enrichedFiles = readdirSync(resolve(v1Root, "enriched"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));
const menuFiles = readdirSync(resolve(v1Root, "menus"))
  .filter((file) => file.endsWith(".json") && file !== "_index.json")
  .map((file) => file.replace(/\.json$/, ""));

const slugs = registry.map((row) => row.slug);
const unique = new Set(slugs);
// The catalog grows by verified waves (scripts/import-wave.mjs), so counts are
// checked for consistency rather than pinned to the original 113.
if (unique.size !== slugs.length) fail(`Registry has duplicate slugs (${slugs.length} rows, ${unique.size} unique)`);
if (slugs.length < 113) fail(`Registry shrank below the 113 launch restaurants: ${slugs.length}`);
if (slugs.includes("aguamiel")) fail("Aguamiel must not be in the V1 registry");
if (allowlist.restaurants.length !== 29) {
  fail(`Expected 29 allowlist restaurants, found ${allowlist.restaurants.length}`);
}
if (siteFiles.length !== 29) fail(`Expected 29 site-data restaurant files, found ${siteFiles.length}`);
if (enrichedFiles.length !== slugs.length - 29) fail(`Expected ${slugs.length - 29} enriched files, found ${enrichedFiles.length}`);
if (menuFiles.length !== slugs.length) fail(`Expected ${slugs.length} menu files, found ${menuFiles.length}`);

const allowlistSlugs = allowlist.restaurants.map((row) => row.slug);
for (const slug of allowlistSlugs) {
  if (!unique.has(slug)) fail(`Allowlist slug missing from registry: ${slug}`);
  if (!siteFiles.includes(slug)) fail(`Allowlist slug missing site-data fiche: ${slug}`);
}

const remaining = slugs.filter((slug) => !siteFiles.includes(slug));
if (remaining.length !== slugs.length - 29) fail(`Expected ${slugs.length - 29} registry slugs without site-data, found ${remaining.length}`);
for (const slug of remaining) {
  if (!enrichedFiles.includes(slug)) fail(`Missing enriched file for ${slug}`);
}
for (const slug of slugs) {
  if (!menuFiles.includes(slug)) fail(`Missing menu file for ${slug}`);
  const menu = readJson(resolve(v1Root, "menus", `${slug}.json`));
  const publication = menu.publication;
  if (!publication) continue;
  const isDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") && !Number.isNaN(Date.parse(date));
  const isPublicUrl = (url) => {
    try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; }
  };
  if (!["food_menu", "selection", "dishes"].includes(publication.coverage)) fail(`${slug}: invalid menu coverage`);
  if (!isDate(publication.checkedAt) || !isDate(publication.recheckAfter) || publication.recheckAfter < publication.checkedAt) fail(`${slug}: invalid menu review dates`);
  if (!isPublicUrl(menu.url) || !publication.sourceLabel || !publication.note) fail(`${slug}: missing public menu source or context`);
  if (!["es", "en"].includes(publication.language)) fail(`${slug}: invalid menu language`);
  if (!Array.isArray(menu.items) || !menu.items.length) fail(`${slug}: published menu has no items`);
  for (const item of menu.items) {
    if (!item.name || !isPublicUrl(item.sourceUrl) || !isDate(item.observedAt)) fail(`${slug}: dish lacks provenance`);
    if (item.price !== null && (!Number.isFinite(item.price) || item.price <= 0 || item.currency !== "MXN")) fail(`${slug}: invalid dish price`);
    if (publication.coverage === "dishes" && item.price !== null) fail(`${slug}: social post must not imply a current priced offer`);
  }
  for (const price of publication.pricing ?? []) {
    if (!price.name || !["menu", "supplement"].includes(price.kind) || !Number.isFinite(price.price) || price.price <= 0 || price.currency !== "MXN") fail(`${slug}: invalid menu-level price`);
  }
}

// External links reach the pages as <a href>: only web URLs (or null) are allowed in the data.
const isWebUrl = (url) => {
  if (url == null || url === "") return true;
  try { return ["http:", "https:"].includes(new URL(url).protocol); } catch { return false; }
};
const checkLinks = (slug, record) => {
  const urls = [
    ["contact.website", record.contact?.website],
    ["contact.googleMapsUrl", record.contact?.googleMapsUrl],
    ["reservation.url", record.reservation?.url],
    ["reservation.openTableUrl", record.reservation?.openTableUrl],
    ...(record.reservation?.links ?? []).map((link, i) => [`reservation.links[${i}].url`, link?.url]),
    ...(record.links ?? []).map((link, i) => [`links[${i}].url`, link?.url]),
    ...(record.sources ?? []).map((source, i) => [`sources[${i}].url`, source?.url]),
  ];
  for (const [field, url] of urls) if (!isWebUrl(url)) fail(`${slug}: ${field} is not a web URL (${String(url).slice(0, 40)})`);
};
for (const file of readdirSync(resolve(v1Root, "verified")).filter((name) => name.endsWith(".json"))) {
  checkLinks(`verified/${file}`, readJson(resolve(v1Root, "verified", file)));
}
const walkSocial = (value, path) => {
  if (typeof value === "string") {
    if (/(^|\.)(url|website|booking|link)$/i.test(path) && !isWebUrl(value)) fail(`social.json ${path} is not a web URL`);
  } else if (Array.isArray(value)) value.forEach((entry, i) => walkSocial(entry, `${path}[${i}]`));
  else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) walkSocial(entry, path ? `${path}.${key}` : key);
};
walkSocial(readJson(resolve(v1Root, "social.json")), "");

let indexable = 0;
for (const slug of siteFiles) {
  const record = readJson(resolve(siteRoot, "restaurants", `${slug}.json`));
  checkLinks(slug, record);
  if (record.seo?.indexable === true) {
    indexable += 1;
    fail(`${slug} became indexable`);
  }
}
for (const slug of remaining) {
  const record = readJson(resolve(v1Root, "enriched", `${slug}.json`));
  checkLinks(slug, record);
  if (record.seo?.indexable === true) {
    indexable += 1;
    fail(`${slug} enriched record is indexable`);
  }
  if (record.editorial?.review) fail(`${slug} has invented editorial review`);
}

for (const slug of ["quintonil", "pujol"]) {
  const record = readJson(resolve(siteRoot, "restaurants", `${slug}.json`));
  if (record.slug !== slug) fail(`Failed to load ${slug}`);
  if (record.editorial?.status === "reviewed") fail(`${slug} editorial unexpectedly reviewed`);
  if (
    record.editorial?.bestFor?.length ||
    record.editorial?.avoidFor?.length ||
    record.editorial?.ambience ||
    record.editorial?.idealMoment ||
    record.editorial?.review ||
    record.seo?.faq?.length
  ) {
    fail(`${slug} has subjective editorial content`);
  }
  if (record.reservation?.difficulty != null) {
    fail(`${slug} has a fabricated reservation difficulty`);
  }
}

const collectionParams = collections.map((row) => `${row.type}--${row.slug}`);
if (new Set(collectionParams).size !== collections.length) {
  fail("Collection type+slug keys must be unique");
}

const runtime = readFileSync(resolve(root, "lib/data/index.ts"), "utf8");
if (runtime.includes("fixtureStore") || runtime.includes("supabaseStore")) {
  fail("Runtime data index must not select fixtureStore or supabaseStore");
}
const paths = readFileSync(resolve(root, "lib/restaurants/paths.ts"), "utf8");
if (paths.includes('"site-data"') && !paths.includes("v1")) {
  fail("SITE_DATA_ROOT must point at restaurant-intelligence/v1");
}
if (paths.includes("restaurant-intelligence\",\n  \"site-data\"")) {
  fail("Loader still points at the WIP 876 site-data directory");
}

console.log(
  JSON.stringify(
    {
      valid: true,
      uniqueSlugs: unique.size,
      siteDataFiches: siteFiles.length,
      enrichedFiches: remaining.length,
      menus: menuFiles.length,
      indexableRestaurants: indexable,
      collections: collections.length,
      requiredRoutes: ["pujol", "quintonil", "nicos", "baldio", "sarde"],
      excluded: ["aguamiel"],
    },
    null,
    2,
  ),
);
