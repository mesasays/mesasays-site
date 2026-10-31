import Link from "next/link";
import { formatDate, paths, type Locale } from "@/lib/i18n";
import type { UpdateEntry } from "@/lib/restaurants/updates";

const COPY = {
  en: {
    kicker: "Mexico City · change log",
    title: "What changed",
    lede: "Every addition, re-check and closure in the catalog, dated. Restaurants are added only after their official site, menu and booking channel are checked at the source.",
    added: (n: number) => `${n} restaurants added`,
    reverified: "Catalog re-checked at the source",
    reverifiedDetail: (v: number, u: number) => `${v} confirmed on their official site; ${u} could not be confirmed online (unofficial menus removed).`,
    closed: (n: number) => `${n} removed: closed or not a restaurant`,
  },
  es: {
    kicker: "Ciudad de México · bitácora",
    title: "Qué cambió",
    lede: "Cada alta, reverificación y cierre del catálogo, con fecha. Solo agregamos restaurantes después de verificar en la fuente su sitio oficial, su carta y su canal de reservación.",
    added: (n: number) => `${n} restaurantes agregados`,
    reverified: "Catálogo reverificado en la fuente",
    reverifiedDetail: (v: number, u: number) => `${v} confirmados en su sitio oficial; ${u} sin confirmación en línea (se retiraron cartas no oficiales).`,
    closed: (n: number) => `${n} retirados: cerrados o no son restaurantes`,
  },
};

export function UpdatesView({ entries, locale }: { entries: UpdateEntry[]; locale: Locale }) {
  const c = COPY[locale];
  return (
    <main className="ds-page" lang={locale === "es" ? "es-MX" : undefined}>
      <div className="ds-kicker-row">
        <span className="ds-label">{c.kicker}</span>
        <span className="num">{entries[0] ? formatDate(entries[0].date, locale) : ""}</span>
      </div>
      <h1 className="ds-title">{c.title}</h1>
      <p className="ds-lede">{c.lede}</p>
      <div className="ds-stack">
        {entries.map((entry) => (
          <section key={entry.id} className="ds-panel" style={{ marginBottom: 16 }}>
            <div className="ds-panel-head">
              <span className="ds-label">
                {entry.kind === "added" ? c.added(entry.restaurants.length) : entry.kind === "closed" ? c.closed(entry.restaurants.length) : c.reverified}
              </span>
              <time className="num" dateTime={entry.date}>{formatDate(entry.date, locale)}</time>
            </div>
            {entry.kind === "reverified" && entry.counts ? (
              <p className="ds-prose" style={{ padding: "10px 12px", margin: 0 }}>
                {c.reverifiedDetail(entry.counts.verified, entry.counts.unverifiable)}
              </p>
            ) : (
              <ul className="ds-list">
                {entry.restaurants.map((restaurant) => (
                  <li key={restaurant.slug}>
                    {entry.kind === "closed" ? (
                      <span>{restaurant.name}</span>
                    ) : (
                      <Link prefetch={false} href={paths.restaurant(restaurant.slug, locale)} className="ds-link">{restaurant.name}</Link>
                    )}
                    {restaurant.note ? <span className="num"> · {restaurant.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
