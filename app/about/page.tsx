import type { Metadata } from "next";
import { AboutView } from "@/components/views/TrustViews";
import { catalogCounts } from "@/lib/data";
import { listFilms } from "@/lib/restaurants/films";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "About Mesasays: who publishes it, independence, corrections",
    description: "Mesasays is published by The Dining Dispatch, an independent restaurant film channel. No restaurant pays to be listed; every fact is checked on the official source and dated.",
    path: "/about",
    robots: publicRobots(),
  });
}

export default async function Page() {
  return <AboutView counts={await catalogCounts()} films={await listFilms()} locale="en" />;
}
