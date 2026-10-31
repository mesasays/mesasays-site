import { alternatePath, localeOfPath } from "@/lib/i18n";
import type { Metadata } from "next";
import {
  SITE_CITY,
  SITE_GEO,
  SITE_LOCALE,
  SITE_LOCALE_ALT,
  SITE_LOCALE_OG,
  SITE_NAME,
  SITE_REGION_CODE,
  SITE_SERP_DESCRIPTION,
  absoluteUrl,
} from "@/lib/site";

export function pageMetadata({
  title,
  description,
  path,
  robots,
  locale = SITE_LOCALE_OG,
  image,
}: {
  title: string;
  description: string;
  path: string;
  robots?: Metadata["robots"];
  locale?: string;
  /** Absolute share-image URL; defaults to the site image. File-based images (restaurants EN) take precedence. */
  image?: string;
}): Metadata {
  const shareImage = image ?? absoluteUrl("/opengraph-image");
  const url = absoluteUrl(path);
  // English and Spanish twins advertise each other (hreflang); x-default is English.
  const pageLocale = localeOfPath(path);
  const twin = alternatePath(path, pageLocale === "en" ? "es" : "en");
  const hasTwin = alternatePath(twin, pageLocale) === path;
  const enPath = pageLocale === "en" ? path : twin;
  const esPath = pageLocale === "es" ? path : twin;
  const isRootTitle = title === SITE_NAME || title.startsWith(`${SITE_NAME} — `);
  const displayTitle = isRootTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: isRootTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      ...(hasTwin
        ? { languages: { en: absoluteUrl(enPath), "es-MX": absoluteUrl(esPath), "x-default": absoluteUrl(enPath) } }
        : {}),
      types: {
        "text/plain": absoluteUrl("/llms.txt"),
      },
    },
    robots,
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: displayTitle,
      description,
      locale,
      alternateLocale: locale === SITE_LOCALE_OG ? [SITE_LOCALE_ALT] : [SITE_LOCALE_OG],
      images: [{ url: shareImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description,
      images: [shareImage],
    },
  };
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_SERP_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  category: "restaurants",
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: false, email: false, address: false },
  alternates: {
    types: {
      "text/plain": absoluteUrl("/llms.txt"),
    },
  },
  other: {
    "geo.region": SITE_REGION_CODE,
    "geo.placename": SITE_CITY,
    "geo.position": `${SITE_GEO.latitude};${SITE_GEO.longitude}`,
    ICBM: `${SITE_GEO.latitude}, ${SITE_GEO.longitude}`,
    language: SITE_LOCALE,
  },
};

export function publicRobots(): Metadata["robots"] {
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function candidateRobots(indexable: boolean): Metadata["robots"] {
  return indexable
    ? publicRobots()
    : { index: false, follow: true };
}

export function privateRobots(): Metadata["robots"] {
  return { index: false, follow: false, nocache: true };
}
