import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { listCollections } from "@/lib/data";
import { collectionTypeLabel } from "@/lib/geo/copy";
import { collectionsIndexJsonLd } from "@/lib/jsonld";
import { collectionHref } from "@/lib/restaurants/paths";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Restaurant collections in ${SITE_CITY}`,
  description: `Objective restaurant collections in ${SITE_CITY} by neighborhood, borough, cuisine, and documented distinction. No occasion judgments.`,
  path: "/collections",
  robots: publicRobots(),
});

export default async function CollectionsPage() {
  const collections = await listCollections();
  const grouped = collections.reduce((acc, collection) => {
    const list = acc.get(collection.type) ?? [];
    list.push(collection);
    acc.set(collection.type, list);
    return acc;
  }, new Map<string, typeof collections>());

  return (
    <main className="ms-page">
      <JsonLd data={collectionsIndexJsonLd(collections)} />
      <div className="ms-eyebrow">
        <span className="ms-label">{SITE_CITY}</span>
        <span className="ms-num">{collections.length}</span>
      </div>
      <h1 className="ms-title">Collections</h1>
      {[...grouped.entries()].map(([type, items]) => (
        <section key={type} className="ms-box">
          <div className="ms-box-head">
            <span className="ms-label">{collectionTypeLabel(type)}</span>
            <span className="ms-num">{items.length}</span>
          </div>
          <ul className="ms-list">
            {items.map((collection) => (
              <li key={collection.id}>
                <Link href={collectionHref(collection)} className="ms-link">
                  {collection.label}
                </Link>
                <span className="ms-num"> · {collection.restaurantCount}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
