import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Load the actual pure TS modules without adding a test-runner dependency.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
function load(name) {
  if (!name.startsWith("@/")) return nativeRequire(name);
  const path = resolve(root, `${name.slice(2)}.ts`);
  if (modules.has(path)) return modules.get(path).exports;
  const loaded = { exports: {} };
  modules.set(path, loaded);
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", compiled)(load, loaded, loaded.exports);
  return loaded.exports;
}

const { formatObserved, menuSourceUrl } = load("@/lib/restaurants/format");
const { menuNeedsRecheck } = load("@/lib/restaurants/menu-publication");
const { publishedMenuJsonLd } = load("@/lib/jsonld");
const { applyV1Menu } = load("@/lib/restaurants/from-v1");
const pujol = JSON.parse(readFileSync(resolve(root, "restaurant-intelligence/v1/site-data/restaurants/pujol.json"), "utf8"));
const menu = JSON.parse(readFileSync(resolve(root, "restaurant-intelligence/v1/menus/pujol.json"), "utf8"));
const restaurant = applyV1Menu(pujol, menu);

assert.equal(formatObserved("2026-10-07"), "Oct 07, 2026");
assert.equal(menuSourceUrl([{ sourceUrl: "local://private/menu.pdf" }]), null);
assert.equal(menuNeedsRecheck(restaurant, new Date("2026-10-22T05:59:00Z")), false);
assert.equal(menuNeedsRecheck(restaurant, new Date("2026-10-22T06:01:00Z")), true);
// Make the current-menu assertion independent of the day the suite runs.
restaurant.menu.publication.recheckAfter = "2999-01-01";
const schema = publishedMenuJsonLd(restaurant);
assert.deepEqual(schema.offers.map(offer => offer.price), [3795, 4500]);
assert.ok(schema.hasMenuSection.flatMap(section => section.hasMenuItem).every(item => !item.offers));
restaurant.menu.publication.recheckAfter = "2000-01-01";
assert.equal(publishedMenuJsonLd(restaurant), null, "Overdue menus must not claim current structured offers");
restaurant.menu.publication.recheckAfter = "2999-01-01";
restaurant.menu.publication.coverage = "dishes";
assert.equal(publishedMenuJsonLd(restaurant), null, "Social examples are not a complete current Menu");
console.log("Menu lifecycle, Mexico calendar boundary, local-source filtering and menu-level prices: passed.");

// Menus older than 12 months by their own date are not published; the page keeps its other facts.
{
  const { menuSourceTooOld } = load("@/lib/restaurants/menu-publication");
  const now = new Date("2026-11-04T18:00:00Z");
  assert.equal(menuSourceTooOld("2021-02", now), true);
  assert.equal(menuSourceTooOld("2023-09", now), true);
  assert.equal(menuSourceTooOld("2025-10", now), true);
  assert.equal(menuSourceTooOld("2025-11", now), false);
  assert.equal(menuSourceTooOld("2025", now), false); // a bare year counts from December
  assert.equal(menuSourceTooOld("2024", now), true);
  assert.equal(menuSourceTooOld(undefined, now), false);
  const dated = { ...menu, publication: { ...menu.publication, sourceDate: "2021-02" } };
  const hidden = applyV1Menu(pujol, dated, now);
  assert.equal(hidden.menu.items.length, pujol.menu.items.length);
  assert.equal(hidden.menu.publication, pujol.menu.publication);
  assert.equal(hidden.name, pujol.name);
  const fresh = applyV1Menu(pujol, { ...menu, publication: { ...menu.publication, sourceDate: "2026-04" } }, now);
  assert.equal(fresh.menu.items.length, menu.items.length);
}
console.log("menu age rule ok");
