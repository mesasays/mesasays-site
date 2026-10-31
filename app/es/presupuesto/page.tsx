import type { Metadata } from "next";
import { BudgetIndexView } from "@/components/views/BudgetView";
import { listBudgetIndex } from "@/lib/data";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Dónde comer en la CDMX según tu presupuesto: costo por persona",
    description: "Restaurantes de la Ciudad de México agrupados por lo que cuesta una comida por persona (menos de 300, 500, 800 y 1,500 pesos), con equivalentes en dólares y euros. Calculado con cartas oficiales fechadas.",
    path: "/es/presupuesto",
    robots: publicRobots(),
    locale: "es_MX",
  });
}

export default async function BudgetIndexPage() {
  return <BudgetIndexView index={await listBudgetIndex("es")} locale="es" />;
}
