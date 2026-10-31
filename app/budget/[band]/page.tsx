import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetBandView } from "@/components/views/BudgetView";
import { toEur, toUsd } from "@/lib/currency";
import { listBudgetIndex } from "@/lib/data";
import { BANDS, bandFromKey, bandKey, bandRows } from "@/lib/restaurants/budget";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return BANDS.map((band) => ({ band: bandKey(band, "en") }));
}

export async function generateMetadata({ params }: PageProps<"/budget/[band]">): Promise<Metadata> {
  const { band: key } = await params;
  const band = bandFromKey(key);
  if (!band) return {};
  const count = bandRows(await listBudgetIndex("en"), band).length;
  const amount = (band.max ?? band.min)!;
  return pageMetadata({
    title: `Where to eat in Mexico City for ${band.max !== null ? "under" : "over"} ${amount} pesos (~$${toUsd(amount)} / €${toEur(amount)})`,
    description: `${count} Mexico City restaurants where a meal per person costs ${band.max !== null ? "under" : "over"} ${amount} MXN, from checked, dated official menus. Before drinks and tip.`,
    path: `/budget/${key}`,
    robots: publicRobots(),
  });
}

export default async function BudgetBandPage({ params }: PageProps<"/budget/[band]">) {
  const { band: key } = await params;
  const band = bandFromKey(key);
  if (!band || bandKey(band, "en") !== key) notFound();
  return <BudgetBandView index={await listBudgetIndex("en")} band={band} locale="en" />;
}
