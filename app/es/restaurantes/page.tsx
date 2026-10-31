import Link from "next/link";
import { Suspense } from "react";
import { RestaurantIndex } from "@/components/RestaurantIndex";
import { listAllRestaurantRecords, listBudgetIndex } from "@/lib/data";
import { tilesFor } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Restaurantes de la Ciudad de México: cartas, precios y reservaciones",
  description: "Todos los restaurantes verificados de Mesasays en la CDMX, agrupados por colonia, con el precio típico de un platillo según su carta oficial.",
  path: "/es/restaurantes",
  robots: publicRobots(),
  locale: "es_MX",
});

export default async function RestaurantesPage() {
  const [all, index] = await Promise.all([listAllRestaurantRecords(), listBudgetIndex("es")]);
  const tiles = tilesFor(all, index, "es").sort((a, b) => a.name.localeCompare(b.name));
  return (
    <main className="ds-page" lang="es-MX">
      <div className="ds-kicker-row">
        <span className="ds-label">Ciudad de México</span>
        <span className="num">
          {all.length} restaurantes · <Link href="/collections" className="ds-link" hrefLang="en">Colecciones (en inglés)</Link>
        </span>
      </div>
      <h1 className="ds-title">Restaurantes de la Ciudad de México</h1>
      <Suspense>
        <RestaurantIndex tiles={tiles} locale="es" />
      </Suspense>
    </main>
  );
}
