import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantTiles } from "@/components/RestaurantTiles";
import { FX_DATE, foreignEquivalent, toEur, toUsd } from "@/lib/currency";
import { formatDate, paths, type Locale } from "@/lib/i18n";
import {
  BANDS,
  bandKey,
  bandLabel,
  bandRows,
  budgetPath,
  type BudgetBand,
  type BudgetIndex,
  type BudgetRow,
} from "@/lib/restaurants/budget";
import { mealExtrasNote } from "@/lib/restaurants/quick-facts";
import { pesos } from "@/lib/restaurants/stats";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

const COPY = {
  en: {
    city: "Mexico City",
    kicker: "Mexico City · eat on a budget",
    updated: "menus checked up to",
    indexTitle: "Where to eat in Mexico City on a budget",
    indexLede: (n: number) =>
      `${n} Mexico City restaurants with a checked official menu, grouped by what one meal costs per person, ${mealExtrasNote("en")}. Pick a budget, then a neighborhood.`,
    bandTitle: (band: BudgetBand, where: string) =>
      band.max !== null
        ? `Where to eat in ${where} for under ${band.max} pesos (≈ US$${toUsd(band.max)} · €${toEur(band.max)})`
        : `${where} restaurants over ${band.min} pesos per person (≈ US$${toUsd(band.min!)} · €${toEur(band.min!)})`,
    answer: (n: number, band: BudgetBand, where: string, checked: string | null) =>
      band.max !== null
        ? `${n} restaurants in ${where} serve a meal for under ${pesos(band.max)} per person (${foreignEquivalent(band.max)}), ${mealExtrasNote("en")}, based on official menus${checked ? ` checked up to ${checked}` : ""}. Closest to the budget first.`
        : `${n} restaurants in ${where} where a meal costs ${pesos(band.min!)} or more per person (${foreignEquivalent(band.min!)}), mostly tasting menus, based on official menus${checked ? ` checked up to ${checked}` : ""}.`,
    summary: (n: number) => `${n} restaurants · per person, before drinks and tip`,
    budgets: "Budgets",
    byArea: "By neighborhood",
    allBudgets: "All budgets",
    restaurant: "Restaurant",
    area: "Area",
    cuisine: "Cuisine",
    perPerson: "Per person",
    how: "Estimate",
    booking: "Booking",
    checked: "Menu checked",
    restaurants: "restaurants",
    all: "All of Mexico City",
    method: "How is it calculated?",
    methodText: `One meal per person is estimated from the restaurant's own menu: the median starter plus the median main course; one main course when the menu has no starter section; three tacos at a taquería; one breakfast plate at a breakfast place; or the cheapest set menu at a tasting-menu restaurant. Drinks, desserts, sides and tip (10–15% is customary in Mexico) are not included. Restaurants without a sectioned, priced official menu are left out rather than guessed. Dollar and euro equivalents use the European Central Bank reference rate of ${FX_DATE} and are rounded.`,
    seeMethod: "Full methodology",
  },
  es: {
    city: "la Ciudad de México",
    kicker: "Ciudad de México · comer según tu presupuesto",
    updated: "cartas verificadas hasta",
    indexTitle: "Dónde comer en la Ciudad de México según tu presupuesto",
    indexLede: (n: number) =>
      `${n} restaurantes de la Ciudad de México con carta oficial verificada, agrupados por lo que cuesta una comida por persona, ${mealExtrasNote("es")}. Elige un presupuesto y luego una colonia.`,
    bandTitle: (band: BudgetBand, where: string) =>
      band.max !== null
        ? `Dónde comer en ${where} por menos de ${band.max} pesos (≈ US$${toUsd(band.max)} · €${toEur(band.max)})`
        : `Restaurantes en ${where} de más de ${band.min} pesos por persona`,
    answer: (n: number, band: BudgetBand, where: string, checked: string | null) =>
      band.max !== null
        ? `${n} restaurantes en ${where} donde una comida cuesta menos de ${pesos(band.max)} por persona (${foreignEquivalent(band.max)}), ${mealExtrasNote("es")}, según sus cartas oficiales${checked ? ` verificadas hasta el ${checked}` : ""}. Primero los más cercanos al presupuesto.`
        : `${n} restaurantes en ${where} donde una comida cuesta ${pesos(band.min!)} o más por persona (${foreignEquivalent(band.min!)}), sobre todo menús degustación, según sus cartas oficiales${checked ? ` verificadas hasta el ${checked}` : ""}.`,
    summary: (n: number) => `${n} restaurantes · por persona, sin bebidas ni propina`,
    budgets: "Presupuestos",
    byArea: "Por colonia",
    allBudgets: "Todos los presupuestos",
    restaurant: "Restaurante",
    area: "Zona",
    cuisine: "Cocina",
    perPerson: "Por persona",
    how: "Estimación",
    booking: "Reservar",
    checked: "Carta verificada",
    restaurants: "restaurantes",
    all: "Toda la Ciudad de México",
    method: "¿Cómo se calcula?",
    methodText: `La comida por persona se estima con la carta propia del restaurante: entrada mediana más plato fuerte mediano; un plato fuerte si la carta no tiene entradas; tres tacos en una taquería; un desayuno en un lugar de desayunos; o el menú fijo más económico en un restaurante de menú degustación. No incluye bebidas, postres, guarniciones ni propina (en México se acostumbra 10–15 %). Los restaurantes sin carta oficial con secciones y precios quedan fuera en lugar de adivinar. Los equivalentes en dólares y euros usan el tipo de referencia del Banco Central Europeo del ${FX_DATE}, redondeados.`,
    seeMethod: "Metodología completa",
  },
};

function itemList(rows: BudgetRow[], locale: Locale, name: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    inLanguage: locale === "es" ? "es-MX" : "en",
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 100).map((row, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Restaurant",
        name: row.name,
        url: absoluteUrl(paths.restaurant(row.slug, locale)),
        priceRange: `${row.meal.estimate} MXN per person`,
        address: row.area ? { "@type": "PostalAddress", addressLocality: "Mexico City", streetAddress: row.area } : undefined,
      },
    })),
    publisher: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
  };
}

function Method({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <details className="ms-box ms-method" style={{ marginTop: 24 }}>
      <summary className="ms-box-head"><span className="ms-label">{c.method}</span></summary>
      <p className="ms-prose" style={{ padding: "10px 12px", margin: 0 }}>
        {c.methodText}{" "}
        <Link href={paths.methodology(locale) as never} className="ms-link">{c.seeMethod} <span aria-hidden="true">→</span></Link>
      </p>
    </details>
  );
}

export function BudgetIndexView({ index, locale }: { index: BudgetIndex; locale: Locale }) {
  const c = COPY[locale];
  const checked = formatDate(index.latestCheck, locale);
  return (
    <main className="ms-page" lang={locale === "es" ? "es-MX" : undefined}>
      <div className="ms-eyebrow">
        <span className="ms-label">{c.kicker}</span>
        {checked ? <span className="ms-num">{c.updated} {checked}</span> : null}
      </div>
      <h1 className="ms-title">{c.indexTitle}</h1>

      <section className="ms-box">
        <div className="ms-box-head"><span className="ms-label">{c.budgets}</span></div>
        <table className="ms-table">
          <tbody>
            {BANDS.map((band) => {
              const rows = bandRows(index, band);
              const areas = index.areasByBand[bandKey(band)] ?? [];
              return (
                <tr key={bandKey(band)}>
                  <td>
                    <Link href={budgetPath(locale, band) as never} className="ms-link"><strong>{bandLabel(band, locale)}</strong></Link>
                    <span className="ms-num"> · {rows.length} {c.restaurants}</span>
                  </td>
                  <td className="ms-num">
                    {areas.map((entry, i) => (
                      <span key={entry.areaSlug}>
                        {i ? " · " : ""}
                        <Link href={budgetPath(locale, band, entry.areaSlug) as never} className="ms-link">{entry.area}</Link> ({entry.count})
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="ms-more ms-num" style={{ marginTop: 16 }}>
        <Link href={paths.prices(locale) as never} className="ms-link">
          {locale === "es" ? "Índice de precios por colonia y tipo de cocina" : "Price index by neighborhood and cuisine"} <span aria-hidden="true">→</span>
        </Link>
      </p>
      <Method locale={locale} />
    </main>
  );
}

export function BudgetBandView({
  index,
  band,
  areaSlug = null,
  locale,
}: {
  index: BudgetIndex;
  band: BudgetBand;
  areaSlug?: string | null;
  locale: Locale;
}) {
  const c = COPY[locale];
  const rows = bandRows(index, band, areaSlug);
  const areas = index.areasByBand[bandKey(band)] ?? [];
  const areaName = areaSlug ? rows[0]?.area ?? areaSlug : null;
  const where = areaName ?? c.city;
  const title = c.bandTitle(band, where);
  return (
    <main className="ms-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={itemList(rows, locale, title, absoluteUrl(budgetPath(locale, band, areaSlug)))} />
      <h1 className="ms-title">{title}</h1>
      <p className="ms-lede ms-num">{c.summary(rows.length)}</p>
      {/* One line of neighbourhood links keeps the area pages reachable (they are in the sitemap). */}
      {areas.length ? (
        <p className="ms-inline-links ms-num" style={{ margin: "0 0 16px" }}>
          <Link href={budgetPath(locale) as never} className="ms-link">{c.allBudgets}</Link>{" · "}
          <span className="ms-label">{c.byArea}</span>{" "}
          {areaSlug ? <><Link href={budgetPath(locale, band) as never} className="ms-link">{c.all}</Link> · </> : null}
          {areas.filter((entry) => entry.areaSlug !== areaSlug).map((entry, i) => (
            <span key={entry.areaSlug}>
              {i ? " · " : ""}
              <Link href={budgetPath(locale, band, entry.areaSlug) as never} className="ms-link">{entry.area}</Link>
            </span>
          ))}
        </p>
      ) : null}
      <RestaurantTiles
        tiles={rows.map((row) => ({ slug: row.slug, name: row.name, cuisine: row.cuisine, area: row.area, price: row.meal.estimate }))}
        locale={locale}
        showArea={!areaSlug}
      />
      <Method locale={locale} />
    </main>
  );
}
