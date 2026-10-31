import type { Metadata } from "next";
import { PricesView } from "@/components/views/PricesView";
import { listAllRestaurantRecords } from "@/lib/data";
import { buildPriceIndex } from "@/lib/restaurants/price-index";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: `How much does a restaurant meal cost in ${SITE_CITY}? Menu price index`,
    description: `Median dish prices from official restaurant menus in ${SITE_CITY}, by neighborhood and cuisine. Every price is checked on the restaurant's own menu and dated.`,
    path: "/prices",
    robots: publicRobots(),
  });
}

async function loadPriceIndex() {
  const restaurants = await listAllRestaurantRecords();
  return buildPriceIndex(restaurants, "en");
}

export default async function PricesPage() {
  return <PricesView index={await loadPriceIndex()} locale="en" />;
}
