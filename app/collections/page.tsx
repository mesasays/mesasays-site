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
    <main className="ds-page">
      <JsonLd data={collectionsIndexJsonLd(collections)} />
      <div className="ds-kicker-row">
        <span className="ds-label">{SITE_CITY}</span>
        <span className="num">{collections.length}</span>
      </div>
      <h1 className="ds-title">Collections</h1>
      {[...grouped.entries()].map(([type, items]) => (
        <section key={type} className="ds-panel">
          <div className="ds-panel-head">
            <span className="ds-label">{collectionTypeLabel(type)}</span>
            <span className="num">{items.length}</span>
          </div>
          <ul className="ds-list">
            {items.map((collection) => (
              <li key={collection.id}>
                <Link href={collectionHref(collection)} className="ds-link">
                  {collection.label}
                </Link>
                <span className="num"> · {collection.restaurantCount}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
