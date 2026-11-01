import Link from "next/link";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantIndex } from "@/components/RestaurantIndex";
import { catalogJsonLd } from "@/lib/jsonld";
import { listBudgetIndex, listLaunchRestaurantRecords } from "@/lib/data";
import { tilesFor } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Restaurants in ${SITE_CITY}`,
  description: `Index of verified restaurants in ${SITE_CITY}: neighborhood, cuisine, observed hours, and source menu. Menus, prices, addresses, Instagram, press and documented distinctions.`,
  path: "/restaurants",
  robots: publicRobots(),
});

export default async function RestaurantIndexPage() {
  const [restaurants, index] = await Promise.all([listLaunchRestaurantRecords(), listBudgetIndex("en")]);
  const tiles = tilesFor(restaurants, index, "en").sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="ms-page">
      <JsonLd data={catalogJsonLd(restaurants.length, restaurants)} />
      <div className="ms-eyebrow">
        <span className="ms-label">{SITE_CITY}</span>
        <span className="ms-num">
          {restaurants.length} restaurants · <Link href="/collections" className="ms-link">Collections</Link>
        </span>
      </div>
      <h1 className="ms-title">Restaurants in {SITE_CITY}</h1>
      <Suspense>
        <RestaurantIndex tiles={tiles} locale="en" />
      </Suspense>
    </main>
  );
}
