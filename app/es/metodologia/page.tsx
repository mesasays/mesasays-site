import type { Metadata } from "next";
import { MethodologyView } from "@/components/views/TrustViews";
import { catalogCounts } from "@/lib/data";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Metodología: cómo verificamos precios y datos de restaurantes en la CDMX",
    description: "De dónde vienen los precios, cartas, canales de reservación y costos por persona de Mesasays, cómo se fechan y se revisan, y qué nunca usamos.",
    path: "/es/metodologia",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function Page() {
  return <MethodologyView counts={await catalogCounts()} locale="es" />;
}
