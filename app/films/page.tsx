import type { Metadata } from "next";
import { FilmsView } from "@/components/views/TrustViews";
import { listAllRestaurantRecords } from "@/lib/data";
import { listFilms } from "@/lib/restaurants/films";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Mexico City restaurant documentaries by The Dining Dispatch",
    description: "Documentaries filmed in Mexico City restaurant kitchens by The Dining Dispatch, each linked to the restaurant's checked record: menu prices, booking and address.",
    path: "/films",
    robots: publicRobots(),
  });
}

export default async function Page() {
  const [films, restaurants] = await Promise.all([listFilms(), listAllRestaurantRecords()]);
  const names = Object.fromEntries(restaurants.map((restaurant) => [restaurant.slug, restaurant.name]));
  return <FilmsView films={films.filter((film) => names[film.restaurantSlug])} names={names} locale="en" />;
}
