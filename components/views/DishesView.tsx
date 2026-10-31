import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RestaurantTiles, type RestaurantTile } from "@/components/RestaurantTiles";
import { paths, type Locale } from "@/lib/i18n";
import type { DishSummary } from "@/lib/restaurants/dishes";
import { pesos } from "@/lib/restaurants/stats";
import { absoluteUrl } from "@/lib/site";

const COPY = {
  en: {
    kicker: "Mexico City · dishes",
    count: (n: number) => `${n} dishes`,
    title: "Find a dish",
    lede: "Pick a dish to see every restaurant in our catalog that lists it on its official menu, the printed price, and when we checked it.",
    dish: "Dish",
    restaurants: "Restaurants",
    median: "Cheapest version, median",
    medianShort: "typically",
    lowest: "Lowest",
    back: "Dishes",
    restaurantsCount: (n: number) => `${n} restaurants`,
    dishTitle: (name: string) => `${name} in Mexico City`,
    from: "from",
    dishLede: (n: number, name: string) => `${n} restaurants list ${name.toLowerCase()} on their official menu.`,
    dishMedian: (median: string) => ` At half of them, the cheapest version costs ${median} or less`,
    dishLowest: (price: string, item: string, restaurant: string) => `; the lowest price we found is ${price} (${item}, ${restaurant})`,
    dishNote: " Prices are as printed on each official menu (portions differ); tap a restaurant for the full menu.",
    restaurant: "Restaurant",
    onMenu: "On the menu",
    price: "Price",
    area: "Area",
    checked: "Checked",
    notPriced: "not priced",
  },
  es: {
    kicker: "Ciudad de México · platillos",
    count: (n: number) => `${n} platillos`,
    title: "Busca un platillo",
    lede: "Elige un platillo para ver qué restaurantes de nuestro catálogo lo tienen en su carta oficial, el precio publicado y cuándo lo verificamos.",
    dish: "Platillo",
    restaurants: "Restaurantes",
    median: "Versión más barata, mediana",
    medianShort: "en general",
    lowest: "Desde",
    back: "Platillos",
    restaurantsCount: (n: number) => `${n} restaurantes`,
    dishTitle: (name: string) => `${name} en la Ciudad de México`,
    from: "desde",
    dishLede: (n: number, name: string) => `${n} restaurantes tienen ${name.toLowerCase()} en su carta oficial.`,
    dishMedian: (median: string) => ` En la mitad de ellos, la versión más barata cuesta ${median} o menos`,
    dishLowest: (price: string, item: string, restaurant: string) => `; el precio más bajo que encontramos es ${price} (${item}, ${restaurant})`,
    dishNote: " Precios tal como aparecen en cada carta oficial (las porciones varían); toca un restaurante para ver su carta completa.",
    restaurant: "Restaurante",
    onMenu: "En la carta",
    price: "Precio",
    area: "Zona",
    checked: "Verificado",
    notPriced: "sin precio",
  },
};

const dishName = (dish: DishSummary, locale: Locale) => (locale === "es" ? dish.nameEs : dish.name);

export function DishesIndexView({ dishes, locale }: { dishes: DishSummary[]; locale: Locale }) {
  const c = COPY[locale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.title,
    inLanguage: locale === "es" ? "es-MX" : "en",
    itemListElement: dishes.map((dish, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: dishName(dish, locale),
      url: absoluteUrl(paths.dish(dish.slug, locale)),
    })),
  };
  return (
    <main className="ds-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={jsonLd} />
      <div className="ds-kicker-row">
        <span className="ds-label">{c.kicker}</span>
        <span className="num">{c.count(dishes.length)}</span>
      </div>
      <h1 className="ds-title">{c.title}</h1>
      {/* Same boxed tiles as the restaurant lists: the whole box is the link. */}
      <ul className="ds-tiles">
        {dishes.map((dish) => (
          <li key={dish.slug}>
            <Link prefetch={false} href={paths.dish(dish.slug, locale)} className="ds-tile">
              <strong className="ds-tile-name">{dishName(dish, locale)}</strong>
              <span className="ds-tile-meta">{c.restaurantsCount(dish.restaurants)}</span>
              {dish.minPrice !== null ? <span className="ds-tile-note">{c.lowest} {pesos(dish.minPrice)}</span> : null}
              <span className="ds-tile-price">{dish.medianPrice !== null ? `${c.medianShort} ${pesos(dish.medianPrice)}` : "\u00a0"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** One tile per restaurant: its cheapest version of the dish, as printed, cheapest first. */
function dishTiles(dish: DishSummary, locale: Locale): RestaurantTile[] {
  const byRestaurant = new Map<string, DishSummary["offers"]>();
  for (const offer of dish.offers) byRestaurant.set(offer.restaurantSlug, [...(byRestaurant.get(offer.restaurantSlug) ?? []), offer]);
  const from = locale === "es" ? "desde" : "from";
  return [...byRestaurant.values()]
    .map((offers) => {
      const priced = offers.filter((offer) => offer.price !== null).sort((a, b) => a.price! - b.price!);
      const first = priced[0] ?? offers[0];
      const more = offers.length - 1;
      return {
        slug: first.restaurantSlug,
        name: first.restaurantName,
        cuisine: null,
        area: first.area,
        price: first.price,
        note: `${first.itemName}${more > 0 ? ` (+${more})` : ""}`,
        priceLabel: first.price !== null ? `${more > 0 ? `${from} ` : ""}${pesos(first.price)}` : COPY[locale].notPriced,
      };
    })
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.name.localeCompare(b.name));
}

export function DishView({ dish, locale }: { dish: DishSummary; locale: Locale }) {
  const c = COPY[locale];
  const name = dishName(dish, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: c.dishTitle(name),
    inLanguage: locale === "es" ? "es-MX" : "en",
    url: absoluteUrl(paths.dish(dish.slug, locale)),
    itemListElement: dish.offers.map((offer, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "MenuItem",
        name: offer.itemName,
        ...(offer.price !== null ? { offers: { "@type": "Offer", price: offer.price, priceCurrency: "MXN" } } : {}),
        isPartOf: { "@type": "Restaurant", name: offer.restaurantName, url: absoluteUrl(paths.restaurant(offer.restaurantSlug, locale)) },
      },
    })),
  };
  return (
    <main className="ds-page" lang={locale === "es" ? "es-MX" : undefined}>
      <JsonLd data={jsonLd} />
      <div className="ds-kicker-row">
        <Link prefetch={false} href={paths.dishes(locale)} className="ds-link">{c.back}</Link>
      </div>
      <h1 className="ds-title">{c.dishTitle(name)}</h1>
      <p className="ds-lede num">
        {c.restaurantsCount(dish.restaurants)}
        {dish.minPrice !== null ? ` · ${c.from} ${pesos(dish.minPrice)}` : ""}
      </p>
      <RestaurantTiles tiles={dishTiles(dish, locale)} locale={locale} />
    </main>
  );
}
