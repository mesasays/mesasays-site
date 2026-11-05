import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantFilm } from "@/components/RestaurantFilm";
import { RestaurantCard } from "@/components/RestaurantCard";
import { RestaurantQuickFacts } from "@/components/RestaurantQuickFacts";
import { RestaurantTiles, type RestaurantTile } from "@/components/RestaurantTiles";
import { paths, t, type Locale } from "@/lib/i18n";
import { restaurantJsonLd } from "@/lib/jsonld";
import type { Film } from "@/lib/restaurants/films";
import { cuisineDisplay } from "@/lib/restaurants/price-index";
import { restaurantPriceSymbol } from "@/lib/restaurants/quick-facts";
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
    <main className="ms-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={restaurantJsonLd(restaurant, locale)} />
      {/* Name first: the reader confirms the place before reading its numbers. */}
      <section className="ms-box" style={{ marginBottom: 16 }}>
        <div className="ms-box-head">
          <span className="ms-label">{cuisineDisplay(restaurant, locale) ?? s.restaurants}</span>
          <span className="ms-num">{restaurantPriceSymbol(restaurant) ?? "\u00a0"}</span>
        </div>
        <div className="ms-inset ms-card-title">
          <h1 className="ms-title">{restaurant.name}</h1>
        </div>
      </section>
      <RestaurantQuickFacts restaurant={restaurant} locale={locale} />
      {films.map((film) => (
        <RestaurantFilm key={film.videoId} film={film} restaurantName={restaurant.name} locale={locale} />
      ))}
      {/* Say is paused (2026-11-05): its block (components/say/Say.tsx, SayBlock + sayPlace) is kept, not rendered. */}
      <RestaurantCard restaurant={restaurant} variant="page" locale={locale} showTitle={false} />

      {/* Links that help readers (and crawlers) move on, kept light: one line of dishes, nearby and same-cuisine tiles. */}
      {dishLinks.length > 0 ? (
        <p className="ms-inline-links ms-num">
          <span className="ms-label">{s.alsoOnMenu}</span>{" "}
          {dishLinks.map((dish, index) => (
            <span key={dish.slug}>
              {index ? " · " : ""}
              <Link href={paths.dish(dish.slug, locale) as never} className="ms-link">
                {locale === "es" ? dish.nameEs : dish.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      {nearby.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <p className="ms-label" style={{ margin: "0 0 8px" }}>{s.nearby}</p>
          <RestaurantTiles tiles={nearby} locale={locale} />
        </section>
      ) : null}

      {sameCuisine.length > 0 ? (
        <section style={{ marginTop: 24 }}>
          <p className="ms-label" style={{ margin: "0 0 8px" }}>{s.sameCuisine}</p>
          <RestaurantTiles tiles={sameCuisine} locale={locale} />
        </section>
      ) : null}
    </main>
  );
}
