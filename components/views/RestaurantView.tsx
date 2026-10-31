import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantFilm } from "@/components/RestaurantFilm";
import { RestaurantCard } from "@/components/RestaurantCard";
import { RestaurantQuickFacts } from "@/components/RestaurantQuickFacts";
import { RestaurantTiles, type RestaurantTile } from "@/components/RestaurantTiles";
import { SayBlock } from "@/components/say/Say";
import { paths, t, type Locale } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/jsonld";
import type { Film } from "@/lib/restaurants/films";
import { formatPriceLevel } from "@/lib/restaurants/format";
import { cuisineDisplay } from "@/lib/restaurants/price-index";
import { sayPlace } from "@/lib/say/load";
import type { SiteRestaurant } from "@/lib/restaurants/types";

export function RestaurantView({
  restaurant,
  nearby,
  sameCuisine = [],
  films,
  locale,
  dishLinks = [],
}: {
  restaurant: SiteRestaurant;
  nearby: RestaurantTile[];
  sameCuisine?: RestaurantTile[];
  films: Film[];
  locale: Locale;
  dishLinks?: Array<{ slug: string; name: string; nameEs: string }>;
}) {
  const s = t(locale);
  return (
    <main className="ds-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={restaurantJsonLd(restaurant, locale)} />
      {/* Name first: the reader confirms the place before reading its numbers. */}
      <section className="ds-panel" style={{ marginBottom: 16 }}>
        <div className="ds-panel-head">
          <span className="ds-label">{cuisineDisplay(restaurant, locale) ?? s.restaurants}</span>
          <span className="num">{formatPriceLevel(restaurant.food.priceLevel) ?? "\u00a0"}</span>
        </div>
        <div className="ds-pad ds-card-title">
          <h1 className="ds-title">{restaurant.name}</h1>
        </div>
      </section>
      <RestaurantQuickFacts restaurant={restaurant} locale={locale} />
      {films.map((film) => (
        <RestaurantFilm key={film.videoId} film={film} restaurantName={restaurant.name} locale={locale} />
      ))}
      {/* What people say sits between the film and the menu; the menu itself is unchanged. */}
      <SayBlock place={sayPlace(restaurant)} lang={locale} />
      <RestaurantCard restaurant={restaurant} variant="page" locale={locale} showTitle={false} />

      {/* Links that help readers (and crawlers) move on, kept light: one line of dishes, nearby and same-cuisine tiles. */}
      {dishLinks.length > 0 ? (
        <p className="ds-inline-links num">
          <span className="ds-label">{s.alsoOnMenu}</span>{" "}
          {dishLinks.map((dish, index) => (
            <span key={dish.slug}>
              {index ? " · " : ""}
              <Link href={paths.dish(dish.slug, locale) as never} className="ds-link">
                {locale === "es" ? dish.nameEs : dish.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      {nearby.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <p className="ds-label" style={{ margin: "0 0 8px" }}>{s.nearby}</p>
          <RestaurantTiles tiles={nearby} locale={locale} />
        </section>
      ) : null}

      {sameCuisine.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <p className="ds-label" style={{ margin: "0 0 8px" }}>{s.sameCuisine}</p>
          <RestaurantTiles tiles={sameCuisine} locale={locale} />
        </section>
      ) : null}
    </main>
  );
}
