import { menuHasPrices, menuNeedsRecheck, menuSummary } from "@/lib/restaurants/menu-publication";
import { formatCuisine, formatObserved, instagramHref, menuSourceUrl } from "@/lib/restaurants/format";
import type { SiteCollection, SiteRestaurant } from "@/lib/restaurants/types";
import { SITE_CITY, SITE_NAME } from "@/lib/site";
import { hoursSummary } from "@/lib/geo/hours";
import { formatDate, type Locale } from "@/lib/i18n";
import { foreignEquivalent } from "@/lib/currency";
import { priceArea } from "@/lib/restaurants/price-index";
import { bookingSentence, mealSentence, priceSentence, quickFacts } from "@/lib/restaurants/quick-facts";
import { pesos } from "@/lib/restaurants/stats";

export type FactFaq = {
  question: string;
  answer: string;
};

export const COLLECTION_TYPE_LABEL: Record<string, string> = {
  neighborhood: "neighborhood",
  borough: "borough",
  cuisine: "cuisine",
  distinction: "distinction",
};

function placeName(restaurant: SiteRestaurant) {
  return (
    restaurant.location.neighborhood?.trim() ||
    restaurant.location.borough?.trim() ||
    SITE_CITY
  );
}

function cuisineLabel(restaurant: SiteRestaurant) {
  return (
    formatCuisine(restaurant.food.michelinCuisine) ||
    formatCuisine(restaurant.food.cuisine)
  );
}

export function postalCodeFromAddress(address: string | null | undefined) {
  const match = address?.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

export function restaurantPlace(restaurant: SiteRestaurant) {
  return placeName(restaurant);
}

// Search titles start with what people type ("<name> menu", "menú de <name>") and the area;
// descriptions lead with the answer (cost per person, typical dish) and the check date.
const searchArea = (restaurant: SiteRestaurant) => priceArea(restaurant) ?? placeName(restaurant);
const yearOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 4) : null);

export function restaurantTitle(restaurant: SiteRestaurant) {
  const publication = restaurant.menu.publication;
  if (publication) {
    const priced = menuHasPrices(restaurant) && !menuNeedsRecheck(restaurant);
    const topic = priced ? `menu & prices (${yearOf(publication.checkedAt)})` : "menu";
    return `${restaurant.name} ${topic} — ${searchArea(restaurant)}, ${SITE_CITY}`;
  }
  return `${restaurant.name} — ${searchArea(restaurant)}, ${SITE_CITY}`;
}

// Search snippet: name and area first (they match the query), then what the page holds
// (the menu, how fresh it is, the cost per person) and only the links the record really has.
const DESCRIPTION_MAX = 155;

function joinList(items: string[], and: string) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

function describeRestaurant(restaurant: SiteRestaurant, locale: Locale) {
  const es = locale === "es";
  const facts = quickFacts(restaurant);
  const publication = restaurant.menu.publication;
  const area = searchArea(restaurant);
  // "Pizza del Perro Negro – Del Valle" already names its area.
  const head = restaurant.name.toLowerCase().includes(area.toLowerCase()) ? restaurant.name : `${restaurant.name}, ${area}`;
  const date = publication ? (es ? formatDate(publication.checkedAt, "es") : formatObserved(publication.checkedAt)) : null;

  let promise: string | null = null;
  if (publication) {
    if (publication.coverage === "dishes") {
      promise = es ? `platillos publicados por el restaurante, verificados el ${date}.` : `dishes published by the restaurant, checked ${date}.`;
    } else if (menuHasPrices(restaurant) && !menuNeedsRecheck(restaurant)) {
      promise = es ? `menú completo con precios, verificado el ${date}.` : `full menu with prices, checked ${date}.`;
    } else {
      promise = es ? `menú oficial, verificado el ${date}.` : `official menu, checked ${date}.`;
    }
  }

  const meal = (withForeign: boolean, short: boolean) => {
    if (!facts.meal) return null;
    const amount = pesos(facts.meal.estimate);
    if (es) return short ? `≈ ${amount} por persona.` : `Comer cuesta ≈ ${amount} por persona.`;
    if (short) return `About ${amount} per person.`;
    return `A meal is about ${amount} per person${withForeign ? ` (${foreignEquivalent(facts.meal.estimate)})` : ""}.`;
  };

  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const booking = facts.booking
    ? facts.booking.walkIn
      ? (es ? "sin reservación" : "walk-in only")
      : facts.booking.label === "Phone"
        ? (es ? "reservación por teléfono" : "booking by phone")
        : facts.booking.label === "Official site"
          ? (es ? "reservación en su sitio" : "booking on its website")
          : (es ? `reservación en ${capitalize(facts.booking.label)}` : `${capitalize(facts.booking.label)} booking`)
    : null;
  const links = (withAddress: boolean, withHours: boolean) =>
    [
      instagramHref(restaurant.contact.instagram) ? "Instagram" : null,
      booking,
      withAddress && restaurant.location.address ? (es ? "dirección" : "address") : null,
      withHours && restaurant.experience.hours.length ? (es ? "horarios" : "hours") : null,
    ].filter((item): item is string => Boolean(item));

  type Shape = { hours: boolean; address: boolean; foreign: boolean; shortMeal: boolean; links: boolean };
  const build = (shape: Shape) => {
    const list = shape.links ? links(shape.address, shape.hours) : [];
    const listSentence = list.length ? `${capitalize(joinList(list, es ? "y" : "and"))}.` : null;
    if (!promise) {
      const opening = list.length ? `${head}: ${joinList(list, es ? "y" : "and")}.` : `${head}, ${es ? "Ciudad de México" : SITE_CITY}.`;
      return [opening, meal(shape.foreign, shape.shortMeal)].filter(Boolean).join(" ");
    }
    return [`${head}: ${promise}`, meal(shape.foreign, shape.shortMeal), listSentence].filter(Boolean).join(" ");
  };

  // Drop the least useful parts first until the snippet fits: hours, address, dollar/euro
  // equivalent, then the long price wording, then the list of links. The menu promise stays.
  const shapes: Shape[] = [
    { hours: true, address: true, foreign: true, shortMeal: false, links: true },
    { hours: false, address: true, foreign: true, shortMeal: false, links: true },
    { hours: false, address: false, foreign: true, shortMeal: false, links: true },
    { hours: false, address: false, foreign: false, shortMeal: false, links: true },
    { hours: false, address: false, foreign: false, shortMeal: true, links: true },
    { hours: false, address: false, foreign: false, shortMeal: true, links: false },
  ];
  let text = "";
  for (const shape of shapes) {
    text = build(shape);
    if (text.length <= DESCRIPTION_MAX) return text;
  }
  return text;
}

export function restaurantDescription(restaurant: SiteRestaurant) {
  return describeRestaurant(restaurant, "en");
}

export function restaurantLede(restaurant: SiteRestaurant) {
  const cuisine = cuisineLabel(restaurant);
  const bits = [
    `${restaurant.name} is a restaurant in ${placeName(restaurant)}, ${SITE_CITY}.`,
  ];
  if (restaurant.location.address) {
    bits.push(`Listed address: ${restaurant.location.address}.`);
  }
  if (cuisine) bits.push(`Observed cuisine: ${cuisine}.`);
  if (restaurant.distinctions.michelin) {
    bits.push(`Michelin distinction on file: ${restaurant.distinctions.michelin}.`);
  }
  if (restaurant.distinctions.worlds50BestList) {
    const rank = restaurant.distinctions.worlds50BestRank
      ? ` · ${restaurant.distinctions.worlds50BestRank}`
      : "";
    bits.push(
      `Also listed in ${restaurant.distinctions.worlds50BestList}${rank}.`,
    );
  }
  bits.push("Source-dated record. Not a review and not a booking engine.");
  return bits.join(" ");
}

function restaurantFaqsEs(restaurant: SiteRestaurant): FactFaq[] {
  const faqs: FactFaq[] = [];
  const name = restaurant.name;
  if (restaurant.location.address) {
    faqs.push({
      question: `¿Dónde está ${name} en la Ciudad de México?`,
      answer: `${name} está en ${restaurant.location.address}${restaurant.location.borough ? `, ${restaurant.location.borough}` : ""}. Zona: ${placeName(restaurant)}.`,
    });
  }
  const cuisine = cuisineLabel(restaurant);
  if (cuisine) faqs.push({ question: `¿Qué tipo de cocina tiene ${name}?`, answer: `Cocina registrada: ${cuisine}.` });
  if (restaurant.experience.hours.length > 0) {
    faqs.push({
      question: `¿Cuál es el horario de ${name}?`,
      answer: `Horario observado: ${restaurant.experience.hours.join("; ")}. Confírmalo en el sitio oficial antes de ir.`,
    });
  }
  const facts = quickFacts(restaurant);
  if (facts.meal || facts.price || facts.tastingMenus.length) {
    const tasting = facts.tastingMenus.map((menu) => `${menu.name}: ${pesos(menu.price)}`).join("; ");
    faqs.push({
      question: `¿Cuánto cuesta comer en ${name}?`,
      answer: [
        facts.meal ? mealSentence(name, facts.meal, restaurant.menu.publication?.checkedAt ?? null, "es") : null,
        facts.price ? priceSentence(name, facts.price, "es") : null,
        tasting ? `Menús: ${tasting}.` : null,
      ].filter(Boolean).join(" "),
    });
  }
  if (facts.booking) {
    faqs.push({ question: `¿Se necesita reservación en ${name}?`, answer: bookingSentence(name, facts.booking, "es") });
  }
  const menuUrl = menuSourceUrl(restaurant.menu.documents);
  if (menuUrl) faqs.push({ question: `¿Dónde puedo ver la carta de ${name}?`, answer: `Carta oficial: ${menuUrl}.` });
  if (restaurant.distinctions.michelin) {
    faqs.push({ question: `¿${name} tiene distinción Michelin?`, answer: `Sí. El registro indica: ${restaurant.distinctions.michelin}.` });
  }
  if (restaurant.contact.phone) {
    faqs.push({ question: `¿Cuál es el teléfono de ${name}?`, answer: `Teléfono: ${restaurant.contact.phone}.` });
  }
  return faqs;
}

export function restaurantFaqs(restaurant: SiteRestaurant, locale: Locale = "en"): FactFaq[] {
  if (locale === "es") return restaurantFaqsEs(restaurant);
  const faqs: FactFaq[] = [];
  const name = restaurant.name;
  const place = placeName(restaurant);

  if (restaurant.location.address) {
    faqs.push({
      question: `Where is ${name} in ${SITE_CITY}?`,
      answer: `${name} is at ${restaurant.location.address}${
        restaurant.location.borough ? `, ${restaurant.location.borough}` : ""
      }. Listed area: ${place}.`,
    });
  }

  const cuisine = cuisineLabel(restaurant);
  if (cuisine) {
    faqs.push({
      question: `What kind of cuisine is ${name}?`,
      answer: `On the record, the observed cuisine is ${cuisine}.`,
    });
  }

  if (restaurant.experience.hours.length > 0) {
    const observed = formatObserved(
      restaurant.verification.freshestSourceAt,
    );
    faqs.push({
      question: `What are the hours for ${name}?`,
      answer: `Observed hours: ${hoursSummary(restaurant.experience.hours)}.${
        observed ? ` Last observed ${observed}.` : ""
      } Confirm on the official site before going.`,
    });
  }

  const menuUrl = menuSourceUrl(restaurant.menu.documents);
  if (restaurant.menu.publication) {
    faqs.push({ question: `Where can I see the menu for ${name}?`, answer: `${menuSummary(restaurant)}${menuUrl ? ` Source: ${menuUrl}` : ""}` });
  } else if (menuUrl) {
    const observed = formatObserved(restaurant.menu.observedAt);
    faqs.push({
      question: `Where can I see the menu for ${name}?`,
      answer: `A source menu is at ${menuUrl}.${
        observed ? ` Last observed ${observed}.` : ""
      }`,
    });
  }

  const facts = quickFacts(restaurant);
  if (facts.meal || facts.price || facts.tastingMenus.length) {
    const tasting = facts.tastingMenus
      .map((menu) => `${menu.name}: ${pesos(menu.price)}`)
      .join("; ");
    faqs.push({
      question: `How much does it cost to eat at ${name}?`,
      answer: [
        facts.meal ? mealSentence(name, facts.meal, restaurant.menu.publication?.checkedAt ?? null) : null,
        facts.price ? priceSentence(name, facts.price) : null,
        tasting ? `Set menus: ${tasting}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (facts.booking) {
    faqs.push({
      question: `Do I need a reservation at ${name}?`,
      answer: bookingSentence(name, facts.booking),
    });
  }

  if (restaurant.distinctions.michelin) {
    faqs.push({
      question: `Does ${name} have a Michelin distinction?`,
      answer: `Yes. The record lists: ${restaurant.distinctions.michelin}.`,
    });
  }

  if (restaurant.contact.phone) {
    faqs.push({
      question: `What is the phone number for ${name}?`,
      answer: `Listed phone: ${restaurant.contact.phone}.`,
    });
  }

  return faqs;
}

export function collectionTypeLabel(type: string) {
  return COLLECTION_TYPE_LABEL[type] ?? type;
}

export function collectionTitle(collection: Pick<SiteCollection, "type" | "label">) {
  const kind = collectionTypeLabel(collection.type);
  return `${collection.label} in ${SITE_CITY}: restaurants by ${kind}`;
}

export function collectionDescription(
  collection: Pick<SiteCollection, "type" | "label" | "restaurantCount">,
) {
  const kind = collectionTypeLabel(collection.type);
  return `${collection.restaurantCount} restaurants from the ${SITE_NAME} catalog, grouped objectively by ${kind}: ${collection.label}, ${SITE_CITY}. Not an editorial ranking.`;
}

export function restaurantTitleEs(restaurant: SiteRestaurant) {
  const publication = restaurant.menu.publication;
  if (publication) {
    const priced = menuHasPrices(restaurant) && !menuNeedsRecheck(restaurant);
    const topic = priced ? `menú y precios ${yearOf(publication.checkedAt)}` : "menú";
    return `${restaurant.name}: ${topic} — ${searchArea(restaurant)}, CDMX`;
  }
  return `${restaurant.name} — ${searchArea(restaurant)}, CDMX`;
}

export function restaurantDescriptionEs(restaurant: SiteRestaurant) {
  return describeRestaurant(restaurant, "es");
}
