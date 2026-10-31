import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatObserved } from "@/lib/restaurants/format";
import { groupPriceStats, pesos } from "@/lib/restaurants/stats";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantTiles } from "@/components/RestaurantTiles";
import { tilesFor } from "@/lib/restaurants/budget";
import { collectionDescription, collectionTitle, collectionTypeLabel } from "@/lib/geo/copy";
import { getCollectionBySlug, listBudgetIndex, listCollectionSlugs, listRestaurantsBySlugs } from "@/lib/data";
import { collectionJsonLd } from "@/lib/jsonld";
import { candidateRobots, pageMetadata } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await listCollectionSlugs();
  return slugs.map((slug) => ({ slug }));
}

const MIN_COLLECTION_SIZE = 3;

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) {
    return pageMetadata({
      title: "Collection not found",
      description: "This collection is not in the current graph.",
      path: `/collections/${slug}`,
      robots: candidateRobots(false),
    });
  }

  return pageMetadata({
    title: collectionTitle(collection),
    description: collectionDescription(collection),
    path: `/collections/${slug}`,
    // A list of one or two restaurants is a thin page: kept for visitors, not offered to search engines.
    robots: candidateRobots(collection.restaurantSlugs.length >= MIN_COLLECTION_SIZE),
  });
}

export default async function CollectionPage({
  params,
}: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const restaurants = await listRestaurantsBySlugs(collection.restaurantSlugs);
  const prices = groupPriceStats(restaurants);

  return (
    <main className="ds-page">
      <JsonLd data={collectionJsonLd(collection)} />
      <div className="ds-kicker-row">
        <span className="ds-label">
          {SITE_CITY} · {collectionTypeLabel(collection.type)}
        </span>
        <span className="num">{restaurants.length} restaurants</span>
      </div>
      <h1 className="ds-title">{collection.label}</h1>
      {prices ? (
        <p className="ds-lede">
          Median dish price here: <strong>{pesos(prices.medianOfMedians)}</strong> (most restaurants between{" "}
          {pesos(prices.p25)} and {pesos(prices.p75)}), from {prices.restaurants} official menus checked through{" "}
          {formatObserved(prices.latestCheck)}.{" "}
          <Link href="/prices" className="ds-link">
            Compare with the rest of the city
          </Link>
          .
        </p>
      ) : null}
      {restaurants.length === 0 ? (
        <p className="ds-empty">—</p>
      ) : (
        <RestaurantTiles tiles={tilesFor(restaurants, await listBudgetIndex("en"), "en")} locale="en" />
      )}
    </main>
  );
}
