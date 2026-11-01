import type { Metadata } from "next";
import { PrivacyView } from "@/components/views/TrustViews";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Privacidad",
    description: "Sin analítica, sin cookies, sin rastreo. Qué guarda Say cuando publicas y quién aloja el sitio.",
    path: "/es/privacidad",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default function Page() {
  return <PrivacyView locale="es" />;
}
