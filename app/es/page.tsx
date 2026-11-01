import type { Metadata } from "next";
import Link from "next/link";
import { HomeFinder } from "@/components/HomeFinder";
import { listAllRestaurantRecords, listRestaurantSlugs } from "@/lib/data";
import { paths } from "@/lib/i18n";
import { listFilms } from "@/lib/restaurants/films";
import { finderProps } from "@/lib/restaurants/finder";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_HOME_TITLE_ES, homeDescription } from "@/lib/site";

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
// Everything else lives one click away (nav, footer); structured data stays in the page.
export default async function InicioPage() {
  const [all, films] = await Promise.all([
    listAllRestaurantRecords(),
    listFilms(),
  ]);
  const latestFilm = films.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? null;
  const filmRestaurant = all.find((restaurant) => restaurant.slug === latestFilm?.restaurantSlug)?.name ?? null;

  return (
    <main className="ms-page ms-home" lang="es-MX">
      <h1 className="ms-title">La guía abierta de restaurantes de la Ciudad de México.</h1>
      <p className="ms-promise">Ningún restaurante paga por estar aquí.</p>

      <HomeFinder {...(await finderProps("es"))} locale="es" />

      <p className="ms-more ms-num">
        <Link href={paths.restaurants("es") as never} className="ms-link">{all.length} restaurantes <span aria-hidden="true">→</span></Link>
        {latestFilm ? (
          <>
            {" · "}
            <Link href={paths.restaurant(latestFilm.restaurantSlug, "es") as never} className="ms-link">
              Última película: {filmRestaurant ?? latestFilm.title} <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : null}
      </p>
    </main>
  );
}
