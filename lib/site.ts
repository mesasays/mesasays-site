export const SITE_NAME = "Mesasays";
export const SITE_TAGLINE = "The unbiased restaurant guide to Mexico City.";
export const SITE_TAGLINE_ES = "La guía de restaurantes imparcial de la Ciudad de México.";
export const SITE_HOME_TITLE = "Mesasays — The unbiased restaurant guide to Mexico City: real menus, prices, hours, how to book";
export const SITE_HOME_TITLE_ES = "Mesasays — La guía de restaurantes imparcial de la Ciudad de México: cartas reales, precios, horarios y reservas";
/** The one fairness line, used wherever the site says why it can be trusted. */
export const SITE_FAIR_LINE = "No restaurant pays to be here.";
export const SITE_FAIR_LINE_ES = "Ningún restaurante paga por estar aquí.";
/** Home page description for search results; the restaurant count comes from the catalog at build time. */
export function homeDescription(count: number, locale: "en" | "es" = "en") {
  return locale === "es"
    ? `Las cartas de ${count} restaurantes de la Ciudad de México, con los precios reales de su carta oficial, horarios y cómo reservar. Ningún restaurante paga por estar aquí.`
    : `The menus of ${count} Mexico City restaurants, with real prices from each restaurant's own menu, hours and how to book. No restaurant pays to be here.`;
}
export const SITE_SERP_DESCRIPTION =
  "The unbiased restaurant guide to Mexico City: real menus with prices from each restaurant's own menu, hours and how to book. No restaurant pays to be here.";
export const SITE_CITY = "Mexico City";
export const SITE_CITY_ES = "Ciudad de México";
export const SITE_CITY_SHORT = "CDMX";
export const SITE_COUNTRY = "Mexico";
export const SITE_COUNTRY_CODE = "MX";
export const SITE_REGION_CODE = "MX-CMX";
export const SITE_LOCALE = "en";
export const SITE_LOCALE_OG = "en_US";
export const SITE_LOCALE_ALT = "es_MX";
export const SITE_GEO = {
  latitude: 19.4326,
  longitude: -99.1332,
};
// The Dining Dispatch: the film channel and Instagram behind Mesasays.
export const PUBLISHER_NAME = "The Dining Dispatch";
export const CHANNEL_URL = "https://www.youtube.com/@TheDiningDispatch";
export const INSTAGRAM_URL = "https://www.instagram.com/thediningdispatch/";
export const INSTAGRAM_HANDLE = "@thediningdispatch";
// Public code repository (AGPL) and contact address for corrections and removals.
export const PUBLIC_REPO_URL = "https://github.com/mesasays/mesasays-site";
export const CONTACT_EMAIL = "retroprank@proton.me";
export const SITE_ORG_ID = "#organization";
export const SITE_WEBSITE_ID = "#website";
export const SITE_CATALOG_ID = "#catalog";

export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(
    /\/$/,
    "",
  );
  if (process.env.VERCEL_ENV === "production" && vercelProduction) {
    return vercelProduction.startsWith("http")
      ? vercelProduction
      : `https://${vercelProduction}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function siteEntityId(fragment: string) {
  const id = fragment.startsWith("#") ? fragment : `#${fragment}`;
  return `${getSiteUrl()}${id}`;
}

export function absoluteUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}
