import { menuNeedsRecheck } from "@/lib/restaurants/menu-publication";
import type { SiteRestaurant } from "@/lib/restaurants/types";

// Price statistics are computed only from reviewed, non-expired official menus.
// Anything below the thresholds is reported as "not enough data" rather than guessed.
export const MIN_PRICED_DISHES = 8;
export const MIN_RESTAURANTS_PER_GROUP = 3;

const DRINK_CATEGORY =
  /bebida|drink|vino|wine|cerveza|beer|c[oó]ctel|cocktail|mixolog|mezcal|tequila|destilad|licor|spirit|\bcaf[eé]s?\b|coffee|\bt[eé]s?\b|\btea\b|jugo|juice|refresco|\bsoda|\baguas?\b|water|smoothie|malteada|shake|\bbar\b|\bsake\b|whisk|\bgin\b|\bron\b|vodka|champagne|espumoso|\bcopas?\b/i;

export type PriceStats = {
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  pricedDishes: number;
  checkedAt: string;
};

export type GroupPriceStats = {
  medianOfMedians: number;
  p25: number;
  p75: number;
  restaurants: number;
  pricedDishes: number;
  latestCheck: string;
};

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

const roundPeso = (value: number) => Math.round(value / 5) * 5;

export function isDrinkCategory(category: string | null | undefined) {
  return Boolean(category && DRINK_CATEGORY.test(category));
}

export function hasLiveVerifiedMenu(restaurant: SiteRestaurant, now = new Date()) {
  const publication = restaurant.menu.publication;
  return Boolean(publication) && !menuNeedsRecheck(restaurant, now);
}

export function verifiedFoodItems(restaurant: SiteRestaurant, now = new Date()) {
  const publication = restaurant.menu.publication;
  if (!publication || publication.coverage === "dishes" || menuNeedsRecheck(restaurant, now)) {
    return [];
  }
  return restaurant.menu.items.filter(
    (item) => item.price !== null && item.price > 0 && !isDrinkCategory(item.category),
  );
}

export function verifiedFoodPrices(restaurant: SiteRestaurant, now = new Date()) {
  return verifiedFoodItems(restaurant, now).map((item) => item.price as number);
}

export function restaurantPriceStats(restaurant: SiteRestaurant, now = new Date()): PriceStats | null {
  const prices = verifiedFoodPrices(restaurant, now).sort((a, b) => a - b);
  if (prices.length < MIN_PRICED_DISHES) return null;
  return {
    median: roundPeso(quantile(prices, 0.5)),
    p25: roundPeso(quantile(prices, 0.25)),
    p75: roundPeso(quantile(prices, 0.75)),
    min: prices[0],
    max: prices[prices.length - 1],
    pricedDishes: prices.length,
    checkedAt: restaurant.menu.publication!.checkedAt,
  };
}

export function tastingMenuPrices(restaurant: SiteRestaurant, now = new Date()) {
  if (!hasLiveVerifiedMenu(restaurant, now)) return [];
  return (restaurant.menu.publication?.pricing ?? []).filter((price) => price.kind === "menu");
}

export function groupPriceStats(restaurants: SiteRestaurant[], now = new Date()): GroupPriceStats | null {
  const stats = restaurants
    .map((restaurant) => restaurantPriceStats(restaurant, now))
    .filter((value): value is PriceStats => Boolean(value));
  if (stats.length < MIN_RESTAURANTS_PER_GROUP) return null;
  const medians = stats.map((value) => value.median).sort((a, b) => a - b);
  return {
    medianOfMedians: roundPeso(quantile(medians, 0.5)),
    p25: roundPeso(quantile(medians, 0.25)),
    p75: roundPeso(quantile(medians, 0.75)),
    restaurants: stats.length,
    pricedDishes: stats.reduce((sum, value) => sum + value.pricedDishes, 0),
    latestCheck: stats.map((value) => value.checkedAt).sort().at(-1)!,
  };
}

export function pesos(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} MXN`;
}
