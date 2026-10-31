import type { Metadata } from "next";
import { BudgetIndexView } from "@/components/views/BudgetView";
import { listBudgetIndex } from "@/lib/data";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Where to eat in Mexico City on a budget: cost per person",
    description: "Mexico City restaurants grouped by what one meal costs per person (under 300, 500, 800 and 1,500 pesos), with dollar and euro equivalents. Computed from dated official menus.",
    path: "/budget",
    robots: publicRobots(),
  });
}

export default async function BudgetIndexPage() {
  return <BudgetIndexView index={await listBudgetIndex("en")} locale="en" />;
}
