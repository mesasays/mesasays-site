import { listAllRestaurantRecords, listBudgetIndex, listDishSummaries } from "@/lib/data";
import type { Locale } from "@/lib/i18n";
import { BANDS, bandKey, bandRows, budgetPath } from "@/lib/restaurants/budget";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { priceArea } from "@/lib/restaurants/price-index";

/** Compact data for the home finder (components/HomeFinder.tsx), computed at build time. */
export async function finderProps(locale: Locale) {
  const [index, summaries, records] = await Promise.all([listBudgetIndex(locale), listDishSummaries(), listAllRestaurantRecords()]);
  const bands = BANDS.map((band) => ({
    key: bandKey(band),
    label: band.max !== null ? `< ${band.max}` : `${band.min}+`,
    // Spoken form of the short label, for assistive technology.
    name:
      band.max !== null
        ? locale === "es" ? `Menos de ${band.max} pesos` : `Under ${band.max} pesos`
        : locale === "es" ? `Más de ${band.min} pesos` : `Over ${band.min} pesos`,
    href: budgetPath(locale, band),
    count: bandRows(index, band).length,
    areas: (index.areasByBand[bandKey(band)] ?? []).map((entry) => ({
      area: entry.area,
      href: budgetPath(locale, band, entry.areaSlug),
      count: entry.count,
    })),
  }));
  const dishes = summaries
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
    .sort((a, b) => b.restaurants - a.restaurants)
    .map((dish) => ({ slug: dish.slug, name: locale === "es" ? dish.nameEs : dish.name, restaurants: dish.restaurants, from: dish.minPrice }));
  const places = records
    .map((record) => ({ slug: record.slug, name: record.name, area: priceArea(record) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { bands, dishes, places };
}
