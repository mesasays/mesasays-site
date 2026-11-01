import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { HomeFinder } from "@/components/HomeFinder";
import { listAllRestaurantRecords, listLaunchRestaurantRecords, listRestaurantSlugs } from "@/lib/data";
import { catalogJsonLd } from "@/lib/jsonld";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_HOME_TITLE, SITE_TAGLINE, homeDescription } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const count = (await listRestaurantSlugs()).length;
  return pageMetadata({
    title: SITE_HOME_TITLE,
    description: homeDescription(count, "en"),
    path: "/",
    robots: publicRobots(),
  });
}

// The home page is one task: say what this is, then help the visitor find a table.
// Everything else lives one click away (nav, footer); structured data stays in the page.
export default async function HomePage() {
  const [all, sample] = await Promise.all([listAllRestaurantRecords(), listLaunchRestaurantRecords(12)]);

  return (
    <main className="ms-page ms-home">
      <JsonLd data={catalogJsonLd(all.length, sample)} />
      <h1 className="ms-title">{SITE_TAGLINE}</h1>
      <p className="ms-promise">No restaurant pays to be here.</p>

      <HomeFinder {...(await finderProps("en"))} locale="en" />

      <p className="ms-say-invite">
        Been somewhere? <Link href={"/say" as never} className="ms-link">Say what to order, and what to skip <span aria-hidden="true">→</span></Link>
      </p>
    </main>
  );
}
