import type { Metadata } from "next";
import { DishesIndexView } from "@/components/views/DishesView";
import { listDishSummaries } from "@/lib/data";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Dónde comer un platillo en la CDMX y cuánto cuesta",
    description: "Qué restaurantes de la Ciudad de México sirven tacos al pastor, mole, ceviche, chilaquiles y más, con el precio de su carta oficial y la fecha de verificación.",
    path: "/es/platos",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function PlatillosPage() {
  const dishes = (await listDishSummaries())
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
    .sort((a, b) => b.restaurants - a.restaurants || a.nameEs.localeCompare(b.nameEs));
  return <DishesIndexView dishes={dishes} locale="es" />;
}
