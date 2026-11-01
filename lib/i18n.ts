// English is the default site; Spanish lives under /es with mirrored routes.
// Data (dish names, notes, addresses) is shown as published by the restaurant;
// only interface text and generated sentences are translated.

export type Locale = "en" | "es";

export const LOCALES: Locale[] = ["en", "es"];

const STRINGS = {
  en: {
    home: "Home",
    restaurants: "Restaurants",
    dishes: "Dishes",
    prices: "Prices",
    collections: "Collections",
    updates: "Updates",
    switchLanguage: "Español",
    address: "Address",
    phone: "Phone",
    website: "Website",
    officialSite: "Official site",
    instagram: "Instagram",
    hours: "Hours",
    cuisine: "Cuisine",
    price: "Price",
    yes: "Yes",
    listed: "Listed",
    sourceDated: "Source-dated",
    lastObserved: "Last observed",
    menu: "Menu",
    menuSource: "Menu source",
    reservation: "Reservation",
    quickAnswers: "Quick answers",
    menuChecked: "menu checked",
    typicalDish: "Typical dish",
    mostDishes: "most dishes",
    pricedDishes: "priced dishes",
    setMenu: "Set menu",
    howToBook: "How to book",
    walkIn: "No reservations — walk in",
    byPhone: "By phone",
    recheckDue: "recheck due",
    menuUpdates: "Menu updates",
    menuDated: "Menu dated",
    sourceChecked: "Source checked",
    recheckDueLong: "Recheck due.",
    recheckDueDetail: "Today’s menu and prices are not confirmed.",
    viewAllDishes: (n: number) => `View all ${n} dishes`,
    originalPost: "Original post",
    checked: "checked",
    sources: (n: number) => `Sources & further reading (${n})`,
    recorded: "recorded",
    nearby: "Nearby",
    sameCuisine: "Same cuisine",
    film: "Filmed by The Dining Dispatch",
    watchOnYoutube: "Watch on YouTube",
    budget: "Budget",
    mealForOne: "Meal for one",
    typicalRange: "typical",
    alsoOnMenu: "On the dish finder",
    films: "Films",
    about: "About",
    methodology: "Method",
  },
  es: {
    home: "Inicio",
    restaurants: "Restaurantes",
    dishes: "Platillos",
    prices: "Precios",
    collections: "Colecciones",
    updates: "Novedades",
    switchLanguage: "English",
    address: "Dirección",
    phone: "Teléfono",
    website: "Sitio web",
    officialSite: "Sitio oficial",
    instagram: "Instagram",
    hours: "Horario",
    cuisine: "Cocina",
    price: "Precio",
    yes: "Sí",
    listed: "En la lista",
    sourceDated: "Fuente fechada",
    lastObserved: "Última verificación",
    menu: "Carta",
    menuSource: "Fuente de la carta",
    reservation: "Reservar",
    quickAnswers: "Respuestas rápidas",
    menuChecked: "carta verificada",
    typicalDish: "Plato típico",
    mostDishes: "la mayoría",
    pricedDishes: "platillos con precio",
    setMenu: "Menú",
    howToBook: "Cómo reservar",
    walkIn: "Sin reservaciones — llega directo",
    byPhone: "Por teléfono",
    recheckDue: "por reverificar",
    menuUpdates: "Platillos publicados",
    menuDated: "Carta fechada",
    sourceChecked: "Fuente verificada",
    recheckDueLong: "Por reverificar.",
    recheckDueDetail: "La carta y los precios de hoy no están confirmados.",
    viewAllDishes: (n: number) => `Ver los ${n} platillos`,
    originalPost: "Publicación original",
    checked: "verificado",
    sources: (n: number) => `Fuentes y lecturas (${n})`,
    recorded: "registrado",
    nearby: "Cerca",
    sameCuisine: "Misma cocina",
    film: "Filmado por The Dining Dispatch",
    watchOnYoutube: "Ver en YouTube",
    budget: "Presupuesto",
    mealForOne: "Comida por persona",
    typicalRange: "rango",
    alsoOnMenu: "En el buscador de platillos",
    films: "Películas",
    about: "Quiénes somos",
    methodology: "Método",
  },
} as const;

export type Strings = (typeof STRINGS)["en"];

export function t(locale: Locale = "en"): Strings {
  return STRINGS[locale] as unknown as Strings;
}

export const paths = {
  home: (locale: Locale) => (locale === "es" ? "/es" : "/"),
  restaurants: (locale: Locale) => (locale === "es" ? "/es/restaurantes" : "/restaurants"),
  restaurant: (slug: string, locale: Locale) =>
    locale === "es" ? `/es/restaurantes/${slug}` : `/restaurants/${slug}`,
  prices: (locale: Locale) => (locale === "es" ? "/es/precios" : "/prices"),
  dishes: (locale: Locale) => (locale === "es" ? "/es/platos" : "/dishes"),
  dish: (slug: string, locale: Locale) => (locale === "es" ? `/es/platos/${slug}` : `/dishes/${slug}`),
  updates: (locale: Locale) => (locale === "es" ? "/es/actualizaciones" : "/updates"),
  budget: (locale: Locale) => (locale === "es" ? "/es/presupuesto" : "/budget"),
  films: (locale: Locale) => (locale === "es" ? "/es/peliculas" : "/films"),
  about: (locale: Locale) => (locale === "es" ? "/es/acerca" : "/about"),
  methodology: (locale: Locale) => (locale === "es" ? "/es/metodologia" : "/methodology"),
  privacy: (locale: Locale) => (locale === "es" ? "/es/privacidad" : "/privacy"),
};

// English and Spanish budget slugs ("under-800-pesos" ↔ "menos-de-800-pesos").
const budgetToEs = (key: string) => key.replace(/^under-(\d+)-pesos$/, "menos-de-$1-pesos").replace(/^over-(\d+)-pesos$/, "mas-de-$1-pesos");
const budgetToEn = (key: string) => key.replace(/^menos-de-(\d+)-pesos$/, "under-$1-pesos").replace(/^mas-de-(\d+)-pesos$/, "over-$1-pesos");

/** The same page in the other language, for the language switch and hreflang. */
export function alternatePath(pathname: string, target: Locale): string {
  const pairs: Array<[RegExp, (m: RegExpMatchArray) => string, RegExp, (m: RegExpMatchArray) => string]> = [
    [/^\/restaurants\/([^/]+)$/, (m) => `/es/restaurantes/${m[1]}`, /^\/es\/restaurantes\/([^/]+)$/, (m) => `/restaurants/${m[1]}`],
    [/^\/dishes\/([^/]+)$/, (m) => `/es/platos/${m[1]}`, /^\/es\/platos\/([^/]+)$/, (m) => `/dishes/${m[1]}`],
    [/^\/restaurants$/, () => "/es/restaurantes", /^\/es\/restaurantes$/, () => "/restaurants"],
    [/^\/dishes$/, () => "/es/platos", /^\/es\/platos$/, () => "/dishes"],
    [/^\/prices$/, () => "/es/precios", /^\/es\/precios$/, () => "/prices"],
    [/^\/updates$/, () => "/es/actualizaciones", /^\/es\/actualizaciones$/, () => "/updates"],
    [/^\/budget\/([^/]+)\/([^/]+)$/, (m) => `/es/presupuesto/${budgetToEs(m[1])}/${m[2]}`, /^\/es\/presupuesto\/([^/]+)\/([^/]+)$/, (m) => `/budget/${budgetToEn(m[1])}/${m[2]}`],
    [/^\/budget\/([^/]+)$/, (m) => `/es/presupuesto/${budgetToEs(m[1])}`, /^\/es\/presupuesto\/([^/]+)$/, (m) => `/budget/${budgetToEn(m[1])}`],
    [/^\/budget$/, () => "/es/presupuesto", /^\/es\/presupuesto$/, () => "/budget"],
    [/^\/films$/, () => "/es/peliculas", /^\/es\/peliculas$/, () => "/films"],
    [/^\/about$/, () => "/es/acerca", /^\/es\/acerca$/, () => "/about"],
    [/^\/methodology$/, () => "/es/metodologia", /^\/es\/metodologia$/, () => "/methodology"],
    [/^\/privacy$/, () => "/es/privacidad", /^\/es\/privacidad$/, () => "/privacy"],
    [/^\/$/, () => "/es", /^\/es$/, () => "/"],
  ];
  for (const [enPattern, toEs, esPattern, toEn] of pairs) {
    if (target === "es") {
      const match = pathname.match(enPattern);
      if (match) return toEs(match);
    } else {
      const match = pathname.match(esPattern);
      if (match) return toEn(match);
    }
  }
  return target === "es" ? "/es" : "/";
}

export function localeOfPath(pathname: string): Locale {
  return pathname === "/es" || pathname.startsWith("/es/") ? "es" : "en";
}

export function formatDate(value: string | null | undefined, locale: Locale = "en") {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function coverageLabel(coverage: string | undefined, locale: Locale) {
  if (locale === "en") {
    return coverage === "food_menu" ? "Food menu" : coverage === "selection" ? "Menu selection" : coverage === "dishes" ? "Published dishes" : "Menu source";
  }
  return coverage === "food_menu" ? "Carta completa" : coverage === "selection" ? "Selección de la carta" : coverage === "dishes" ? "Platillos publicados" : "Fuente de la carta";
}
