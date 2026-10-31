import { restaurantFactsText } from "@/lib/geo/llms";
import { listFilms } from "@/lib/restaurants/films";
import { loadRegistrySlugs, loadRestaurantBySlug } from "@/lib/restaurants/load";
import { absoluteUrl } from "@/lib/site";

// Plain-text fact sheet per restaurant (/facts/<slug>.txt) for assistants and crawlers.
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await loadRegistrySlugs()).map((slug) => ({ file: `${slug}.txt` }));
}

export async function GET(_request: Request, { params }: RouteContext<"/facts/[file]">) {
  const { file } = await params;
  const slug = file.replace(/\.txt$/, "");
  const restaurant = file.endsWith(".txt") ? await loadRestaurantBySlug(slug) : null;
  if (!restaurant) return new Response("Not found\n", { status: 404 });
  return new Response(restaurantFactsText(restaurant, await listFilms()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
      // The HTML page is the canonical version; this file is its plain-text twin.
      Link: `<${absoluteUrl(`/restaurants/${slug}`)}>; rel="canonical"`,
    },
  });
}
