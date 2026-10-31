import { UpdatesView } from "@/components/views/UpdatesView";
import { listUpdates } from "@/lib/restaurants/updates";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Qué cambió en el catálogo de restaurantes de la CDMX",
  description: "Bitácora fechada de restaurantes agregados, reverificados en la fuente, cerrados o retirados en la Ciudad de México.",
  path: "/es/actualizaciones",
  robots: publicRobots(),
  locale: "es_MX",
});

export default async function ActualizacionesPage() {
  return <UpdatesView entries={await listUpdates()} locale="es" />;
}
