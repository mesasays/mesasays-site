import {
  groupPriceStats,
  restaurantPriceStats,
  tastingMenuPrices,
  type GroupPriceStats,
  type PriceStats,
} from "@/lib/restaurants/stats";
import type { SiteRestaurant } from "@/lib/restaurants/types";

// The Mesasays price index: official-menu prices aggregated by area and cuisine.

const AREA_RULES: Array<[RegExp, string]> = [
  [/^polanco/i, "Polanco"],
  [/^lomas de chapultepec/i, "Lomas de Chapultepec"],
  [/^hip[oó]dromo|^condesa/i, "Condesa"],
  [/^roma n/i, "Roma Norte"],
  [/^roma s/i, "Roma Sur"],
  [/^ju[aá]rez/i, "Juárez"],
  [/^(centro|centro hist)/i, "Centro"],
  [/^del valle/i, "Del Valle"],
  [/^n[aá]poles|^ampliaci[oó]n n[aá]poles/i, "Nápoles"],
  [/^san [aá]ngel/i, "San Ángel"],
  [/coyoac[aá]n/i, "Coyoacán"],
  [/^santa fe/i, "Santa Fe"],
];

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => `${sep}${letter.toUpperCase()}`)
    .replace(/(?!^)\b(De|Del|La|Las|Los|Y)\b/g, (word) => word.toLowerCase());
}

// Free-text cuisines (from many sources) folded into families readers recognise.
const CUISINE_FAMILIES: Array<[RegExp, string, string]> = [
  // Checked first: a vegetarian grill or vegan taquería is read as vegetarian.
  [/vegan|vegetar|plant/i, "Vegetarian & vegan", "Vegetariana y vegana"],
  [/sushi|japan|japon|ramen|izakaya|nikkei/i, "Japanese", "Japonesa"],
  [/pizza/i, "Pizza", "Pizza"],
  [/ital/i, "Italian", "Italiana"],
  [/seafood|mariscos|marisquer|fish|pescado|oyster|ostion|ceviche/i, "Seafood", "Mariscos"],
  [/spanish|españ|espan|tapas|vasc|gallega|asturian/i, "Spanish", "Española"],
  [/argentin|uruguay|steak|grill|parrilla|asado|brasa|churrasc|carne|beef|corte/i, "Grill & steakhouse", "Parrilla y cortes"],
  [/french|franc|bistro/i, "French & bistro", "Francesa y bistró"],
  [/\bchin(a|o|ese)\b|cantones|cantonese|thai|tailand|vietnam|korea|corea|asian|asiát|india|hindu|leban|liban|arab|mediterr|griega|greek/i, "Asian & Middle Eastern", "Asiática y de Medio Oriente"],
  [/burger|hamburg|american|bbq|barbecue|wings|alitas/i, "Burgers & American", "Hamburguesas y americana"],
  [/taco|taquer|antojito|torta|pozole|birria|barbacoa/i, "Tacos & antojitos", "Tacos y antojitos"],
  [/mexic|oaxac|yucat|veracruz|fonda|cocina de casa|regional|cantina/i, "Mexican", "Mexicana"],
  [/brunch|breakfast|desayun|caf[eé]|bakery|panader/i, "Breakfast & café", "Desayunos y café"],
];

export function cuisineFamily(restaurant: SiteRestaurant, locale: "en" | "es" = "en") {
  const text = `${restaurant.food.cuisine ?? ""} ${restaurant.food.michelinCuisine ?? ""}`;
  for (const [pattern, en, es] of CUISINE_FAMILIES) if (pattern.test(text)) return locale === "es" ? es : en;
  return null;
}

export function priceArea(restaurant: SiteRestaurant) {
  const raw = (restaurant.location.neighborhood ?? "").trim();
  if (!raw) return null;
  for (const [pattern, label] of AREA_RULES) if (pattern.test(raw)) return label;
  return titleCase(raw.replace(/\s+(i{1,3}|iv|v|vi)\s+secci[oó]n$/i, ""));
}

export type PriceRow = { label: string; href?: string; stats: GroupPriceStats };
export type RestaurantPriceRow = {
  slug: string;
  name: string;
  area: string | null;
  stats: PriceStats;
};

export type PriceIndex = {
  restaurantsWithPrices: number;
  pricedDishes: number;
  latestCheck: string | null;
  city: GroupPriceStats | null;
  byArea: PriceRow[];
  byCuisine: PriceRow[];
  setMenus: Array<{ slug: string; name: string; menu: string; price: number }>;
  restaurants: RestaurantPriceRow[];
};

export function buildPriceIndex(
  restaurants: SiteRestaurant[],
  locale: "en" | "es" = "en",
  now = new Date(),
): PriceIndex {
  const rows: RestaurantPriceRow[] = [];
  for (const restaurant of restaurants) {
    const stats = restaurantPriceStats(restaurant, now);
    if (stats) rows.push({ slug: restaurant.slug, name: restaurant.name, area: priceArea(restaurant), stats });
  }

  const byAreaMap = new Map<string, SiteRestaurant[]>();
  for (const restaurant of restaurants) {
    const area = priceArea(restaurant);
    if (!area) continue;
    byAreaMap.set(area, [...(byAreaMap.get(area) ?? []), restaurant]);
  }
  const byArea = [...byAreaMap.entries()]
    .map(([label, group]) => ({ label, stats: groupPriceStats(group, now) }))
    .filter((row): row is PriceRow => Boolean(row.stats))
    .sort((a, b) => b.stats.medianOfMedians - a.stats.medianOfMedians);

  const byFamilyMap = new Map<string, SiteRestaurant[]>();
  for (const restaurant of restaurants) {
    const family = cuisineFamily(restaurant, locale);
    if (!family) continue;
    byFamilyMap.set(family, [...(byFamilyMap.get(family) ?? []), restaurant]);
  }
  const byCuisine = [...byFamilyMap.entries()]
    .map(([label, group]) => ({ label, stats: groupPriceStats(group, now) }))
    .filter((row): row is PriceRow => Boolean(row.stats))
    .sort((a, b) => b.stats.medianOfMedians - a.stats.medianOfMedians);

  const setMenus = restaurants
    .flatMap((restaurant) =>
      tastingMenuPrices(restaurant, now).map((menu) => ({
        slug: restaurant.slug,
        name: restaurant.name,
        menu: menu.name,
        price: menu.price,
      })),
    )
    .sort((a, b) => b.price - a.price);

  return {
    restaurantsWithPrices: rows.length,
    pricedDishes: rows.reduce((sum, row) => sum + row.stats.pricedDishes, 0),
    latestCheck: rows.map((row) => row.stats.checkedAt).sort().at(-1) ?? null,
    city: groupPriceStats(restaurants, now),
    byArea,
    byCuisine,
    setMenus,
    restaurants: rows.sort((a, b) => a.stats.median - b.stats.median),
  };
}

/** Cuisine as a reader expects it: the family when known, else the source label tidied up. */
export function cuisineDisplay(restaurant: SiteRestaurant, locale: "en" | "es" = "en") {
  const family = cuisineFamily(restaurant, locale);
  if (family) return family;
  const raw = (restaurant.food.cuisine ?? "").replace(/[_-]+/g, " ").replace(/\s*\(.*?\)\s*/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null;
}
