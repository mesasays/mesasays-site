import type { Metadata } from "next";
import { UnbiasedView } from "@/components/views/UnbiasedView";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Imparcial, y por qué — el proyecto y los valores de Mesasays",
  description:
    "Mesasays construye el asistente de restaurantes que lo sabe todo de la Ciudad de México. Ningún restaurante paga, sin anuncios, sin comisión, sin rastreo. Cartas y precios reales, con fecha.",
  path: "/es/imparcial",
  robots: publicRobots(),
  locale: "es_MX",
});

export default function Page() {
  return <UnbiasedView locale="es" />;
}
