import { formatObserved, menuSourceUrl } from "@/lib/restaurants/format";
import { isPublicUrl } from "@/lib/public-url";
import { menuCoverageLabel, menuNeedsRecheck, menuPriceText } from "@/lib/restaurants/menu-publication";
import type { MenuItem, SiteRestaurant } from "@/lib/restaurants/types";
import { coverageLabel, formatDate, t, type Locale } from "@/lib/i18n";

export function RestaurantMenu({ restaurant, locale = "en" }: { restaurant: SiteRestaurant; locale?: Locale }) {
  const s = t(locale);
  const date = (value: string | null | undefined) => (locale === "en" ? formatObserved(value) : formatDate(value, locale));
  const review = restaurant.menu.publication;
  if (!review) return null;
  const source = menuSourceUrl(restaurant.menu.documents);
  const items = restaurant.menu.items;
  const stale = menuNeedsRecheck(restaurant);
  const rows = (entries: MenuItem[]) => entries.map((item) => (
    <li key={item.id} className="ds-menu-item">
      <span>
        <span lang={review.language}>{item.name}</span>
        {item.description ? <span className="ds-menu-detail" lang={review.language}>{item.description}</span> : null}
        {review.coverage === "dishes" && isPublicUrl(item.sourceUrl) ? (
          <a className="ds-menu-proof" href={item.sourceUrl} target="_blank" rel="noreferrer">
            {s.originalPost}{item.observedAt ? ` · ${s.checked} ${date(item.observedAt)}` : ""} <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </span>
      {item.price !== null ? <span className="ds-menu-price">{menuPriceText(item.price, item.currency ?? "MXN")}</span> : null}
    </li>
  ));

  return (
    <section id="menu" aria-labelledby="restaurant-menu-title" className="ds-restaurant-menu">
      <div className="ds-menu-heading">
        <h2 id="restaurant-menu-title">{review.coverage === "dishes" ? s.menuUpdates : s.menu}</h2>
        <span className="ds-label">{locale === "en" ? menuCoverageLabel(restaurant) : coverageLabel(review.coverage, locale)}</span>
      </div>
      {/* The source note (how the menu was transcribed) lives in the data and /facts files, not on screen. */}
      <p className="ds-menu-date">
        {review.sourceDate ? <>{s.menuDated} {date(review.sourceDate)} · </> : null}
        {s.sourceChecked} <time dateTime={review.checkedAt}>{date(review.checkedAt)}</time>
        {source ? <> · <a href={source} target="_blank" rel="noreferrer">{locale === "es" ? "Carta oficial" : review.sourceLabel} <span aria-hidden="true">↗</span></a></> : null}
      </p>
      {stale ? <p className="ds-menu-note"><strong>{s.recheckDueLong}</strong> {s.recheckDueDetail}</p> : null}
      {review.pricing?.length ? (
        <ul className="ds-menu-list ds-menu-formulas">
          {review.pricing.map((price) => (
            <li key={price.name} className="ds-menu-item">
              <span>{price.name}</span><span className="ds-menu-price">{menuPriceText(price.price, price.currency)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length ? <ul className="ds-menu-list">{rows(items.slice(0, 6))}</ul> : null}
      {items.length > 6 ? (
        <details className="ds-menu-more">
          <summary>{s.viewAllDishes(items.length)}</summary>
          <ul className="ds-menu-list">{rows(items.slice(6))}</ul>
        </details>
      ) : null}
    </section>
  );
}
