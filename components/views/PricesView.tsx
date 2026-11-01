import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { formatDate, paths, type Locale } from "@/lib/i18n";
import type { PriceIndex } from "@/lib/restaurants/price-index";
import { MIN_PRICED_DISHES, MIN_RESTAURANTS_PER_GROUP, pesos } from "@/lib/restaurants/stats";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

const COPY = {
  en: {
    kicker: "Mexico City · price index",
    updated: "updated",
    title: "What a meal costs in Mexico City",
    lede: (n: number, median: string, p25: string, p75: string, dishes: string) =>
      `Across ${n} restaurants with a checked official menu, the median dish costs ${median}; half of them sit between ${p25} and ${p75}. Based on ${dishes} priced dishes, drinks excluded.`,
    empty: "Not enough checked menus yet.",
    byArea: "By neighborhood",
    byCuisine: "By cuisine",
    neighborhood: "Neighborhood",
    cuisine: "Cuisine",
    median: "Median dish",
    range: "Typical range",
    restaurants: "Restaurants",
    setMenus: "Tasting and set menus",
    restaurant: "Restaurant",
    menu: "Menu",
    price: "Price",
    every: "Every restaurant, cheapest first",
    area: "Area",
    checked: "Checked",
    method: "Method",
    methodText: (minDishes: number, minGroup: number) =>
      `Prices come only from each restaurant's own menu (website, PDF or official ordering page), transcribed and dated by ${SITE_NAME}. Delivery-app prices are not used. Drinks are excluded. A restaurant needs at least ${minDishes} priced dishes to get a median; a neighborhood or cuisine needs at least ${minGroup} such restaurants. Group figures are the median of restaurant medians, so one long menu does not outweigh the others. Menus older than their re-check date drop out until checked again. Prices are in Mexican pesos as printed.`,
  },
  es: {
    kicker: "Ciudad de México · índice de precios",
    updated: "actualizado",
    title: "Cuánto cuesta comer en la Ciudad de México",
    lede: (n: number, median: string, p25: string, p75: string, dishes: string) =>
      `En ${n} restaurantes con carta oficial verificada, el platillo mediano cuesta ${median}; la mitad está entre ${p25} y ${p75}. Con base en ${dishes} platillos con precio, sin bebidas.`,
    empty: "Todavía no hay suficientes cartas verificadas.",
    byArea: "Por colonia",
    byCuisine: "Por tipo de cocina",
    neighborhood: "Colonia",
    cuisine: "Cocina",
    median: "Platillo mediano",
    range: "Rango típico",
    restaurants: "Restaurantes",
    setMenus: "Menús degustación y menús fijos",
    restaurant: "Restaurante",
    menu: "Menú",
    price: "Precio",
    every: "Todos los restaurantes, del más barato al más caro",
    area: "Zona",
    checked: "Verificado",
    method: "Metodología",
    methodText: (minDishes: number, minGroup: number) =>
      `Los precios vienen solo de la carta propia de cada restaurante (sitio web, PDF o página oficial de pedidos), transcritos y fechados por ${SITE_NAME}. No usamos precios de apps de entrega. No incluye bebidas. Un restaurante necesita al menos ${minDishes} platillos con precio para tener mediana; una colonia o tipo de cocina necesita al menos ${minGroup} restaurantes así. Las cifras de grupo son la mediana de las medianas de cada restaurante. Las cartas vencidas salen del índice hasta volver a verificarse. Precios en pesos mexicanos tal como aparecen.`,
  },
};

export function PricesView({ index, locale }: { index: PriceIndex; locale: Locale }) {
  const c = COPY[locale];
  const checked = formatDate(index.latestCheck, locale);
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: locale === "es" ? `${SITE_NAME}: índice de precios de restaurantes en la Ciudad de México` : `${SITE_NAME} Mexico City restaurant menu price index`,
    description: c.lede(index.restaurantsWithPrices, index.city ? pesos(index.city.medianOfMedians) : "—", index.city ? pesos(index.city.p25) : "—", index.city ? pesos(index.city.p75) : "—", index.pricedDishes.toLocaleString("en-US")),
    license: "https://creativecommons.org/licenses/by/4.0/",
    inLanguage: locale === "es" ? "es-MX" : "en",
    url: absoluteUrl(paths.prices(locale)),
    creator: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    spatialCoverage: { "@type": "Place", name: "Mexico City, Mexico" },
    dateModified: index.latestCheck ?? undefined,
    isAccessibleForFree: true,
    measurementTechnique: c.methodText(MIN_PRICED_DISHES, MIN_RESTAURANTS_PER_GROUP),
    variableMeasured: [{ "@type": "PropertyValue", name: c.median, unitText: "MXN" }],
  };
  const Range = ({ p25, p75 }: { p25: number; p75: number }) => <span className="ms-num">{pesos(p25)}–{pesos(p75)}</span>;

  return (
    <main className="ms-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={dataset} />
      <div className="ms-eyebrow">
        <span className="ms-label">{c.kicker}</span>
        {checked ? <span className="ms-num">{c.updated} {checked}</span> : null}
      </div>
      <h1 className="ms-title">{c.title}</h1>
      <p className="ms-lede">
        {index.city
          ? c.lede(index.restaurantsWithPrices, pesos(index.city.medianOfMedians), pesos(index.city.p25), pesos(index.city.p75), index.pricedDishes.toLocaleString(locale === "es" ? "es-MX" : "en-US"))
          : c.empty}
      </p>

      <section className="ms-box" style={{ marginBottom: 16 }}>
        <div className="ms-box-head">
          <span className="ms-label">{c.byArea}</span>
          <span className="ms-num">{index.byArea.length}</span>
        </div>
        <table className="ms-table">
          <thead><tr><th scope="col">{c.neighborhood}</th><th scope="col">{c.median}</th><th scope="col">{c.range}</th><th scope="col">{c.restaurants}</th></tr></thead>
          <tbody>
            {index.byArea.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td><strong>{pesos(row.stats.medianOfMedians)}</strong></td>
                <td><Range p25={row.stats.p25} p75={row.stats.p75} /></td>
                <td className="ms-num">{row.stats.restaurants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ms-box" style={{ marginBottom: 16 }}>
        <div className="ms-box-head">
          <span className="ms-label">{c.byCuisine}</span>
          <span className="ms-num">{index.byCuisine.length}</span>
        </div>
        <table className="ms-table">
          <thead><tr><th scope="col">{c.cuisine}</th><th scope="col">{c.median}</th><th scope="col">{c.range}</th><th scope="col">{c.restaurants}</th></tr></thead>
          <tbody>
            {index.byCuisine.map((row) => (
              <tr key={row.label}>
                <td>{row.href ? <Link prefetch={false} href={row.href} className="ms-link" hrefLang="en">{row.label}</Link> : row.label}</td>
                <td><strong>{pesos(row.stats.medianOfMedians)}</strong></td>
                <td><Range p25={row.stats.p25} p75={row.stats.p75} /></td>
                <td className="ms-num">{row.stats.restaurants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {index.setMenus.length ? (
        <section className="ms-box" style={{ marginBottom: 16 }}>
          <div className="ms-box-head">
            <span className="ms-label">{c.setMenus}</span>
            <span className="ms-num">{index.setMenus.length}</span>
          </div>
          <table className="ms-table">
            <thead><tr><th scope="col">{c.restaurant}</th><th scope="col">{c.menu}</th><th scope="col">{c.price}</th></tr></thead>
            <tbody>
              {index.setMenus.map((row) => (
                <tr key={`${row.slug}-${row.menu}`}>
                  <td><Link prefetch={false} href={paths.restaurant(row.slug, locale)} className="ms-link">{row.name}</Link></td>
                  <td>{row.menu}</td>
                  <td><strong>{pesos(row.price)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="ms-box" style={{ marginBottom: 16 }}>
        <div className="ms-box-head">
          <span className="ms-label">{c.every}</span>
          <span className="ms-num">{index.restaurants.length}</span>
        </div>
        <table className="ms-table">
          <thead><tr><th scope="col">{c.restaurant}</th><th scope="col">{c.area}</th><th scope="col">{c.median}</th><th scope="col">{c.range}</th><th scope="col">{c.checked}</th></tr></thead>
          <tbody>
            {index.restaurants.map((row) => (
              <tr key={row.slug}>
                <td><Link prefetch={false} href={paths.restaurant(row.slug, locale)} className="ms-link">{row.name}</Link></td>
                <td>{row.area ?? "—"}</td>
                <td><strong>{pesos(row.stats.median)}</strong></td>
                <td><Range p25={row.stats.p25} p75={row.stats.p75} /></td>
                <td className="ms-num">{formatDate(row.stats.checkedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ms-box">
        <div className="ms-box-head"><span className="ms-label">{c.method}</span></div>
        <p className="ms-prose" style={{ padding: "10px 12px", margin: 0 }}>{c.methodText(MIN_PRICED_DISHES, MIN_RESTAURANTS_PER_GROUP)}</p>
      </section>
    </main>
  );
}
