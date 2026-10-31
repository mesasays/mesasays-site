import { formatObserved } from "@/lib/restaurants/format";
import type { SiteRestaurant } from "@/lib/restaurants/types";

export function menuNeedsRecheck(restaurant: SiteRestaurant, now = new Date()) {
  const review = restaurant.menu.publication;
  if (!review) return true;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return today > review.recheckAfter;
}

export function menuHasPrices(restaurant: SiteRestaurant) {
  return Boolean(restaurant.menu.publication) && (
    restaurant.menu.items.some((item) => item.price !== null) ||
    Boolean(restaurant.menu.publication?.pricing?.some((price) => price.kind === "menu"))
  );
}

export function menuCoverageLabel(restaurant: SiteRestaurant) {
  switch (restaurant.menu.publication?.coverage) {
    case "food_menu": return "Food menu";
    case "selection": return "Menu selection";
    case "dishes": return "Published dishes";
    default: return "Menu source";
  }
}

export function menuSummary(restaurant: SiteRestaurant) {
  const review = restaurant.menu.publication;
  if (!review) return null;
  return `${menuCoverageLabel(restaurant)}. ${review.note} Source checked ${formatObserved(review.checkedAt)}.${
    menuNeedsRecheck(restaurant) ? " Recheck due; today's menu and prices are not confirmed." : ""
  }`;
}

export function menuPriceText(price: number, currency = "MXN") {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(price)} ${currency}`;
}
