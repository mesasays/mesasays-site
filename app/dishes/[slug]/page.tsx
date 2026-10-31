import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DishView } from "@/components/views/DishesView";
import { listDishSummaries } from "@/lib/data";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { pesos } from "@/lib/restaurants/stats";
import { candidateRobots, pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export const dynamicParams = false;

async function loadDish(slug: string) {
  return (await listDishSummaries()).find((dish) => dish.slug === slug && dish.restaurants >= MIN_RESTAURANTS_PER_DISH) ?? null;
}

export async function generateStaticParams() {
  return (await listDishSummaries())
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
    .map((dish) => ({ slug: dish.slug }));
}

export async function generateMetadata({ params }: PageProps<"/dishes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const dish = await loadDish(slug);
  if (!dish) {
    return pageMetadata({ title: "Dish not found", description: "—", path: `/dishes/${slug}`, robots: candidateRobots(false) });
  }
  const name = dish.name;
  return pageMetadata({
    title: `${name} in ${SITE_CITY}: ${dish.restaurants} restaurants and prices`,
    description: `Where to eat ${name.toLowerCase()} in ${SITE_CITY}: ${dish.restaurants} restaurants with the price on their official menu.${dish.minPrice !== null ? ` From ${pesos(dish.minPrice)}.` : ""}`,
    path: `/dishes/${slug}`,
    robots: publicRobots(),

  });
}

export default async function DishPage({ params }: PageProps<"/dishes/[slug]">) {
  const { slug } = await params;
  const dish = await loadDish(slug);
  if (!dish) notFound();
  return <DishView dish={dish} locale="en" />;
}
