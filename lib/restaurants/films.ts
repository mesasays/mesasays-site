import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { V1_ROOT } from "@/lib/restaurants/paths";

// Documentaries filmed by The Dining Dispatch, linked to the restaurant they show.
export type Film = {
  videoId: string;
  restaurantSlug: string;
  title: string;
  publishedAt: string;
  durationSeconds: number;
  summary: string;
};

let films: Promise<Film[]> | null = null;

export function listFilms() {
  films ??= readFile(join(V1_ROOT, "films.json"), "utf8")
    .then((raw) => JSON.parse(raw) as Film[])
    .catch(() => []);
  return films;
}

export async function filmsForRestaurant(slug: string) {
  return (await listFilms()).filter((film) => film.restaurantSlug === slug);
}

// Thumbnails are served from /public/films (scripts/fetch-film-thumbs.mjs), never from i.ytimg.com:
// a visitor loading a page must not reveal their IP to Google.
export const filmThumb = (videoId: string, size: "hq" | "mq" = "hq") => `/films/${videoId}-${size}default.jpg`;
export const filmUrl = (film: Film) => `https://www.youtube.com/watch?v=${film.videoId}`;
/** Google requires a full date-time with time zone for VideoObject.uploadDate; only the day is recorded. */
export const filmUploadDate = (film: Film) => `${film.publishedAt}T12:00:00-06:00`;
export { CHANNEL_URL, INSTAGRAM_URL } from "@/lib/site";
