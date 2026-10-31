import type { Metadata } from "next";
import { PricesView } from "@/components/views/PricesView";
import { listAllRestaurantRecords } from "@/lib/data";
import { buildPriceIndex } from "@/lib/restaurants/price-index";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "¿Cuánto cuesta comer en un restaurante en la CDMX? Índice de precios",
    description: "Precio mediano de los platillos según las cartas oficiales de restaurantes de la Ciudad de México, por colonia y tipo de cocina. Cada precio verificado y fechado.",
    path: "/es/precios",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function PreciosPage() {
  const restaurants = await listAllRestaurantRecords();
  const index = buildPriceIndex(restaurants, "es");
  return <PricesView index={index} locale="es" />;
}
