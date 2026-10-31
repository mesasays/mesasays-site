import { formatObserved } from "@/lib/restaurants/format";
import { isPublicUrl } from "@/lib/public-url";
import { restaurantSources } from "@/lib/restaurants/sources";
import type { SiteRestaurant } from "@/lib/restaurants/types";
import { formatDate, t, type Locale } from "@/lib/i18n";

export function RestaurantSources({ restaurant, locale = "en" }: { restaurant: SiteRestaurant; locale?: Locale }) {
  const s = t(locale);
  const sources = restaurantSources(restaurant);
  if (!sources.length) return null;
  return (
    <details className="ds-hours">
      <summary>
        <span className="ds-label">{s.sources(sources.length)}</span>
        <span className="ds-hours-arrow" aria-hidden="true" />
      </summary>
      <ul className="ds-list ds-pad">
        {sources.filter((source) => isPublicUrl(source.url)).map((source) => (
          <li key={source.url}>
            <a href={source.url} className="ds-link" target="_blank" rel="noreferrer">
              {source.label}
            </a>
            {source.recordedAt ? <span> · {s.recorded} {locale === "en" ? formatObserved(source.recordedAt) : formatDate(source.recordedAt, locale)}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
