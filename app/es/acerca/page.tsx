import type { Metadata } from "next";
import { AboutView } from "@/components/views/TrustViews";
import { catalogCounts } from "@/lib/data";
import { listFilms } from "@/lib/restaurants/films";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Quiénes somos: Mesasays y The Dining Dispatch",
    description: "Mesasays lo publica The Dining Dispatch, un canal independiente de documentales sobre restaurantes. Ningún restaurante paga por aparecer; cada dato se verifica en la fuente oficial y se fecha.",
    path: "/es/acerca",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function Page() {
  return <AboutView counts={await catalogCounts()} films={await listFilms()} locale="es" />;
}
