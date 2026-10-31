import type { Metadata } from "next";
import { DishesIndexView } from "@/components/views/DishesView";
import { listDishSummaries } from "@/lib/data";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: `Where to eat a specific dish in ${SITE_CITY}, and what it costs`,
    description: `Find which ${SITE_CITY} restaurants serve tacos al pastor, mole, ceviche, chilaquiles and more — with the price printed on their official menu and the date it was checked.`,
    path: "/dishes",
    robots: publicRobots(),

  });
}

export default async function DishesPage() {
  const dishes = (await listDishSummaries())
    .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
    .sort((a, b) => b.restaurants - a.restaurants || a.name.localeCompare(b.name));
  return <DishesIndexView dishes={dishes} locale="en" />;
}
