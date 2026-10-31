import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DishView } from "@/components/views/DishesView";
import { listDishSummaries } from "@/lib/data";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { pesos } from "@/lib/restaurants/stats";
import { candidateRobots, pageMetadata, publicRobots } from "@/lib/seo";

export const dynamicParams = false;

async function loadDish(slug: string) {
  return (await listDishSummaries()).find((dish) => dish.slug === slug && dish.restaurants >= MIN_RESTAURANTS_PER_DISH) ?? null;
}

export async function generateStaticParams() {
  return (await listDishSummaries())
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
    .map((dish) => ({ slug: dish.slug }));
}

export async function generateMetadata({ params }: PageProps<"/es/platos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const dish = await loadDish(slug);
  if (!dish) {
    return pageMetadata({ title: "Platillo no encontrado", description: "—", path: `/es/platos/${slug}`, robots: candidateRobots(false), locale: "es_MX" });
  }
  const name = dish.nameEs;
  return pageMetadata({
    title: `${name} en la CDMX: ${dish.restaurants} restaurantes y precios`,
    description: `Dónde comer ${name.toLowerCase()} en la Ciudad de México: ${dish.restaurants} restaurantes con el precio de su carta oficial.${dish.minPrice !== null ? ` Desde ${pesos(dish.minPrice)}.` : ""}`,
    path: `/es/platos/${slug}`,
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function PlatilloPage({ params }: PageProps<"/es/platos/[slug]">) {
  const { slug } = await params;
  const dish = await loadDish(slug);
  if (!dish) notFound();
  return <DishView dish={dish} locale="es" />;
}
