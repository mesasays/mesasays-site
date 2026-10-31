import type { Locale } from "@/lib/i18n";
import { toIndexRecord } from "@/lib/restaurants/from-v1";
import { buildBudgetIndex, tilesFor, type BudgetIndex } from "@/lib/restaurants/budget";
import { MIN_RESTAURANTS_PER_DISH, summarizeDishes, type DishSummary } from "@/lib/restaurants/dishes";
import { siteDataStore } from "@/lib/data/site-data";
import type { RestaurantListQuery } from "@/lib/restaurants/types";

const store = siteDataStore;

export async function listRestaurantSlugs() {
  return store.listRestaurantSlugs();
}

export async function listIndexableRestaurantSlugs() {
  return store.listIndexableRestaurantSlugs();
}

export async function listRestaurants(query?: RestaurantListQuery) {
  return store.listRestaurants(query);
}

export async function listLaunchRestaurants(limit?: number) {
  return store.listLaunchRestaurants(limit);
}

export async function listRestaurantsBySlugs(slugs: string[]) {
  const rows = await Promise.all(slugs.map((slug) => store.getRestaurantBySlug(slug)));
  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function listLaunchRestaurantRecords(limit?: number) {
  const launch = await listLaunchRestaurants(limit);
  return listRestaurantsBySlugs(launch.map((row) => row.slug));
}

export async function getRestaurantBySlug(slug: string) {
  return store.getRestaurantBySlug(slug);
}

/**
 * Stable pseudo-random order for ties (FNV-1a of both slugs). Alphabetical ties sent every page's
 * links to the same few "A" restaurants; this spreads them across the catalog, same result per build.
 */
function spread(from: string, to: string) {
  let hash = 0x811c9dc5;
  for (const char of `${from}|${to}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Restaurants near a given one (same neighborhood, borough, cuisine), from the memoized catalog. */
async function relatedRecords(slug: string, limit = 6) {
  const records = await listAllRestaurantRecords();
  const current = records.find((record) => record.slug === slug);
  if (!current) return [];
  const { neighborhood, borough } = current.location;
  const cuisine = current.food.cuisine;
  return records
    .filter((record) => record.slug !== slug)
    .map((record) => {
      let score = 0;
      if (neighborhood && record.location.neighborhood === neighborhood) score += 3;
      if (borough && record.location.borough === borough) score += 2;
      if (cuisine && record.food.cuisine === cuisine) score += 1;
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || spread(slug, a.record.slug) - spread(slug, b.record.slug))
    .slice(0, limit)
    .map((entry) => entry.record);
}

export async function listRelated(slug: string, limit?: number) {
  return (await relatedRecords(slug, limit)).map(toIndexRecord);
}

export async function listCollections() {
  return store.listCollections();
}

export async function listCollectionSlugs() {
  return store.listCollectionSlugs();
}

export async function getCollectionBySlug(param: string) {
  return store.getCollectionBySlug(param);
}

// The catalog is read-only within a deployment, so the full record list and the dish
// summaries are computed once per process instead of once per generated page.
let allRecords: ReturnType<typeof loadAllRecords> | null = null;
let dishSummaries: Promise<DishSummary[]> | null = null;

async function loadAllRecords() {
  return listRestaurantsBySlugs(await listRestaurantSlugs());
}

export function listAllRestaurantRecords() {
  allRecords ??= loadAllRecords();
  return allRecords;
}

export function listDishSummaries() {
  dishSummaries ??= listAllRestaurantRecords().then((records) => summarizeDishes(records));
  return dishSummaries;
}

const budgetIndexes = new Map<Locale, Promise<BudgetIndex>>();

export function listBudgetIndex(locale: Locale = "en") {
  if (!budgetIndexes.has(locale)) {
    budgetIndexes.set(locale, listAllRestaurantRecords().then((records) => buildBudgetIndex(records, locale)));
  }
  return budgetIndexes.get(locale)!;
}

/** Public dish pages a restaurant appears on, for internal links from its page. */
export async function dishLinksForRestaurant(slug: string) {
  return (await listDishSummaries())
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH && dish.offers.some((offer) => offer.restaurantSlug === slug))
    .map((dish) => ({ slug: dish.slug, name: dish.name, nameEs: dish.nameEs }));
}

/** Headline numbers for the about and methodology pages. */
export async function catalogCounts() {
  const records = await listAllRestaurantRecords();
  const withMenu = records.filter((record) => record.menu.publication);
  return {
    restaurants: records.length,
    menus: withMenu.length,
    prices: withMenu.reduce((sum, record) => sum + record.menu.items.filter((item) => item.price !== null).length, 0),
    latestCheck: withMenu.map((record) => record.menu.publication!.checkedAt).sort().at(-1) ?? null,
  };
}

/** "Nearby" tiles on a restaurant page: name, cuisine and cost per person of related places. */
export async function nearbyTiles(slug: string, locale: Locale, limit = 6) {
  const [records, index] = await Promise.all([relatedRecords(slug, limit), listBudgetIndex(locale)]);
  return tilesFor(records, index, locale);
}

/** "Same cuisine" tiles: other places serving the same cuisine, not already shown as nearby. */
export async function sameCuisineTiles(slug: string, locale: Locale, limit = 6) {
  const records = await listAllRestaurantRecords();
  const current = records.find((record) => record.slug === slug);
  const cuisine = current?.food.cuisine;
  if (!current || !cuisine) return [];
  const shown = new Set((await relatedRecords(slug)).map((record) => record.slug));
  const borough = current.location.borough;
  const picks = records
    .filter((record) => record.slug !== slug && !shown.has(record.slug) && record.food.cuisine === cuisine)
    .sort((a, b) => {
      const local = Number(b.location.borough === borough) - Number(a.location.borough === borough);
      return local || spread(slug, a.slug) - spread(slug, b.slug);
    })
    .slice(0, limit);
  return tilesFor(picks, await listBudgetIndex(locale), locale);
}
