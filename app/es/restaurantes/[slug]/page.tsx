import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantView } from "@/components/views/RestaurantView";
import { dishLinksForRestaurant } from "@/lib/data";
import { getRestaurantBySlug, listRestaurantSlugs, nearbyTiles, sameCuisineTiles } from "@/lib/data";
import { restaurantDescriptionEs, restaurantTitleEs } from "@/lib/geo/copy";
import { filmsForRestaurant } from "@/lib/restaurants/films";
import { candidateRobots, pageMetadata, publicRobots } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await listRestaurantSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/es/restaurantes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return pageMetadata({
      title: "Restaurante no encontrado",
      description: "Este restaurante no está en el catálogo.",
      path: `/es/restaurantes/${slug}`,
      robots: candidateRobots(false),
      locale: "es_MX",
    });
  }
  return pageMetadata({
    title: restaurantTitleEs(restaurant),
    description: restaurantDescriptionEs(restaurant),
    path: `/es/restaurantes/${slug}`,
    robots: publicRobots(),
    locale: "es_MX",
    image: absoluteUrl(`/restaurants/${slug}/opengraph-image`),
  });
}

export default async function RestauranteEsPage({ params }: PageProps<"/es/restaurantes/[slug]">) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();
  const films = await filmsForRestaurant(slug);
  return (
    <RestaurantView
      restaurant={restaurant}
      nearby={await nearbyTiles(slug, "es")}
      sameCuisine={await sameCuisineTiles(slug, "es")}
      films={films}
      locale="es"
      dishLinks={await dishLinksForRestaurant(slug)}
    />
  );
}
