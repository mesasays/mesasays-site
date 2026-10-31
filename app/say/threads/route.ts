import type { SayPlace } from "@/components/say/Say";
import { listThreads } from "@/lib/say/db";
import { sayRestaurant } from "@/lib/say/load";

// Conversations linked to one restaurant, for the "People say" block. Restaurant pages stay static
// and load this after the page opens; the conversation pages themselves are rendered on the server.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return Response.json({ threads: [], places: [] }, { status: 400 });
  try {
    const threads = await listThreads({ slug, limit: 20 });
    // Names of the other restaurants these conversations are linked to (the page itself only knows its own).
    const slugs = [...new Set(threads.flatMap((thread) => thread.slugs))];
    const places = (await Promise.all(slugs.map(sayRestaurant))).filter((place): place is SayPlace => Boolean(place));
    return Response.json({ threads, places });
  } catch {
    return Response.json({ threads: [], places: [] }, { status: 503 });
  }
}
