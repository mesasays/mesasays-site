import "server-only";

import { getRestaurantBySlug, listRestaurants } from "@/lib/data";
import type { SiteRestaurant } from "@/lib/restaurants/types";
import type { SayPlace } from "@/components/say/Say";

export function sayPlace(restaurant: SiteRestaurant): SayPlace {
  return { slug: restaurant.slug, name: restaurant.name, neighborhood: restaurant.location.neighborhood };
}

export async function sayPlaces(): Promise<SayPlace[]> {
  const rows = await listRestaurants();
  return rows
    .map((row) => ({ slug: row.slug, name: row.name, neighborhood: row.neighborhood || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function sayRestaurant(slug: string) {
  const restaurant = await getRestaurantBySlug(slug);
  return restaurant ? sayPlace(restaurant) : null;
}
