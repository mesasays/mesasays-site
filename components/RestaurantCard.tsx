import type { ReactNode } from "react";
import { publicUrl } from "@/lib/public-url";
import Link from "next/link";
import { RestaurantMenu } from "@/components/RestaurantMenu";
import { ReportError } from "@/components/ReportError";
import { RestaurantSources } from "@/components/RestaurantSources";
import { formatHoursRow } from "@/lib/geo/hours";
import {
  formatCuisine,
  formatObserved,
  instagramHandle,
  instagramHref,
  mapsHref,
  menuSourceUrl,
  reservationBookings,
} from "@/lib/restaurants/format";
import { cuisineDisplay } from "@/lib/restaurants/price-index";
import { restaurantBooking, restaurantMealCost, restaurantPriceSymbol } from "@/lib/restaurants/quick-facts";
import { pesos } from "@/lib/restaurants/stats";
import type { SiteRestaurant } from "@/lib/restaurants/types";
import { formatDate, paths, t, type Locale } from "@/lib/i18n";

function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="ms-fact">
      <span className="ms-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function External({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

export function RestaurantCard({
  restaurant,
  variant = "card",
  hrefHash,
  locale = "en",
  showTitle = true,
  filmUrl = null,
}: {
  restaurant: SiteRestaurant;
  /** card: compact list entry (who, what, how much, book); page: the full record. */
  variant?: "card" | "page";
  hrefHash?: string;
  locale?: Locale;
  showTitle?: boolean;
  /** Documentary by The Dining Dispatch about this restaurant, when there is one. */
  filmUrl?: string | null;
}) {
  const s = t(locale);
  const observed = (value: string | null | undefined) =>
    locale === "en" ? formatObserved(value) : formatDate(value, locale);
  const cuisine = cuisineDisplay(restaurant, locale) ?? formatCuisine(restaurant.food.cuisine);
  const compact = variant === "card";
  const meal = compact ? restaurantMealCost(restaurant) : null;
  const price = restaurantPriceSymbol(restaurant);
  const maps = mapsHref({
    googleMapsUrl: restaurant.contact.googleMapsUrl,
    address: restaurant.location.address,
  });
  const instagram = instagramHref(restaurant.contact.instagram);
  const handle = instagramHandle(restaurant.contact.instagram);
  const bookings = reservationBookings({
    openTableUrl: restaurant.reservation.openTableUrl,
    links: restaurant.reservation.links,
    extra: restaurant.links,
  });
  const menuUrl = menuSourceUrl(restaurant.menu.documents);
  // Same booking channel as the quick answers; Instagram gets its own button unless it is the booking channel.
  const channel = restaurantBooking(restaurant);
  const booking = channel?.url && !channel.walkIn ? channel.url : bookings[0]?.url ?? null;
  const website = publicUrl(restaurant.contact.website);
  const igButton = instagram && !(booking && /instagram\.com/.test(booking)) ? instagram : null;
  const showMenuButton = Boolean(menuUrl) && !(variant === "page" && restaurant.menu.publication);
  const michelin = restaurant.distinctions.michelin;
  const fiftyBest = restaurant.distinctions.worlds50Best
    ? [restaurant.distinctions.worlds50BestList, restaurant.distinctions.worlds50BestRank]
        .filter(Boolean)
        .join(" · ") || s.listed
    : null;
  const hasDistinctions = Boolean(
    michelin || fiftyBest || restaurant.distinctions.bibGourmand,
  );
  const TitleTag = variant === "page" ? "h1" : "h2";
  const title = (
    <TitleTag className={variant === "page" ? "ms-title" : "ms-card-name"}>
      {restaurant.name}
    </TitleTag>
  );

  return (
    <article className="ms-box">
      {showTitle ? (
      <div className="ms-box-head">
        <span className="ms-label">
          {restaurant.location.neighborhood ?? "Mexico City"}
        </span>
        <span className="ms-num">{price ?? "\u00a0"}</span>
      </div>
      ) : null}

      {showTitle ? (
      <div className="ms-inset ms-card-title">
        {variant === "page" ? (
          title
        ) : (
          <Link
            href={`${paths.restaurant(restaurant.slug, locale)}${hrefHash ? `#${hrefHash}` : ""}`}
            className="ms-card-link"
          >
            {title}
          </Link>
        )}
      </div>
      ) : null}

      {compact ? (
        <>
          <Row label={s.cuisine} value={cuisine} />
          <Row
            label={s.mealForOne}
            value={meal ? <strong className="ms-meal-price">≈ {pesos(meal.estimate)}</strong> : null}
          />
          <Row label="Michelin" value={michelin} />
          {!michelin ? <Row label="World's 50 Best" value={fiftyBest} /> : null}
          <Row
            label={locale === "es" ? "Película" : "Film"}
            value={filmUrl ? <External href={filmUrl} className="ms-link">The Dining Dispatch ↗</External> : null}
          />
        </>
      ) : null}

      {variant === "page" ? <RestaurantMenu restaurant={restaurant} locale={locale} /> : null}

      {compact ? null : (
        <>
      <Row
        label={s.address}
        value={
          restaurant.location.address && maps ? (
            <External href={maps} className="ms-link">
              {restaurant.location.address}
            </External>
          ) : (
            restaurant.location.address
          )
        }
      />

      <Row
        label={s.phone}
        value={
          restaurant.contact.phone ? (
            <a className="ms-link" href={`tel:${restaurant.contact.phone.replace(/\s+/g, "")}`}>
              {restaurant.contact.phone}
            </a>
          ) : null
        }
      />
      <Row
        label={s.website}
        value={
          website ? (
            <External href={website} className="ms-link">
              {s.officialSite}
            </External>
          ) : instagram ? (
            // Instagram-only restaurants: their Instagram account is the official page.
            <External href={instagram} className="ms-link">
              Instagram · {handle}
            </External>
          ) : null
        }
      />
      <Row
        label="Instagram"
        value={
          instagram && website ? (
            <External href={instagram} className="ms-link">
              {handle}
            </External>
          ) : null
        }
      />

      {restaurant.experience.hours.length > 0 ? (
        <details className="ms-fold">
          <summary>
            <span className="ms-label">{s.hours}</span>
            <span className="ms-fold-chevron" aria-hidden="true" />
          </summary>
          <div className="ms-hours">
            {restaurant.experience.hours.map((row) => (
              <span key={row}>{formatHoursRow(row)}</span>
            ))}
          </div>
        </details>
      ) : null}

      <Row label={s.cuisine} value={cuisine} />
      <Row label={s.price} value={price ? <span className="ms-num">{price}</span> : null} />

      {hasDistinctions ? (
        <>
          <Row label="Michelin" value={michelin} />
          <Row label="World's 50 Best" value={fiftyBest} />
          {restaurant.distinctions.bibGourmand ? (
            <Row label="Bib Gourmand" value={s.yes} />
          ) : null}
        </>
      ) : null}

      {variant === "page" ? (
        <>
          <RestaurantSources restaurant={restaurant} locale={locale} />
          <Row
            label={s.lastObserved}
            value={observed(restaurant.verification.freshestSourceAt)}
          />
          <ReportError name={restaurant.name} slug={restaurant.slug} locale={locale} />
        </>
      ) : (
        <Row
          label={s.lastObserved}
          value={observed(restaurant.verification.freshestSourceAt)}
        />
      )}

        </>
      )}

      {/* On the record page, booking/call/Instagram live in the quick answers; only the source menu link stays here. */}
      {showMenuButton || (compact && (booking || igButton)) ? (
        <div className="ms-actions">
          {showMenuButton ? (
            restaurant.menu.publication ? (
              <Link href={`${paths.restaurant(restaurant.slug, locale)}#menu`} className="ms-button">{s.menu}</Link>
            ) : <External href={menuUrl!} className="ms-button">{s.menuSource}</External>
          ) : null}
          {compact && booking ? (
            <External href={booking} className="ms-button ms-button-book">
              Booking
            </External>
          ) : null}
          {compact && igButton ? (
            <External href={igButton} className="ms-button ms-button-ig">Instagram</External>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
