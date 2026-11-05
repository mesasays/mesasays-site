import type { Metadata } from "next";
import { SayFeed } from "@/components/say/Say";
import { listThreads } from "@/lib/say/db";
import { sayMode } from "@/lib/say/farcaster/config";
import { sayPlaces } from "@/lib/say/load";
import { pageMetadata } from "@/lib/seo";

// Rendered on each visit: conversations change between deployments.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Say: what people say about Mexico City restaurants",
  description: "Ask about a Mexico City restaurant, or say what you ate: what to order, what to skip. No stars, no scores.",
  path: "/say",
  // The list itself stays out of search until it has real conversations; each conversation is indexed on its own page.
  robots: { index: false, follow: true },
});

export default async function SayPage() {
  const [threads, places] = await Promise.all([listThreads().catch(() => []), sayPlaces()]);
  return (
    <main className="ms-page ms-say-page">
      <h1 className="ms-title say-page-title">What people say</h1>
      <p className="say-page-lede">Ask, or say what to order and what to skip. No stars.</p>
      <SayFeed threads={threads} places={places} mode={sayMode()} />
    </main>
  );
}
