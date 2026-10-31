import { fromEur, toEur } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import { BUDGETS, type MealCost } from "@/lib/restaurants/meal-cost";
import { cuisineDisplay, cuisineFamily, priceArea } from "@/lib/restaurants/price-index";
import { restaurantBooking, restaurantMealCost } from "@/lib/restaurants/quick-facts";
import type { SiteRestaurant } from "@/lib/restaurants/types";

// "Where to eat for under X pesos": the question as people ask it, answered from
// per-person meal estimates (lib/restaurants/meal-cost.ts). Bands are cumulative.

export const MIN_RESTAURANTS_PER_AREA_PAGE = 5;
export const TOP_BAND = 1500;

export type BudgetBand = { max: number | null; min: number | null };

export type BudgetRow = {
  slug: string;
  name: string;
  area: string | null;
  areaSlug: string | null;
  cuisine: string | null;
  meal: MealCost;
  booking: string | null;
  checkedAt: string | null;
};

export type BudgetIndex = {
  rows: BudgetRow[];
  latestCheck: string | null;
  /** Areas with enough restaurants for their own page, per band key. */
  areasByBand: Record<string, Array<{ area: string; areaSlug: string; count: number }>>;
};

export const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Every band: under 300, 500, 800, 1500, and over 1500. */
export const BANDS: BudgetBand[] = [
  ...BUDGETS.map((max) => ({ max, min: null })),
  { max: null, min: TOP_BAND },
];

export function bandKey(band: BudgetBand, locale: Locale = "en") {
  if (band.max !== null) return locale === "es" ? `menos-de-${band.max}-pesos` : `under-${band.max}-pesos`;
  return locale === "es" ? `mas-de-${band.min}-pesos` : `over-${band.min}-pesos`;
}

export function bandFromKey(key: string): BudgetBand | null {
  return BANDS.find((band) => bandKey(band, "en") === key || bandKey(band, "es") === key) ?? null;
}

export const inBand = (band: BudgetBand, cost: number) =>
  band.max !== null ? cost <= band.max : cost > (band.min ?? 0);

/** The tightest band a meal fits in, used to link a restaurant to its budget page. */
export function bandFor(cost: number): BudgetBand {
  return BANDS.find((band) => band.max !== null && cost <= band.max) ?? BANDS.at(-1)!;
}

export function budgetPath(locale: Locale, band?: BudgetBand, areaSlug?: string | null) {
  const base = locale === "es" ? "/es/presupuesto" : "/budget";
  if (!band) return base;
  return `${base}/${bandKey(band, locale)}${areaSlug ? `/${areaSlug}` : ""}`;
}

export function bandLabel(band: BudgetBand, locale: Locale = "en") {
  const amount = (band.max ?? band.min)!;
  const eur = toEur(amount);
  if (band.max !== null) return locale === "es" ? `Menos de ${amount} MXN (≈ €${eur})` : `Under ${amount} MXN (≈ €${eur})`;
  return locale === "es" ? `Más de ${amount} MXN (≈ €${eur})` : `Over ${amount} MXN (≈ €${eur})`;
}

/** Peso band closest to a euro budget, for "a restaurant for 40 euros". */
export function bandForEuros(eur: number) {
  const mxn = fromEur(eur);
  return BANDS.find((band) => band.max !== null && band.max >= mxn) ?? BANDS.at(-1)!;
}

const readableCuisine = (value: string | null | undefined) => {
  if (!value) return null;
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
};

export function buildBudgetIndex(restaurants: SiteRestaurant[], locale: Locale = "en", now = new Date()): BudgetIndex {
  const rows: BudgetRow[] = [];
  for (const restaurant of restaurants) {
    const meal = restaurantMealCost(restaurant, now);
    if (!meal) continue;
    const area = priceArea(restaurant);
    const booking = restaurantBooking(restaurant);
    rows.push({
      slug: restaurant.slug,
      name: restaurant.name,
      area,
      areaSlug: area ? slugify(area) : null,
      cuisine: cuisineFamily(restaurant, locale) ?? readableCuisine(restaurant.food.cuisine),
      meal,
      booking: booking ? (booking.walkIn ? (locale === "es" ? "Sin reservación" : "Walk-in") : booking.label) : null,
      checkedAt: restaurant.menu.publication?.checkedAt ?? null,
    });
  }
  rows.sort((a, b) => a.meal.estimate - b.meal.estimate || a.name.localeCompare(b.name));

  const areasByBand: BudgetIndex["areasByBand"] = {};
  for (const band of BANDS) {
    const counts = new Map<string, { area: string; areaSlug: string; count: number }>();
    for (const row of rows) {
      if (!row.area || !row.areaSlug || !inBand(band, row.meal.estimate)) continue;
      const entry = counts.get(row.areaSlug) ?? { area: row.area, areaSlug: row.areaSlug, count: 0 };
      entry.count += 1;
      counts.set(row.areaSlug, entry);
    }
    areasByBand[bandKey(band)] = [...counts.values()]
      .filter((entry) => entry.count >= MIN_RESTAURANTS_PER_AREA_PAGE)
      .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
  }

  return {
    rows,
    latestCheck: rows.map((row) => row.checkedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
    areasByBand,
  };
}

export function bandRows(index: BudgetIndex, band: BudgetBand, areaSlug?: string | null) {
  return index.rows
    .filter((row) => inBand(band, row.meal.estimate) && (!areaSlug || row.areaSlug === areaSlug))
    // Closest to the budget first: the best a reader can get for that money.
    .sort((a, b) => b.meal.estimate - a.meal.estimate || a.name.localeCompare(b.name));
}

/** Link from a restaurant page to the budget page of its area (or its band). */
export function restaurantBudgetLink(index: BudgetIndex, slug: string, locale: Locale) {
  const row = index.rows.find((item) => item.slug === slug);
  if (!row) return null;
  const band = bandFor(row.meal.estimate);
  const hasArea = Boolean(row.areaSlug && index.areasByBand[bandKey(band)]?.some((entry) => entry.areaSlug === row.areaSlug));
  const where = hasArea ? row.area! : locale === "es" ? "la Ciudad de México" : "Mexico City";
  const label = band.max !== null
    ? locale === "es" ? `Más restaurantes por menos de ${band.max} MXN en ${where}` : `More places under ${band.max} MXN in ${where}`
    : locale === "es" ? `Más restaurantes de más de ${band.min} MXN en ${where}` : `More places over ${band.min} MXN in ${where}`;
  return { href: budgetPath(locale, band, hasArea ? row.areaSlug : null), label };
}

/** Tile data (name, cuisine, cost per person) for any list of restaurants. */
export function tilesFor(restaurants: SiteRestaurant[], index: BudgetIndex, locale: Locale) {
  const bySlug = new Map(index.rows.map((row) => [row.slug, row]));
  return restaurants.map((restaurant) => ({
    slug: restaurant.slug,
    name: restaurant.name,
    cuisine: cuisineDisplay(restaurant, locale),
    area: priceArea(restaurant),
    price: bySlug.get(restaurant.slug)?.meal.estimate ?? null,
  }));
}
