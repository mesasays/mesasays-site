import { loadCatalog, loadCollections } from "@/lib/restaurants/load";
import { llmsIndexText } from "@/lib/geo/llms";

export const dynamic = "force-static";

export async function GET() {
  const [restaurants, collections] = await Promise.all([
    loadCatalog(),
    loadCollections(),
  ]);
  const body = llmsIndexText({ restaurants, collections });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
