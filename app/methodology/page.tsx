import type { Metadata } from "next";
import { MethodologyView } from "@/components/views/TrustViews";
import { catalogCounts } from "@/lib/data";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Methodology: how Mexico City restaurant facts and prices are checked",
    description: "Where Mesasays prices, menus, booking channels and cost-per-person estimates come from, how they are dated and re-checked, and what is never used.",
    path: "/methodology",
    robots: publicRobots(),
  });
}

export default async function Page() {
  return <MethodologyView counts={await catalogCounts()} locale="en" />;
}
