import type {
  MenuDocument,
  MenuItem,
  MenuPublication,
  RestaurantIndexRecord,
  SiteCollection,
  SiteRestaurant,
} from "@/lib/restaurants/types";
import { slugifyLabel } from "@/lib/restaurants/paths";

export type V1RegistryEntry = {
  name: string;
  status: string;
  slug: string;
  stage: string | null;
  action: string | null;
  v1State: string;
};

export type V1MenuFile = {
  slug: string;
  name?: string;
  url?: string | null;
  status?: string | null;
  observedAt?: string | null;
  publication?: MenuPublication;
  items?: Array<{
    id?: string;
    documentId?: string | null;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    category?: string | null;
    sourceUrl?: string | null;
    observedAt?: string | null;
    extractionConfidence?: number | null;
    extractionLayer?: string | null;
  }>;
};

export type V1EnrichedRecord = {
  slug: string;
  name: string;
  location?: {
    address?: string | null;
    neighborhood?: string | null;
    borough?: string | null;
    coordinates?: { latitude: number; longitude: number } | null;
  };
  contact?: {
    phone?: string | null;
    website?: string | null;
    instagram?: string | null;
  };
  hours?: Array<string | { weekday?: string; start?: string; end?: string }>;
  food?: {
    cuisine?: string | null;
    priceLevel?: number | null;
  };
  reservation?: {
    platform?: string | null;
    url?: string | null;
    phone?: string | null;
    notes?: string | null;
  } | null;
  distinctions?: {
    michelin?: string | null;
    michelinStars?: number | null;
    bibGourmand?: boolean;
    worlds50Best?: boolean;
    worlds50BestRank?: string | null;
    worlds50BestList?: string | null;
  };
  sources?: Array<{ source?: string; url?: string }>;
  enrichedAt?: string | null;
  editorial?: { status?: string | null };
  seo?: { indexable?: boolean };
};

function hostOf(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

function suppressFields(restaurant: SiteRestaurant, fields: string[]): SiteRestaurant {
  if (!fields.length) return restaurant;
  const drop = new Set(fields);
  // A suppressed website takes every link on the same domain with it (booking buttons included).
  const badHost = drop.has("website") ? hostOf(restaurant.contact.website) : null;
  const keepUrl = (url: string | null | undefined) => !badHost || hostOf(url) !== badHost;
  const channel = restaurant.reservation.channel;
  return {
    ...restaurant,
    contact: {
      ...restaurant.contact,
      website: drop.has("website") ? null : restaurant.contact.website,
      instagram: drop.has("instagram") ? null : restaurant.contact.instagram,
      phone: drop.has("phone") ? null : restaurant.contact.phone,
    },
    reservation: drop.has("reservation")
      ? { ...restaurant.reservation, openTableUrl: null, links: [], channel: null }
      : drop.has("reservation_links")
        ? { ...restaurant.reservation, openTableUrl: null, links: [], channel: channel ? { ...channel, url: null } : channel }
        : {
          ...restaurant.reservation,
          openTableUrl: keepUrl(restaurant.reservation.openTableUrl) ? restaurant.reservation.openTableUrl : null,
          links: restaurant.reservation.links.filter((link) => keepUrl(link.url)),
          channel: channel && !keepUrl(channel.url) ? { ...channel, url: null } : channel,
        },
    links: restaurant.links.filter((link) => {
      if ((drop.has("reservation") || drop.has("reservation_links")) && link.type === "reservation") return false;
      return keepUrl(link.url);
    }),
  };
}

/** Field re-verification of an already published restaurant (v1/verified/<slug>.json). */
export type V1VerifiedOverlay = {
  slug: string;
  verdict: "verified" | "closed" | "unverifiable";
  verifiedAt: string;
  /** Fields proven wrong (hijacked domain, another business, dead booking link): hidden whatever the verdict. */
  suppress?: Array<"website" | "instagram" | "reservation" | "reservation_links" | "phone">;
  contact?: {
    phone?: string | null;
    website?: string | null;
    instagram?: string | null;
  };
  hours?: string[];
  /** Address fixes and distinctions confirmed on official sources (manual corrections). */
  location?: { address?: string | null; neighborhood?: string | null };
  distinctions?: { michelin?: string | null; bibGourmand?: boolean; michelinStars?: number };
  reservation?: {
    platform?: string | null;
    url?: string | null;
    phone?: string | null;
    notes?: string | null;
  } | null;
};

export function applyVerifiedOverlay(
  restaurant: SiteRestaurant,
  overlay: V1VerifiedOverlay | null,
): SiteRestaurant {
  if (!overlay) return restaurant;
  restaurant = suppressFields(restaurant, overlay.suppress ?? []);
  if (overlay.verdict !== "verified") return restaurant;
  const reservation = overlay.reservation;
  const channel = reservation?.platform
    ? {
        platform: reservation.platform,
        url: reservation.url ?? null,
        phone: reservation.phone ?? null,
        notes: reservation.notes ?? null,
        checkedAt: overlay.verifiedAt,
      }
    : restaurant.reservation.channel ?? null;
  return {
    ...restaurant,
    contact: {
      ...restaurant.contact,
      phone: overlay.contact?.phone ?? restaurant.contact.phone,
      website: overlay.contact?.website ?? restaurant.contact.website,
      // A verified overlay may drop an Instagram handle that the official site does not link.
      instagram:
        overlay.contact && "instagram" in overlay.contact
          ? overlay.contact.instagram ?? null
          : restaurant.contact.instagram,
    },
    location: {
      ...restaurant.location,
      address: overlay.location?.address ?? restaurant.location.address,
      neighborhood: overlay.location?.neighborhood ?? restaurant.location.neighborhood,
    },
    distinctions: overlay.distinctions
      ? {
          ...restaurant.distinctions,
          michelin: overlay.distinctions.michelin ?? restaurant.distinctions.michelin,
          bibGourmand: overlay.distinctions.bibGourmand ?? restaurant.distinctions.bibGourmand,
          michelinStars: overlay.distinctions.michelinStars ?? restaurant.distinctions.michelinStars,
        }
      : restaurant.distinctions,
    experience: {
      ...restaurant.experience,
      hours: overlay.hours?.length ? overlay.hours : restaurant.experience.hours,
    },
    reservation: {
      ...restaurant.reservation,
      ...(reservation?.url
        ? {
            openTableUrl: /opentable/i.test(reservation.platform ?? "") ? reservation.url : null,
            links: [{ url: reservation.url, platform: reservation.platform, provider: reservation.platform, type: "reservation" }],
          }
        : {}),
      channel,
    },
    verification: {
      ...restaurant.verification,
      freshestSourceAt: overlay.verifiedAt,
    },
  };
}

function emptyEditorial(status = "pending"): SiteRestaurant["editorial"] {
  return {
    status,
    bestFor: [],
    avoidFor: [],
    ambience: null,
    idealMoment: null,
    visitorTypes: [],
    review: null,
    author: null,
    reviewedAt: null,
  };
}

function mapsUrl(coordinates: { latitude: number; longitude: number } | null | undefined) {
  if (coordinates?.latitude == null || coordinates?.longitude == null) return null;
  return `https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=19/${coordinates.latitude}/${coordinates.longitude}`; // OpenStreetMap, not Google
}

export function normalizeHours(hours: unknown): string[] {
  if (!Array.isArray(hours)) return [];
  return hours
    .map((row) => {
      if (typeof row === "string") return row.trim();
      if (row && typeof row === "object") {
        const entry = row as { weekday?: string; days?: string; start?: string; end?: string };
        const day = entry.weekday ?? entry.days;
        if (day && entry.start && entry.end) return `${day} ${entry.start}–${entry.end}`;
        if (entry.start && entry.end) return `${entry.start}–${entry.end}`;
      }
      return "";
    })
    .filter(Boolean);
}

export function restaurantFromEnriched(record: V1EnrichedRecord): SiteRestaurant {
  const reservationUrl = record.reservation?.url ?? null;
  const reservationPlatform = record.reservation?.platform ?? null;
  const sourceNames = [
    ...new Set(
      (record.sources ?? [])
        .map((source) => source.source)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  return {
    schemaVersion: "tdd.v1.enriched",
    id: `v1:${record.slug}`,
    slug: record.slug,
    name: record.name,
    location: {
      neighborhood: record.location?.neighborhood ?? null,
      borough: record.location?.borough ?? null,
      address: record.location?.address ?? null,
      coordinates: record.location?.coordinates ?? null,
    },
    contact: {
      phone: record.contact?.phone ?? null,
      website: record.contact?.website ?? null,
      instagram: record.contact?.instagram ?? null,
      googleMapsUrl: mapsUrl(record.location?.coordinates),
    },
    food: {
      cuisine: record.food?.cuisine ?? null,
      michelinCuisine: null,
      openTableCuisine: null,
      priceLevel: record.food?.priceLevel ?? null,
    },
    experience: {
      sourceSummary: null,
      hours: normalizeHours(record.hours),
      rating: null,
      reviewCount: null,
    },
    distinctions: {
      michelin: record.distinctions?.michelin ?? null,
      michelinStars: record.distinctions?.michelinStars ?? 0,
      bibGourmand: Boolean(record.distinctions?.bibGourmand),
      worlds50Best: Boolean(record.distinctions?.worlds50Best),
      worlds50BestRank: record.distinctions?.worlds50BestRank ?? null,
      worlds50BestList: record.distinctions?.worlds50BestList ?? null,
    },
    reservation: {
      openTableUrl:
        reservationPlatform && /opentable/i.test(reservationPlatform)
          ? reservationUrl
          : null,
      links: reservationUrl
        ? [
            {
              url: reservationUrl,
              platform: reservationPlatform,
              provider: reservationPlatform,
              type: "reservation",
            },
          ]
        : [],
      difficulty: null,
      recommendedLeadTime: null,
      advice: null,
      channel: reservationPlatform
        ? {
            platform: reservationPlatform,
            url: reservationUrl,
            phone: record.reservation?.phone ?? null,
            notes: record.reservation?.notes ?? null,
            checkedAt: record.enrichedAt ?? null,
          }
        : null,
    },
    menu: {
      state: "missing",
      observedAt: null,
      observationAgeDaysAtExport: null,
      documentCount: 0,
      itemCount: 0,
      documents: [],
      items: [],
    },
    links: (record.sources ?? [])
      .filter((source): source is { source?: string; url: string } => Boolean(source.url))
      .map((source) => ({
        type: source.source === "instagram" ? "social" : "source",
        provider: source.source ?? "source",
        url: source.url,
        confidence: null,
        checkedAt: record.enrichedAt ?? null,
      })),
    media: {
      photoCount: 0,
      publicImageUrl: null,
      note: "No public restaurant photos in the V1 export.",
    },
    verification: {
      status: "machine_assembled_candidate",
      sourceCount: sourceNames.length,
      sourceNames,
      fieldProvenance: {},
      freshestSourceAt: record.enrichedAt ?? null,
      canonicalUpdatedAt: record.enrichedAt ?? null,
      snapshotGeneratedAt: record.enrichedAt ?? null,
      humanReviewedAt: null,
    },
    editorial: emptyEditorial(record.editorial?.status || "pending"),
    seo: {
      launchEligible: false,
      indexable: false,
      title: null,
      description: null,
      faq: [],
    },
  };
}

export function applyV1Menu(restaurant: SiteRestaurant, menu: V1MenuFile | null): SiteRestaurant {
  if (!menu) return restaurant;

  const items: MenuItem[] = (menu.items ?? []).map((item, index) => ({
    id: item.id ?? `${restaurant.slug}-menu-${index}`,
    documentId: item.documentId ?? null,
    name: item.name,
    description: item.description ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    category: item.category ?? null,
    sourceUrl: item.sourceUrl ?? menu.url ?? null,
    observedAt: item.observedAt ?? menu.observedAt ?? null,
    extractionConfidence: item.extractionConfidence ?? null,
    extractionLayer: item.extractionLayer ?? "v1_menu",
  }));

  const document: MenuDocument | null = menu.url
    ? {
        id: `${restaurant.slug}-menu-source`,
        sourceUrl: menu.url,
        fileType: null,
        language: null,
        confidence: null,
        extractionMethod: null,
        status: menu.status ?? null,
        lastCheckedAt: menu.observedAt ?? null,
      }
    : null;

  const state = items.length
    ? "structured_candidate"
    : document
      ? "document_only"
      : "missing";

  return {
    ...restaurant,
    menu: {
      ...restaurant.menu,
      publication: menu.publication,
      state,
      observedAt: menu.observedAt ?? restaurant.menu.observedAt,
      itemCount: items.length,
      // A menu file marked "missing" comes from a re-verification that found no official menu:
      // older unofficial sources (guides, press, delivery apps) must not resurface.
      documentCount: document ? 1 : menu.status === "missing" ? 0 : (restaurant.menu.documents ?? []).length,
      documents: document ? [document] : menu.status === "missing" ? [] : (restaurant.menu.documents ?? []),
      items,
    },
  };
}

export function toIndexRecord(restaurant: SiteRestaurant): RestaurantIndexRecord {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    neighborhood: restaurant.location.neighborhood ?? "Mexico City",
    borough: restaurant.location.borough,
    cuisine: restaurant.food.cuisine,
    priceLevel: restaurant.food.priceLevel,
    rating: restaurant.experience.rating,
    reviewCount: restaurant.experience.reviewCount,
    michelin: restaurant.distinctions.michelin,
    worlds50Best: restaurant.distinctions.worlds50Best,
    menuState: restaurant.menu.state,
    menuObservedAt: restaurant.menu.observedAt,
    sourceCount: restaurant.verification.sourceCount,
    freshestSourceAt: restaurant.verification.freshestSourceAt,
    launchEligible: restaurant.seo.launchEligible,
    indexable: restaurant.seo.indexable === true,
    editorialStatus: restaurant.editorial.status,
    qaFlags: [],
  };
}

export function mergeObjectiveCollections(
  base: SiteCollection[],
  restaurants: SiteRestaurant[],
): SiteCollection[] {
  const map = new Map<string, SiteCollection>();
  for (const collection of base) {
    map.set(collection.id, {
      ...collection,
      restaurantSlugs: [...collection.restaurantSlugs],
    });
  }

  const upsert = (type: string, slug: string, label: string, restaurantSlug: string) => {
    if (!slug) return;
    const id = `${type}:${slug}`;
    const existing = map.get(id);
    if (existing) {
      if (!existing.restaurantSlugs.includes(restaurantSlug)) {
        existing.restaurantSlugs.push(restaurantSlug);
      }
      existing.restaurantCount = existing.restaurantSlugs.length;
      return;
    }
    map.set(id, {
      id,
      type,
      slug,
      label,
      restaurantCount: 1,
      restaurantSlugs: [restaurantSlug],
    });
  };

  for (const restaurant of restaurants) {
    const neighborhood = restaurant.location.neighborhood;
    if (neighborhood) {
      upsert("neighborhood", slugifyLabel(neighborhood), neighborhood, restaurant.slug);
    }
    const borough = restaurant.location.borough;
    if (borough) {
      upsert("borough", slugifyLabel(borough), borough, restaurant.slug);
    }
    const cuisine = restaurant.food.cuisine;
    if (cuisine) {
      upsert("cuisine", slugifyLabel(cuisine), cuisine, restaurant.slug);
    }
    if (restaurant.distinctions.michelin) {
      upsert(
        "distinction",
        "michelin",
        "Michelin-recognized restaurants",
        restaurant.slug,
      );
    }
    if (restaurant.distinctions.worlds50Best) {
      upsert("distinction", "worlds-50-best", "World's 50 Best", restaurant.slug);
    }
  }

  return [...map.values()]
    .map((collection) => ({
      ...collection,
      restaurantCount: collection.restaurantSlugs.length,
    }))
    .filter((collection) => collection.restaurantCount > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}
