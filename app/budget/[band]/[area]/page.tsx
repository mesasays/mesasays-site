import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetBandView } from "@/components/views/BudgetView";
import { toEur, toUsd } from "@/lib/currency";
import { listBudgetIndex } from "@/lib/data";
import { BANDS, bandFromKey, bandKey, bandRows } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const dynamicParams = false;

export async function generateStaticParams() {
  const index = await listBudgetIndex("en");
  return BANDS.flatMap((band) =>
    (index.areasByBand[bandKey(band)] ?? []).map((entry) => ({ band: bandKey(band, "en"), area: entry.areaSlug })),
  );
}

async function resolve(params: PageProps<"/budget/[band]/[area]">["params"]) {
  const { band: key, area } = await params;
  const band = bandFromKey(key);
  if (!band || bandKey(band, "en") !== key) return null;
  const index = await listBudgetIndex("en");
  const entry = (index.areasByBand[bandKey(band)] ?? []).find((item) => item.areaSlug === area);
  return entry ? { band, key, entry, index } : null;
}

export async function generateMetadata({ params }: PageProps<"/budget/[band]/[area]">): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { band, key, entry, index } = found;
  const amount = (band.max ?? band.min)!;
  const count = bandRows(index, band, entry.areaSlug).length;
  return pageMetadata({
    title: `Where to eat in ${entry.area} for ${band.max !== null ? "under" : "over"} ${amount} pesos (~$${toUsd(amount)} / €${toEur(amount)})`,
    description: `${count} restaurants in ${entry.area}, Mexico City, where a meal per person costs ${band.max !== null ? "under" : "over"} ${amount} MXN (~$${toUsd(amount)}), from dated official menus.`,
    path: `/budget/${key}/${entry.areaSlug}`,
    robots: publicRobots(),
  });
}

export default async function BudgetAreaPage({ params }: PageProps<"/budget/[band]/[area]">) {
  const found = await resolve(params);
  if (!found) notFound();
  return <BudgetBandView index={found.index} band={found.band} areaSlug={found.entry.areaSlug} locale="en" />;
}
