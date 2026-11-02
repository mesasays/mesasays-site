import type { Metadata } from "next";
import { HomeFinder } from "@/components/HomeFinder";
import { listRestaurantSlugs } from "@/lib/data";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { PUBLIC_REPO_URL, SITE_HOME_TITLE_ES, homeDescription } from "@/lib/site";

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
        <h1 className="ms-title">La guía de restaurantes descentralizada</h1>
        <p className="ms-promise">Ciudad de México</p>

        <HomeFinder {...(await finderProps("es"))} locale="es" />
      </div>

      <footer className="ms-home-foot ms-num">
        <p className="ms-say-invite">Ningún restaurante paga por estar aquí.</p>
        <p className="ms-open">
          <a href={PUBLIC_REPO_URL} className="ms-link">Datos y código abiertos</a>
        </p>
      </footer>
    </main>
  );
}
