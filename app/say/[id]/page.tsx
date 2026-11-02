import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SayThread, type SayPlace } from "@/components/say/Say";
import { getThread } from "@/lib/say/db";
import { sayMode } from "@/lib/say/farcaster/config";
import { sayRestaurant } from "@/lib/say/load";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 155 ? `${clean.slice(0, clean.lastIndexOf(" ", 152))}…` : clean;
}

export async function generateMetadata({ params }: PageProps<"/say/[id]">): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id).catch(() => null);
  if (!thread) return { title: "Conversation not found", robots: { index: false, follow: false } };
  return pageMetadata({
    title: thread.title,
    description: excerpt(thread.body || thread.replies[0]?.body || thread.title),
    path: `/say/${thread.id}`,
    // A question nobody answered is a thin page: index a conversation once someone has replied.
    robots: { index: thread.replies.length > 0, follow: true },
  });
}

export default async function SayThreadPage({ params }: PageProps<"/say/[id]">) {
  const { id } = await params;
  // A hub that does not answer is not a missing conversation: say so instead of a 404.
  let thread: Awaited<ReturnType<typeof getThread>> = null;
  try {
    thread = await getThread(id);
  } catch {
    return (
      <main className="ms-page ms-say-page">
        <h1 className="ms-title">Conversation temporarily unavailable</h1>
        <p className="ms-lede">
          Conversations live on Farcaster and the network didn&apos;t answer just now. Try again in a minute.
          <br />
          <span lang="es-MX">La red no respondió. Inténtalo en un minuto.</span>
        </p>
      </main>
    );
  }
  if (!thread) notFound();
  const places = (await Promise.all(thread.slugs.map(sayRestaurant))).filter((place): place is SayPlace => Boolean(place));
  return (
    <main className="ms-page ms-say-page">
      <SayThread thread={thread} places={places} mode={sayMode()} />
    </main>
  );
}
