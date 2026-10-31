import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SayThread, type SayPlace } from "@/components/say/Say";
import { getThread } from "@/lib/say/db";
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
  const thread = await getThread(id).catch(() => null);
  if (!thread) notFound();
  const places = (await Promise.all(thread.slugs.map(sayRestaurant))).filter((place): place is SayPlace => Boolean(place));
  return (
    <main className="ds-page ds-say-page">
      <SayThread thread={thread} places={places} />
    </main>
  );
}
