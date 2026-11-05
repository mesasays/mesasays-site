import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { paths } from "@/lib/i18n";
import { HomeFinder } from "@/components/HomeFinder";
import { HomePrinciples } from "@/components/HomePrinciples";
import { listAllRestaurantRecords, listLaunchRestaurantRecords, listRestaurantSlugs } from "@/lib/data";
import { catalogJsonLd } from "@/lib/jsonld";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { PUBLIC_REPO_URL, SITE_FAIR_LINE, SITE_HOME_TITLE, homeDescription } from "@/lib/site";

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
      <div className="ms-home-main">
        <div className="ms-home-intro">
          <h1 className="ms-title">
            The{" "}
            <Link href={paths.unbiased("en") as never} className="ms-title-accent">unbiased</Link>{" "}
            restaurant guide
          </h1>
          <p className="ms-promise">Mexico City</p>
          {/* Desktop only: points at the finder on the right. */}
          <p className="ms-home-cta">Real menus, real prices. Start with your budget <span className="ms-home-cta-arrow" aria-hidden="true">→</span></p>
        </div>

        <HomeFinder {...(await finderProps("en"))} locale="en" />
      </div>

      <HomePrinciples locale="en" />

      <footer className="ms-home-foot ms-num">
        <p className="ms-say-invite">{SITE_FAIR_LINE}</p>
        <p className="ms-open">
          <a href={PUBLIC_REPO_URL} className="ms-link">Open source</a>
        </p>
      </footer>
    </main>
  );
}
