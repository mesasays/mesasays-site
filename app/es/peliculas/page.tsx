import type { Metadata } from "next";
import { FilmsView } from "@/components/views/TrustViews";
import { listAllRestaurantRecords } from "@/lib/data";
import { listFilms } from "@/lib/restaurants/films";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Documentales de restaurantes de la Ciudad de México por The Dining Dispatch",
    description: "Documentales filmados en cocinas de restaurantes de la Ciudad de México por The Dining Dispatch, cada uno enlazado a la ficha verificada del restaurante.",
    path: "/es/peliculas",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function Page() {
  const [films, restaurants] = await Promise.all([listFilms(), listAllRestaurantRecords()]);
  const names = Object.fromEntries(restaurants.map((restaurant) => [restaurant.slug, restaurant.name]));
  return <FilmsView films={films.filter((film) => names[film.restaurantSlug])} names={names} locale="es" />;
}
