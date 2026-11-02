import { paths, type Locale } from "@/lib/i18n";
import { restaurantFaqs, postalCodeFromAddress } from "@/lib/geo/copy";
import { openingHoursFromRows } from "@/lib/geo/hours";
import { groupMenuItems, instagramHref, menuSourceUrl } from "@/lib/restaurants/format";
import { menuNeedsRecheck, menuSummary } from "@/lib/restaurants/menu-publication";
import { collectionHref } from "@/lib/restaurants/paths";
import { restaurantMealCost } from "@/lib/restaurants/quick-facts";
import { restaurantSources } from "@/lib/restaurants/sources";
import type {
  SiteCollectionRecord,
  SiteRestaurant,
} from "@/lib/restaurants/types";
import {
  PUBLIC_REPO_URL,
  SITE_CATALOG_ID,
  SITE_CITY,
  SITE_CITY_ES,
  SITE_CITY_SHORT,
  SITE_COUNTRY,
  SITE_COUNTRY_CODE,
  SITE_GEO,
  SITE_LOCALE,
  SITE_NAME,
  SITE_ORG_ID,
  SITE_TAGLINE,
  SITE_WEBSITE_ID,
  absoluteUrl,
  siteEntityId,
} from "@/lib/site";

function omitEmpty<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined || entry === "") return false;
      if (Array.isArray(entry) && entry.length === 0) return false;
      return true;
    }),
  );
}

function cityPlace() {
  return {
    "@type": "City",
    name: SITE_CITY,
    alternateName: [SITE_CITY_ES, SITE_CITY_SHORT],
    containedInPlace: {
      "@type": "Country",
      name: SITE_COUNTRY,
      addressCountry: SITE_COUNTRY_CODE,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE_GEO.latitude,
      longitude: SITE_GEO.longitude,
    },
  };
}

export function siteGraphJsonLd() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      omitEmpty({
        "@type": "Organization",
        "@id": siteEntityId(SITE_ORG_ID),
        name: SITE_NAME,
        alternateName: ["Mesa Says"],
        url,
        description: SITE_TAGLINE,
        slogan: SITE_TAGLINE,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/icon"),
          width: 192,
          height: 192,
        },
        image: absoluteUrl("/opengraph-image"),
        areaServed: cityPlace(),
        // Mesasays is an open project, not a brand's property: its own profile is the public code.
        // The Dining Dispatch stays credited on each film (RestaurantFilm), as a contributor.
        sameAs: ["https://github.com/mesasays", PUBLIC_REPO_URL],
        knowsAbout: [
          "Mexico City restaurants",
          "CDMX dining",
          "Mexico City restaurant intelligence",
        ],
      }),
      omitEmpty({
        "@type": "WebSite",
        "@id": siteEntityId(SITE_WEBSITE_ID),
        url,
        name: SITE_NAME,
        description: SITE_TAGLINE,
        inLanguage: SITE_LOCALE,
        isAccessibleForFree: true,
        publisher: { "@id": siteEntityId(SITE_ORG_ID) },
        about: cityPlace(),
      }),
      omitEmpty({
        "@type": "DataCatalog",
        "@id": siteEntityId(SITE_CATALOG_ID),
        name: `Restaurant catalog · ${SITE_CITY}`,
        url: absoluteUrl("/restaurants"),
        inLanguage: SITE_LOCALE,
        spatialCoverage: cityPlace(),
        isAccessibleForFree: true,
        publisher: { "@id": siteEntityId(SITE_ORG_ID) },
        isPartOf: { "@id": siteEntityId(SITE_WEBSITE_ID) },
      }),
    ],
  };
}

export function restaurantJsonLd(restaurant: SiteRestaurant, locale: Locale = "en") {
  const url = absoluteUrl(paths.restaurant(restaurant.slug, locale));
  const instagram = instagramHref(restaurant.contact.instagram);
  const menuUrl = menuSourceUrl(restaurant.menu.documents);
  const menuNode = publishedMenuJsonLd(restaurant);
  const cuisine = [
    restaurant.food.michelinCuisine,
    restaurant.food.cuisine,
  ].filter((value): value is string => Boolean(value));
  const hours = openingHoursFromRows(restaurant.experience.hours);
  const faqs = restaurantFaqs(restaurant, locale);
  const postalCode = postalCodeFromAddress(restaurant.location.address);
  const meal = restaurantMealCost(restaurant);

  const restaurantNode = omitEmpty({
    "@type": "Restaurant",
    "@id": `${url}#restaurant`,
    name: restaurant.name,
    url,
    inLanguage: locale,
    telephone: restaurant.contact.phone,
    servesCuisine: cuisine.length === 1 ? cuisine[0] : cuisine,
    // Per-person estimate from the official menu only; no estimate, no price range.
    priceRange: meal
      ? `${meal.low === meal.high ? meal.estimate : `${meal.low}–${meal.high}`} MXN per person`
      : undefined,
    currenciesAccepted: "MXN",
    hasMenu: restaurant.menu.publication ? (menuNode ? { "@id": `${url}#menu` } : undefined) : menuUrl,
    sameAs: [restaurant.contact.website, instagram].filter(Boolean),
    hasMap: restaurant.contact.googleMapsUrl ?? undefined,
    address: restaurant.location.address
      ? omitEmpty({
          "@type": "PostalAddress",
          streetAddress: restaurant.location.address,
          addressLocality: SITE_CITY,
          addressRegion: restaurant.location.borough ?? SITE_CITY_SHORT,
          postalCode,
          addressCountry: SITE_COUNTRY_CODE,
        })
      : undefined,
    geo:
      restaurant.location.coordinates?.latitude != null &&
      restaurant.location.coordinates?.longitude != null
        ? {
            "@type": "GeoCoordinates",
            latitude: restaurant.location.coordinates.latitude,
            longitude: restaurant.location.coordinates.longitude,
          }
        : undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    areaServed: cityPlace(),
    containedInPlace: restaurant.location.neighborhood
      ? {
          "@type": "Place",
          name: restaurant.location.neighborhood,
          containedInPlace: cityPlace(),
        }
      : cityPlace(),
    isPartOf: { "@id": siteEntityId(SITE_CATALOG_ID) },
    publisher: { "@id": siteEntityId(SITE_ORG_ID) },
  });

  const graph: unknown[] = [
    omitEmpty({
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: restaurant.name,
      mainEntity: { "@id": `${url}#restaurant` },
      isPartOf: { "@id": siteEntityId(SITE_WEBSITE_ID) },
      citation: restaurantSources(restaurant).map((source) => ({
        "@type": "CreativeWork", url: source.url,
      })),
    }),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
        {
          "@type": "ListItem",
          position: 2,
          name: "Restaurants",
          item: absoluteUrl("/restaurants"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: restaurant.name,
          item: url,
        },
      ],
    },
    restaurantNode,
    ...(menuNode ? [menuNode] : []),
  ];

  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      inLanguage: locale,
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function publishedMenuJsonLd(restaurant: SiteRestaurant) {
  const review = restaurant.menu.publication;
  // Individual social posts do not establish a current restaurant menu.
  if (!review || review.coverage === "dishes" || menuNeedsRecheck(restaurant)) return null;
  const url = absoluteUrl(`/restaurants/${restaurant.slug}#menu`);
  return omitEmpty({
    "@type": "Menu",
    "@id": url,
    url,
    name: `${restaurant.name} menu`,
    description: menuSummary(restaurant),
    inLanguage: review.language,
    dateModified: review.checkedAt,
    citation: menuSourceUrl(restaurant.menu.documents),
    hasMenuSection: groupMenuItems(restaurant.menu.items).map(([name, items]) => ({
      "@type": "MenuSection",
      name: name || "Dishes",
      hasMenuItem: items.map((item) => omitEmpty({
        "@type": "MenuItem",
        name: item.name,
        description: item.description,
        url: item.sourceUrl,
        offers: item.price !== null ? {
          "@type": "Offer", price: item.price, priceCurrency: item.currency ?? "MXN", url: item.sourceUrl,
        } : undefined,
      })),
    })),
    offers: review.pricing?.map((price) => ({
      "@type": "Offer", name: price.name, price: price.price,
      priceCurrency: price.currency, url: menuSourceUrl(restaurant.menu.documents),
    })),
  });
}

export function collectionJsonLd(collection: SiteCollectionRecord) {
  const url = absoluteUrl(collectionHref(collection));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
          {
            "@type": "ListItem",
            position: 2,
            name: "Collections",
            item: absoluteUrl("/collections"),
          },
          { "@type": "ListItem", position: 3, name: collection.label, item: url },
        ],
      },
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: collection.label,
        inLanguage: SITE_LOCALE,
        isPartOf: { "@id": siteEntityId(SITE_WEBSITE_ID) },
        about: cityPlace(),
        mainEntity: { "@id": `${url}#list` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: collection.label,
        url,
        numberOfItems: collection.restaurants.length,
        itemListOrder: "https://schema.org/ItemListUnordered",
        itemListElement: collection.restaurants.map((restaurant, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absoluteUrl(`/restaurants/${restaurant.slug}`),
          name: restaurant.name,
        })),
      },
    ],
  };
}

export function catalogJsonLd(
  count: number,
  restaurants: Array<{ slug: string; name: string }> = [],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Restaurants in ${SITE_CITY}`,
    url: absoluteUrl("/restaurants"),
    numberOfItems: count,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: restaurants.map((restaurant, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(`/restaurants/${restaurant.slug}`),
      name: restaurant.name,
    })),
  };
}

export function collectionsIndexJsonLd(
  collections: Array<{ type: string; slug: string; label: string; restaurantCount: number }>,
) {
  const url = absoluteUrl("/collections");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `Restaurant collections in ${SITE_CITY}`,
        inLanguage: SITE_LOCALE,
        isPartOf: { "@id": siteEntityId(SITE_WEBSITE_ID) },
        about: cityPlace(),
        mainEntity: { "@id": `${url}#list` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: `Restaurant collections in ${SITE_CITY}`,
        url,
        numberOfItems: collections.length,
        itemListOrder: "https://schema.org/ItemListUnordered",
        itemListElement: collections.map((collection, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absoluteUrl(collectionHref(collection)),
          name: collection.label,
        })),
      },
    ],
  };
}
