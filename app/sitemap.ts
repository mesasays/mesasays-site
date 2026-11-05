import type { MetadataRoute } from "next";
import { listBudgetIndex, listCollectionSlugs, listCollections, listDishSummaries, listRestaurantSlugs } from "@/lib/data";
import { BANDS, bandKey, budgetPath } from "@/lib/restaurants/budget";
import { MIN_RESTAURANTS_PER_DISH } from "@/lib/restaurants/dishes";
import { loadCatalog } from "@/lib/restaurants/load";
import { absoluteUrl } from "@/lib/site";

// Rendered once at build time (also required by the static IPFS export).
export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, collectionParams, collections, catalog] = await Promise.all([
    listRestaurantSlugs(),
    listCollectionSlugs(),
    listCollections(),
    loadCatalog(),
  ]);

  const bySlug = new Map(catalog.map((row) => [row.slug, row]));
  const collectionByParam = new Map(
    collections.map((row) => [`${row.type}--${row.slug}`, row]),
  );

  const lastMod = (value: string | null | undefined) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const catalogStamp = catalog
    .map((row) => row.verification.freshestSourceAt ?? row.menu.observedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const catalogLastMod = lastMod(catalogStamp);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/restaurants"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/prices"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/collections"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/llms.txt"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/llms-full.txt"),
      lastModified: catalogLastMod,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  const restaurants: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: absoluteUrl(`/restaurants/${slug}`),
    lastModified: lastMod(
      bySlug.get(slug)?.verification.freshestSourceAt ??
        bySlug.get(slug)?.menu.observedAt,
    ),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collectionParams
    .filter((param) => (collectionByParam.get(param)?.restaurantSlugs.length ?? 0) >= 3)
    .map((param) => ({
    url: absoluteUrl(`/collections/${param}`),
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: lastMod(
      collectionByParam.get(param)?.restaurantSlugs
        .map((slug) => bySlug.get(slug)?.verification.freshestSourceAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1),
    ),
  }));

  const dishRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/dishes"), lastModified: catalogLastMod, changeFrequency: "weekly", priority: 0.9 },
    ...(await listDishSummaries())
      .filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH)
      .map((dish) => ({
        url: absoluteUrl(`/dishes/${dish.slug}`),
        lastModified: catalogLastMod,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];

  const visibleDishes = (await listDishSummaries()).filter((dish) => dish.restaurants >= MIN_RESTAURANTS_PER_DISH);
  const spanishRoutes: MetadataRoute.Sitemap = [
    ...["/es", "/es/restaurantes", "/es/precios", "/es/platos", "/es/actualizaciones", "/updates"].map((path) => ({
      url: absoluteUrl(path),
      lastModified: catalogLastMod,
      changeFrequency: "weekly" as const,
      priority: path === "/es" ? 0.9 : 0.8,
    })),
    ...visibleDishes.map((dish) => ({
      url: absoluteUrl(`/es/platos/${dish.slug}`),
      lastModified: catalogLastMod,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...slugs.map((slug) => ({
      url: absoluteUrl(`/es/restaurantes/${slug}`),
      lastModified: lastMod(bySlug.get(slug)?.verification.freshestSourceAt ?? bySlug.get(slug)?.menu.observedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  // Budget pages (per band, and per band × neighborhood when there are enough restaurants), trust pages, films.
  const budget = await listBudgetIndex("en");
  const budgetPaths = ["en", "es"].flatMap((locale) => {
    const l = locale as "en" | "es";
    return [
      budgetPath(l),
      ...BANDS.flatMap((band) => [
        budgetPath(l, band),
        ...(budget.areasByBand[bandKey(band)] ?? []).map((entry) => budgetPath(l, band, entry.areaSlug)),
      ]),
    ];
  });
  const extraRoutes: MetadataRoute.Sitemap = [
    ...budgetPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: lastMod(budget.latestCheck),
      changeFrequency: "weekly" as const,
      priority: path.split("/").length <= 3 ? 0.9 : 0.8,
    })),
    ...["/films", "/es/peliculas", "/about", "/es/acerca", "/methodology", "/es/metodologia", "/privacy", "/es/privacidad", "/unbiased", "/es/imparcial"].map((path) => ({
      url: absoluteUrl(path),
      lastModified: catalogLastMod,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [...staticRoutes, ...extraRoutes, ...dishRoutes, ...restaurants, ...spanishRoutes, ...collectionRoutes];
}
