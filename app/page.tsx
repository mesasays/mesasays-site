import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { HomeFinder } from "@/components/HomeFinder";
import { listAllRestaurantRecords, listLaunchRestaurantRecords, listRestaurantSlugs } from "@/lib/data";
import { catalogJsonLd } from "@/lib/jsonld";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_HOME_TITLE, homeDescription } from "@/lib/site";

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
      <h1 className="ms-title">The decentralized restaurant guide</h1>
      <p className="ms-promise">Mexico City</p>

      <HomeFinder {...(await finderProps("en"))} locale="en" />

      <p className="ms-say-invite">No restaurant pays to be here.</p>
    </main>
  );
}
