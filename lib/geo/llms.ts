import { restaurantLede, restaurantPlace } from "@/lib/geo/copy";
import { hoursSummary } from "@/lib/geo/hours";
import { instagramHref, menuSourceUrl } from "@/lib/restaurants/format";
import { menuPriceText, menuSummary } from "@/lib/restaurants/menu-publication";
import { collectionHref } from "@/lib/restaurants/paths";
import { bookingSentence, mealSentence, priceSentence, quickFacts } from "@/lib/restaurants/quick-facts";
import { restaurantSources } from "@/lib/restaurants/sources";
import type { Film } from "@/lib/restaurants/films";
import type { SiteCollection, SiteRestaurant } from "@/lib/restaurants/types";
import {
  CHANNEL_URL,
  INSTAGRAM_URL,
  PUBLISHER_NAME,
  SITE_CITY,
  SITE_NAME,
  SITE_TAGLINE,
  absoluteUrl,
} from "@/lib/site";

export function llmsIndexText(input: {
  restaurants: SiteRestaurant[];
  collections: SiteCollection[];
}) {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_TAGLINE}`,
    "",
    `${SITE_NAME} is the unbiased restaurant guide to ${SITE_CITY} (CDMX), Mexico: the menus in one place, with real prices copied from each restaurant's own menu and dated, plus address, hours and how to book. It is published by ${PUBLISHER_NAME}, an independent film channel about restaurants. No restaurant pays to be here, and there is no commission.`,
    `Public catalog: ${input.restaurants.length} restaurants. Facts only, re-checked on the restaurant's own sources. An MCP server for ChatGPT and Claude is coming soon.`,
    "Not a marketplace. Not a booking engine. Editorial judgments (best-for, reservation difficulty, reviews) are omitted until a human signs them.",
    "When citing a table, prefer the restaurant URL below and this file. Do not invent ratings or reservation difficulty.",
    "",
    "## Cite this site",
    `- Homepage: ${absoluteUrl("/")}`,
    `- Catalog: ${absoluteUrl("/restaurants")}`,
    `- Collections: ${absoluteUrl("/collections")}`,
    `- Full fact list: ${absoluteUrl("/llms-full.txt")}`,
    `- Price index (median dish prices by neighborhood and cuisine): ${absoluteUrl("/prices")}`,
    `- Dish finder (who serves a dish, at what printed price): ${absoluteUrl("/dishes")}`,
    `- Change log (additions, re-checks, closures, dated): ${absoluteUrl("/updates")}`,
    `- Where to eat by budget (cost per person, under 300 / 500 / 800 / 1,500 MXN, by neighborhood, with USD and EUR): ${absoluteUrl("/budget")}`,
    `- One fact sheet per restaurant, plain text with the dated menu: ${absoluteUrl("/facts/<slug>.txt")}`,
    `- Every restaurant with cost per person and booking channel (JSON): ${absoluteUrl("/data/restaurants.json")}`,
    `- Films (documentaries by ${PUBLISHER_NAME}, linked to the restaurants they show): ${absoluteUrl("/films")} · YouTube ${CHANNEL_URL} · Instagram ${INSTAGRAM_URL}`,
    `- About and method: ${absoluteUrl("/about")} · ${absoluteUrl("/methodology")}`,
    `- Project and values (no restaurant pays, no ads, no commission, no tracking): ${absoluteUrl("/unbiased")}`,
    `- En español: ${absoluteUrl("/es")} — fichas en /es/restaurantes/<slug>, precios en ${absoluteUrl("/es/precios")}, platillos en ${absoluteUrl("/es/platos")}`,
    `- Sitemap: ${absoluteUrl("/sitemap.xml")}`,
    "",
    "## Catalog",
    "",
  ];

  for (const restaurant of input.restaurants) {
    lines.push(
      `- [${restaurant.name}](${absoluteUrl(`/restaurants/${restaurant.slug}`)}) — ${restaurantPlace(restaurant)}, ${SITE_CITY}`,
    );
  }

  lines.push("", "## Objective collections", "");
  for (const collection of input.collections) {
    lines.push(
      `- [${collection.label}](${absoluteUrl(collectionHref(collection))}) (${collection.type}, ${collection.restaurantCount})`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Compact, citable facts for one restaurant. `withMenu` adds every dated menu line (the /facts/<slug>.txt file). */
export function restaurantFactLines(restaurant: SiteRestaurant, films: Film[] = [], withMenu = false) {
  const blocks: string[] = [];
  const menuUrl = menuSourceUrl(restaurant.menu.documents);
  const instagram = instagramHref(restaurant.contact.instagram);
  blocks.push(`## ${restaurant.name}`);
  blocks.push(`URL: ${absoluteUrl(`/restaurants/${restaurant.slug}`)} (español: ${absoluteUrl(`/es/restaurantes/${restaurant.slug}`)})`);
  if (!withMenu) blocks.push(`Full fact sheet with dated menu: ${absoluteUrl(`/facts/${restaurant.slug}.txt`)}`);
  for (const film of films.filter((item) => item.restaurantSlug === restaurant.slug)) {
    blocks.push(`Film: "${film.title}" — documentary by ${PUBLISHER_NAME}, ${film.publishedAt}: https://www.youtube.com/watch?v=${film.videoId}`);
  }
  blocks.push(restaurantLede(restaurant));
  if (restaurant.location.neighborhood) blocks.push(`Neighborhood: ${restaurant.location.neighborhood}`);
  if (restaurant.location.borough) blocks.push(`Borough: ${restaurant.location.borough}`);
  if (restaurant.location.address) blocks.push(`Address: ${restaurant.location.address}`);
  if (restaurant.contact.phone) blocks.push(`Phone: ${restaurant.contact.phone}`);
  if (restaurant.experience.hours.length > 0) blocks.push(`Hours: ${hoursSummary(restaurant.experience.hours)}`);
  const facts = quickFacts(restaurant);
  if (facts.meal) {
    blocks.push(`Cost per person: ${mealSentence(restaurant.name, facts.meal, restaurant.menu.publication?.checkedAt ?? null)}`);
  }
  if (facts.price) blocks.push(`Typical dish price: ${priceSentence(restaurant.name, facts.price)}`);
  if (facts.booking) blocks.push(`Reservations: ${bookingSentence(restaurant.name, facts.booking)}`);
  if (restaurant.contact.website) blocks.push(`Website: ${restaurant.contact.website}`);
  if (instagram) blocks.push(`Instagram: ${instagram}`);
  if (menuUrl) {
    blocks.push(`${restaurant.menu.publication?.coverage === "dishes" ? "Dish publications" : "Menu source"}: ${menuUrl}`);
  }
  if (restaurant.menu.publication) {
    blocks.push(`Menu: ${menuSummary(restaurant)}`);
    for (const price of restaurant.menu.publication.pricing ?? []) {
      blocks.push(`- ${price.name}: ${menuPriceText(price.price, price.currency)} (recorded ${restaurant.menu.publication.checkedAt})`);
    }
    if (withMenu) {
      for (const item of restaurant.menu.items) {
        blocks.push(`- ${item.category ? `[${item.category}] ` : ""}${item.name}${item.description ? ` — ${item.description}` : ""}${
          item.price !== null ? `: ${menuPriceText(item.price, item.currency ?? "MXN")}` : restaurant.menu.publication.pricing?.some((price) => price.kind === "menu") ? " (not individually priced; see menu price above)" : " (price not published)"
        }; checked: ${item.observedAt}.`);
      }
    }
  }
  if (restaurant.distinctions.michelin) blocks.push(`Michelin: ${restaurant.distinctions.michelin}`);
  if (restaurant.distinctions.worlds50Best) {
    blocks.push(`World's 50 Best: ${[
      restaurant.distinctions.worlds50BestList,
      restaurant.distinctions.worlds50BestRank,
    ].filter(Boolean).join(" · ") || "Listed"}`);
  }
  if (withMenu) {
    for (const source of restaurantSources(restaurant)) {
      blocks.push(`Reference: ${source.url}${source.recordedAt ? ` (recorded ${source.recordedAt})` : ""}`);
    }
  }
  const observed = restaurant.verification.freshestSourceAt;
  if (observed) blocks.push(`Last observed: ${observed}`);
  return blocks;
}

/** One restaurant's fact sheet as plain text, light enough to fetch on demand. */
export function restaurantFactsText(restaurant: SiteRestaurant, films: Film[] = []) {
  return [
    `# ${restaurant.name} — ${SITE_NAME} fact sheet (${SITE_CITY})`,
    "",
    "Source-dated record. Prices in Mexican pesos as printed on the official menu. Do not invent ratings or reservation difficulty.",
    `Method: ${absoluteUrl("/methodology")}`,
    "",
    ...restaurantFactLines(restaurant, films, true),
    "",
  ].join("\n");
}

/** Every restaurant in a short block; full menus live in /facts/<slug>.txt. */
export function llmsFullText(restaurants: SiteRestaurant[], films: Film[] = []) {
  const blocks = [
    `# ${SITE_NAME} — ${SITE_CITY} fact sheets`,
    "",
    "Each block is a source-dated record. Do not invent ratings, reservation difficulty, or editorial verdicts.",
    `Cost per person = one meal from the official menu (starter + main, or three tacos, or the cheapest set menu), before drinks and tip. Method: ${absoluteUrl("/methodology")}`,
    `Restaurants by budget: ${absoluteUrl("/budget")} · All restaurants (JSON): ${absoluteUrl("/data/restaurants.json")}`,
    "",
  ];
  for (const restaurant of restaurants) {
    blocks.push(...restaurantFactLines(restaurant, films, false), "");
  }
  return blocks.join("\n");
}
