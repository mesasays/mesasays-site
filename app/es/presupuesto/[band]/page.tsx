import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetBandView } from "@/components/views/BudgetView";
import { toEur, toUsd } from "@/lib/currency";
import { listBudgetIndex } from "@/lib/data";
import { BANDS, bandFromKey, bandKey, bandRows } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return BANDS.map((band) => ({ band: bandKey(band, "es") }));
}

export async function generateMetadata({ params }: PageProps<"/es/presupuesto/[band]">): Promise<Metadata> {
  const { band: key } = await params;
  const band = bandFromKey(key);
  if (!band) return {};
  const count = bandRows(await listBudgetIndex("es"), band).length;
  const amount = (band.max ?? band.min)!;
  return pageMetadata({
    title: `Dónde comer en la CDMX por ${band.max !== null ? "menos" : "más"} de ${amount} pesos (≈ ${toUsd(amount)} USD · ${toEur(amount)} €)`,
    description: `${count} restaurantes de la Ciudad de México donde una comida por persona cuesta ${band.max !== null ? "menos" : "más"} de ${amount} MXN, según sus cartas oficiales verificadas y fechadas. Sin bebidas ni propina.`,
    path: `/es/presupuesto/${key}`,
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function BudgetBandPage({ params }: PageProps<"/es/presupuesto/[band]">) {
  const { band: key } = await params;
  const band = bandFromKey(key);
  if (!band || bandKey(band, "es") !== key) notFound();
  return <BudgetBandView index={await listBudgetIndex("es")} band={band} locale="es" />;
}
