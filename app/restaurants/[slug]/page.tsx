import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  dishLinksForRestaurant,
  getRestaurantBySlug,
  nearbyTiles,
  sameCuisineTiles,
  listRestaurantSlugs,
} from "@/lib/data";
import { RestaurantView } from "@/components/views/RestaurantView";
import { restaurantDescription, restaurantTitle } from "@/lib/geo/copy";
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
}: PageProps<"/restaurants/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) {
    return pageMetadata({
      title: "Restaurant not found",
      description: "This restaurant is not in the current catalog.",
      path: `/restaurants/${slug}`,
      robots: candidateRobots(false),
    });
  }

  return pageMetadata({
    title: restaurantTitle(restaurant),
    description: restaurantDescription(restaurant),
    path: `/restaurants/${slug}`,
    robots: publicRobots(),
    image: absoluteUrl(`/restaurants/${slug}/opengraph-image`),
  });
}

export default async function RestaurantPage({
  params,
}: PageProps<"/restaurants/[slug]">) {
  const { slug } = await params;
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();

  const films = await filmsForRestaurant(slug);
  return (
    <RestaurantView
      restaurant={restaurant}
      nearby={await nearbyTiles(slug, "en")}
      sameCuisine={await sameCuisineTiles(slug, "en")}
      films={films}
      locale="en"
      dishLinks={await dishLinksForRestaurant(slug)}
    />
  );
}
