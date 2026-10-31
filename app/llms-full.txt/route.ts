import { loadCatalog } from "@/lib/restaurants/load";
import { llmsFullText } from "@/lib/geo/llms";
import { listFilms } from "@/lib/restaurants/films";

export const dynamic = "force-static";

export async function GET() {
  const restaurants = await loadCatalog();
  return new Response(llmsFullText(restaurants, await listFilms()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
