import { hoursSummary } from "@/lib/geo/hours";
import { publicUrl } from "@/lib/public-url";
import {
  formatObserved,
  instagramHandle,
  platformLabel,
  reservationBookings,
} from "@/lib/restaurants/format";
import { menuCoverageLabel, menuNeedsRecheck } from "@/lib/restaurants/menu-publication";
import { foreignEquivalent } from "@/lib/currency";
import { estimateMealCost, type MealCost } from "@/lib/restaurants/meal-cost";
import {
  pesos,
  restaurantPriceStats,
  tastingMenuPrices,
  verifiedFoodItems,
  type PriceStats,
} from "@/lib/restaurants/stats";
import type { SiteRestaurant } from "@/lib/restaurants/types";
import { formatDate, type Locale } from "@/lib/i18n";

// One source for the short answers shown at the top of a restaurant page,
// repeated in the FAQ JSON-LD and llms-full.txt so every reader gets the same facts.

export type Booking = {
  label: string;
  url: string | null;
  phone: string | null;
  walkIn: boolean;
  checkedAt: string | null;
};

export type QuickFacts = {
  meal: MealCost | null;
  price: PriceStats | null;
  tastingMenus: Array<{ name: string; price: number }>;
  booking: Booking | null;
  hours: string | null;
  menu: { label: string; checkedAt: string; overdue: boolean } | null;
  instagram: string | null;
};

export function restaurantBooking(restaurant: SiteRestaurant): Booking | null {
  const channel = restaurant.reservation.channel;
  if (channel) {
    const platform = channel.platform.toLowerCase();
    const url = publicUrl(channel.url);
    const walkIn = /walk-in|queue/.test(platform) && !url;
    return {
      label: walkIn ? "Walk-in" : platformLabel(channel.platform.split("/")[0].trim()),
      url,
      phone: channel.phone ?? (platform === "phone" ? restaurant.contact.phone : null),
      walkIn,
      checkedAt: channel.checkedAt,
    };
  }
  const bookings = reservationBookings({
    openTableUrl: restaurant.reservation.openTableUrl,
    links: restaurant.reservation.links,
    extra: restaurant.links,
  });
  if (bookings[0]) {
    return { label: bookings[0].platform, url: bookings[0].url, phone: null, walkIn: false, checkedAt: null };
  }
  return null;
}

export function quickFacts(restaurant: SiteRestaurant, now = new Date()): QuickFacts {
  const publication = restaurant.menu.publication;
  const tastingMenus = tastingMenuPrices(restaurant, now).map(({ name, price }) => ({ name, price }));
  return {
    meal: restaurantMealCost(restaurant, now),
    price: restaurantPriceStats(restaurant, now),
    tastingMenus,
    booking: restaurantBooking(restaurant),
    hours: restaurant.experience.hours.length ? hoursSummary(restaurant.experience.hours) : null,
    menu: publication
      ? {
          label: menuCoverageLabel(restaurant),
          checkedAt: publication.checkedAt,
          overdue: menuNeedsRecheck(restaurant, now),
        }
      : null,
    instagram: instagramHandle(restaurant.contact.instagram),
  };
}

export function restaurantMealCost(restaurant: SiteRestaurant, now = new Date()) {
  return estimateMealCost(
    verifiedFoodItems(restaurant, now),
    tastingMenuPrices(restaurant, now).map(({ name, price }) => ({ name, price })),
  );
}

const METHOD_LABEL = {
  en: {
    starter_main: "starter + main course",
    main: "one main course",
    tacos: "three tacos",
    breakfast: "one breakfast plate",
    tasting: "cheapest set menu",
  },
  es: {
    starter_main: "entrada + plato fuerte",
    main: "un plato fuerte",
    tacos: "tres tacos",
    breakfast: "un desayuno",
    tasting: "menú fijo más económico",
  },
} as const;

export function mealMethodLabel(meal: MealCost, locale: Locale = "en") {
  return METHOD_LABEL[locale][meal.method];
}

export function mealExtrasNote(locale: Locale = "en") {
  return locale === "es" ? "sin bebidas ni propina (10–15 %)" : "before drinks and tip (10–15%)";
}

/** "A meal at X costs about 610 MXN per person (≈ US$33 · €29)…" — the answer to "how much / for X euros". */
export function mealSentence(name: string, meal: MealCost, checkedAt: string | null, locale: Locale = "en") {
  const range = meal.low !== meal.high ? `; ${locale === "es" ? "rango típico" : "typical range"} ${pesos(meal.low)}–${pesos(meal.high)}` : "";
  if (locale === "es") {
    return `Comer en ${name} cuesta alrededor de ${pesos(meal.estimate)} por persona (${foreignEquivalent(meal.estimate)}${range}): ${mealMethodLabel(meal, "es")} según la carta oficial${checkedAt ? ` verificada el ${formatDate(checkedAt, "es")}` : ""}, ${mealExtrasNote("es")}.`;
  }
  return `A meal at ${name} costs about ${pesos(meal.estimate)} per person (${foreignEquivalent(meal.estimate)}${range}): ${mealMethodLabel(meal)} from the official menu${checkedAt ? ` checked ${formatObserved(checkedAt)}` : ""}, ${mealExtrasNote()}.`;
}

export function priceSentence(name: string, price: PriceStats, locale: Locale = "en") {
  if (locale === "es") {
    return `En ${name}, el platillo mediano de la carta oficial cuesta ${pesos(price.median)} (la mitad central de los platillos: ${pesos(price.p25)}–${pesos(price.p75)}), con base en ${price.pricedDishes} platillos con precio verificados el ${formatDate(price.checkedAt, "es")}. No incluye bebidas.`;
  }
  return `At ${name}, the median dish on the official menu costs ${pesos(price.median)} (middle half of dishes: ${pesos(price.p25)}–${pesos(price.p75)}), based on ${price.pricedDishes} priced dishes checked ${formatObserved(price.checkedAt)}. Drinks are excluded.`;
}

export function bookingSentence(name: string, booking: Booking, locale: Locale = "en") {
  if (locale === "es") {
    if (booking.walkIn) return `${name} no toma reservaciones; se atiende por orden de llegada.`;
    const how = booking.url
      ? `${name} toma reservaciones por ${booking.label}: ${booking.url}`
      : booking.phone
        ? `${name} toma reservaciones por ${booking.label === "WhatsApp" ? "WhatsApp" : "teléfono"}: ${booking.phone}`
        : `Reservaciones en ${name}: ${booking.label}`;
    return `${how}${booking.checkedAt ? ` (verificado el ${formatDate(booking.checkedAt, "es")})` : ""}.`;
  }
  if (booking.walkIn) {
    return `${name} does not take reservations; tables are first come, first served.`;
  }
  const how = booking.url
    ? `${name} takes reservations via ${booking.label}: ${booking.url}`
    : booking.phone
      ? `${name} takes reservations by ${booking.label === "WhatsApp" ? "WhatsApp" : "phone"}: ${booking.phone}`
      : `${name} reservations: ${booking.label}`;
  const checked = booking.checkedAt ? ` (checked ${formatObserved(booking.checkedAt)})` : "";
  return `${how}${checked}.`;
}

/** Short Spanish summary for Mexican readers and Spanish-language queries. */
export function spanishSummary(name: string, facts: QuickFacts) {
  const parts: string[] = [];
  if (facts.meal) parts.push(`comida por persona ≈ ${pesos(facts.meal.estimate)}`);
  else if (facts.price) parts.push(`plato típico ${pesos(facts.price.median)}`);
  if (facts.tastingMenus[0]) parts.push(`menú degustación ${pesos(facts.tastingMenus[0].price)}`);
  if (facts.booking) {
    parts.push(
      facts.booking.walkIn
        ? "sin reservaciones"
        : `reservaciones: ${facts.booking.label === "Phone" ? "por teléfono" : facts.booking.label}`,
    );
  }
  if (!parts.length) return null;
  return `${name} en resumen: ${parts.join(" · ")}.`;
}
