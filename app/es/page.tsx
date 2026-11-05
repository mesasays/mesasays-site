import Link from "next/link";
import type { Metadata } from "next";
import { paths } from "@/lib/i18n";
import { HomeFinder } from "@/components/HomeFinder";
import { HomePrinciples } from "@/components/HomePrinciples";
import { listRestaurantSlugs } from "@/lib/data";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { PUBLIC_REPO_URL, SITE_FAIR_LINE_ES, SITE_HOME_TITLE_ES, homeDescription } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const count = (await listRestaurantSlugs()).length;
  return pageMetadata({
    title: SITE_HOME_TITLE_ES,
    description: homeDescription(count, "es"),
    path: "/es",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

// The home page is one task: say what this is, then help the visitor find a table.
// Everything else lives one click away in the nav.
export default async function InicioPage() {
  return (
    <main className="ms-page ms-home" lang="es-MX">
      <div className="ms-home-main">
        <div className="ms-home-intro">
          <h1 className="ms-title">
            La guía de restaurantes{" "}
            <Link href={paths.unbiased("es") as never} className="ms-title-accent">imparcial</Link>
          </h1>
          <p className="ms-promise">Ciudad de México</p>
          {/* Desktop only: points at the finder on the right. */}
          <p className="ms-home-cta">Cartas reales, precios reales. Empieza por tu presupuesto <span className="ms-home-cta-arrow" aria-hidden="true">→</span></p>
        </div>

        <HomeFinder {...(await finderProps("es"))} locale="es" />
      </div>

      <HomePrinciples locale="es" />

      <footer className="ms-home-foot ms-num">
        <p className="ms-say-invite">{SITE_FAIR_LINE_ES}</p>
        <p className="ms-open">
          <a href={PUBLIC_REPO_URL} className="ms-link">Código abierto</a>
        </p>
      </footer>
    </main>
  );
}
