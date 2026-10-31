import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetBandView } from "@/components/views/BudgetView";
import { toEur, toUsd } from "@/lib/currency";
import { listBudgetIndex } from "@/lib/data";
import { BANDS, bandFromKey, bandKey, bandRows } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const dynamicParams = false;

export async function generateStaticParams() {
  const index = await listBudgetIndex("es");
  return BANDS.flatMap((band) =>
    (index.areasByBand[bandKey(band)] ?? []).map((entry) => ({ band: bandKey(band, "es"), area: entry.areaSlug })),
  );
}

async function resolve(params: PageProps<"/es/presupuesto/[band]/[area]">["params"]) {
  const { band: key, area } = await params;
  const band = bandFromKey(key);
  if (!band || bandKey(band, "es") !== key) return null;
  const index = await listBudgetIndex("es");
  const entry = (index.areasByBand[bandKey(band)] ?? []).find((item) => item.areaSlug === area);
  return entry ? { band, key, entry, index } : null;
}

export async function generateMetadata({ params }: PageProps<"/es/presupuesto/[band]/[area]">): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { band, key, entry, index } = found;
  const amount = (band.max ?? band.min)!;
  const count = bandRows(index, band, entry.areaSlug).length;
  return pageMetadata({
    title: `Dónde comer en ${entry.area} por ${band.max !== null ? "menos" : "más"} de ${amount} pesos (≈ ${toEur(amount)} €)`,
    description: `${count} restaurantes en ${entry.area}, Ciudad de México, donde una comida por persona cuesta ${band.max !== null ? "menos" : "más"} de ${amount} MXN (≈ ${toUsd(amount)} USD), según sus cartas oficiales fechadas.`,
    path: `/es/presupuesto/${key}/${entry.areaSlug}`,
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function BudgetAreaPage({ params }: PageProps<"/es/presupuesto/[band]/[area]">) {
  const found = await resolve(params);
  if (!found) notFound();
  return <BudgetBandView index={found.index} band={found.band} areaSlug={found.entry.areaSlug} locale="es" />;
}
