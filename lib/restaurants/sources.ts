import type { SiteRestaurant } from "@/lib/restaurants/types";

// Only public, attributable references already present in the restaurant record.
export function restaurantSources(restaurant: SiteRestaurant) {
  const seen = new Set<string>();
  return restaurant.links.flatMap((link) => {
    try {
      const url = new URL(link.url);
      if (!["https:", "http:"].includes(url.protocol) || seen.has(url.href)) return [];
      seen.add(url.href);
      return [{
        url: url.href,
        label: url.hostname.replace(/^www\./, ""),
        recordedAt: link.checkedAt,
      }];
    } catch {
      return [];
    }
  });
}
