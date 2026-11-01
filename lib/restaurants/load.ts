import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import {
  applyV1Menu,
  applyVerifiedOverlay,
  restaurantFromEnriched,
  toIndexRecord,
  mergeObjectiveCollections,
  normalizeHours,
  type V1EnrichedRecord,
  type V1MenuFile,
  type V1RegistryEntry,
  type V1VerifiedOverlay,
} from "@/lib/restaurants/from-v1";
import {
  ENRICHED_ROOT,
  MENUS_ROOT,
  SITE_DATA_ROOT,
  V1_ROOT,
  VERIFIED_ROOT,
} from "@/lib/restaurants/paths";
import type { SiteCollection, SiteRestaurant } from "@/lib/restaurants/types";
import { MENU_STATES } from "@/lib/restaurants/types";

async function readJsonFile<T>(absPath: string): Promise<T> {
  const raw = await readFile(absPath, "utf8");
  return JSON.parse(raw) as T;
}

function isNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

async function readOptionalJson<T>(absPath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(absPath);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export const loadRegistry = cache(async () => {
  const records = await readJsonFile<V1RegistryEntry[]>(join(V1_ROOT, "registry.json"));
  if (!Array.isArray(records)) {
    throw new Error("v1/registry.json must be an array");
  }
  // Restaurants with a documented closure stay in the registry for traceability but leave the catalog.
  return records.filter(
    (row) => typeof row.slug === "string" && row.slug.length > 0 && row.status !== "closed",
  );
});

type GeoCorrection = { coordinates: { latitude: number; longitude: number }; source: string; checkedAt: string };
const loadGeoCorrections = cache(async () => {
  return (await readOptionalJson<Record<string, GeoCorrection>>(join(V1_ROOT, "geo-corrections.json"))) ?? {};
});

// Instagram accounts and booking links found later (scripts: social lookup, v1/social.json).
// They only fill gaps: an existing handle or online booking link is never replaced.
type SocialEntry = {
  instagram?: string | null;
  instagramEvidence?: string;
  booking?: { platform: string; url: string; notes?: string | null } | null;
  checkedAt: string;
};
const loadSocial = cache(async () => {
  return (await readOptionalJson<Record<string, SocialEntry>>(join(V1_ROOT, "social.json"))) ?? {};
});

function applySocial(restaurant: SiteRestaurant, social: SocialEntry | undefined, suppress: string[]): SiteRestaurant {
  if (!social) return restaurant;
  const instagram =
    !restaurant.contact.instagram && social.instagram && !suppress.includes("instagram")
      ? social.instagram
      : restaurant.contact.instagram;
  const channel = restaurant.reservation.channel;
  const needsBooking = !channel?.url && !/walk-in/i.test(channel?.platform ?? "");
  const booking =
    needsBooking && social.booking?.url && !suppress.includes("reservation")
      ? {
          platform: social.booking.platform,
          url: social.booking.url,
          phone: channel?.phone ?? restaurant.contact.phone ?? null,
          notes: social.booking.notes ?? null,
          checkedAt: social.checkedAt,
        }
      : channel ?? null;
  return {
    ...restaurant,
    contact: { ...restaurant.contact, instagram },
    reservation: { ...restaurant.reservation, channel: booking },
  };
}

const loadVerifiedOverlay = cache(async (slug: string) => {
  return readOptionalJson<V1VerifiedOverlay>(join(VERIFIED_ROOT, `${slug}.json`));
});

export const loadRegistrySlugs = cache(async () => {
  const registry = await loadRegistry();
  return registry.map((row) => row.slug);
});

export const loadBaseCollections = cache(async () => {
  const records = await readJsonFile<SiteCollection[]>(
    join(SITE_DATA_ROOT, "collections.json"),
  );
  if (!Array.isArray(records)) {
    throw new Error("v1/site-data/collections.json must be an array");
  }
  return records;
});

const loadV1Menu = cache(async (slug: string) => {
  return readOptionalJson<V1MenuFile>(join(MENUS_ROOT, `${slug}.json`));
});

const loadSiteRestaurant = cache(async (slug: string) => {
  return readOptionalJson<SiteRestaurant>(
    join(SITE_DATA_ROOT, "restaurants", `${slug}.json`),
  );
});

const loadEnrichedRestaurant = cache(async (slug: string) => {
  return readOptionalJson<V1EnrichedRecord>(join(ENRICHED_ROOT, `${slug}.json`));
});

export const loadRestaurantBySlug = cache(async (slug: string) => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const registrySlugs = await loadRegistrySlugs();
  if (!registrySlugs.includes(slug)) return null;

  const siteRecord = await loadSiteRestaurant(slug);
  let restaurant: SiteRestaurant | null = null;
  if (siteRecord) {
    assertRestaurant(siteRecord, slug);
    restaurant = siteRecord;
  } else {
    const enriched = await loadEnrichedRestaurant(slug);
    if (!enriched) return null;
    restaurant = restaurantFromEnriched(enriched);
  }

  // food.priceLevel in the source records is Google's $ level (fieldProvenance.price_level = "google_places"):
  // dropped here so no page, export or JSON-LD can show it. Symbols come from our own cost per person.
  restaurant = { ...restaurant, food: { ...restaurant.food, priceLevel: null } };

  const overlay = await loadVerifiedOverlay(slug);
  restaurant = applyVerifiedOverlay(restaurant, overlay);
  restaurant = applySocial(restaurant, (await loadSocial())[slug], overlay?.suppress ?? []);
  // Map points re-checked against the verified address (scripts/geo-audit.mjs).
  const geo = (await loadGeoCorrections())[slug];
  if (geo) {
    restaurant = {
      ...restaurant,
      location: { ...restaurant.location, coordinates: geo.coordinates },
      contact: {
        ...restaurant.contact,
        googleMapsUrl: `https://www.openstreetmap.org/?mlat=${geo.coordinates.latitude}&mlon=${geo.coordinates.longitude}#map=19/${geo.coordinates.latitude}/${geo.coordinates.longitude}`, // map link = OpenStreetMap (field name kept for compatibility)
      },
    };
  }
  const menu = await loadV1Menu(slug);
  restaurant = applyV1Menu(restaurant, menu);
  restaurant = {
    ...restaurant,
    experience: {
      ...restaurant.experience,
      hours: normalizeHours(restaurant.experience.hours),
    },
  };
  if (restaurant.seo.indexable !== true) {
    restaurant = {
      ...restaurant,
      seo: { ...restaurant.seo, indexable: false, faq: [] },
      editorial: {
        ...restaurant.editorial,
        bestFor: [],
        avoidFor: [],
        review: restaurant.editorial.status === "reviewed" ? restaurant.editorial.review : null,
      },
      reservation: {
        ...restaurant.reservation,
        difficulty: null,
        recommendedLeadTime: null,
        advice: null,
      },
    };
  }
  assertRestaurant(restaurant, slug);
  return restaurant;
});

export const loadCatalog = cache(async () => {
  const slugs = await loadRegistrySlugs();
  const rows = await Promise.all(slugs.map((slug) => loadRestaurantBySlug(slug)));
  return rows.filter((row): row is SiteRestaurant => Boolean(row));
});

export const loadIndex = cache(async () => {
  const catalog = await loadCatalog();
  return catalog.map(toIndexRecord);
});

export const loadCollections = cache(async () => {
  const [base, catalog] = await Promise.all([loadBaseCollections(), loadCatalog()]);
  return mergeObjectiveCollections(base, catalog);
});

function assertRestaurant(record: SiteRestaurant, slug: string) {
  if (record.slug !== slug) {
    throw new Error(`Restaurant file slug mismatch: ${slug}`);
  }
  if (!record.id || !record.name) {
    throw new Error(`Restaurant ${slug} is missing id or name`);
  }
  if (typeof record.seo?.indexable !== "boolean") {
    throw new Error(`Restaurant ${slug} is missing seo.indexable`);
  }
  if (!record.editorial?.status) {
    throw new Error(`Restaurant ${slug} is missing editorial.status`);
  }
  if (!record.menu?.state) {
    throw new Error(`Restaurant ${slug} is missing menu.state`);
  }
  if (
    !MENU_STATES.includes(record.menu.state as (typeof MENU_STATES)[number]) &&
    typeof record.menu.state !== "string"
  ) {
    throw new Error(`Restaurant ${slug} has an invalid menu.state`);
  }
}
