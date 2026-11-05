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

// A menu that dates itself (publication.sourceDate, "2021" or "2023-09") more than 12 months back is not
// published on the site: no dishes, prices or cost per person from it; the restaurant page stays online.
// A year alone counts from its last month (generous: "2025" is fresh until the end of 2026).
export const MENU_MAX_AGE_MONTHS = 12;
export function menuSourceTooOld(sourceDate: string | null | undefined, now = new Date()) {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(sourceDate ?? "");
  if (!match) return false;
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit",
  }).format(now).split("-").map(Number);
  const sourceMonths = Number(match[1]) * 12 + (match[2] ? Number(match[2]) : 12);
  return year * 12 + month - sourceMonths > MENU_MAX_AGE_MONTHS;
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
  const unchanged = review.sourceUnchangedAt && review.sourceUnchangedAt > review.checkedAt
    ? ` Official source unchanged on ${formatObserved(review.sourceUnchangedAt)}.` : "";
  return `${menuCoverageLabel(restaurant)}. ${review.note} Source checked ${formatObserved(review.checkedAt)}.${unchanged}${
    menuNeedsRecheck(restaurant) ? " Recheck due; today's menu and prices are not confirmed." : ""
  }`;
}

export function menuPriceText(price: number, currency = "MXN") {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(price)} ${currency}`;
}
