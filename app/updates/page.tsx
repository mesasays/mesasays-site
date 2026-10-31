import { UpdatesView } from "@/components/views/UpdatesView";
import { listUpdates } from "@/lib/restaurants/updates";
import { pageMetadata, publicRobots } from "@/lib/seo";
import { SITE_CITY } from "@/lib/site";

export const metadata = pageMetadata({
  title: `What changed in the ${SITE_CITY} restaurant catalog`,
  description: `Dated log of restaurants added, re-checked at the source, closed or removed in ${SITE_CITY}.`,
  path: "/updates",
  robots: publicRobots(),
});

export default async function UpdatesPage() {
  return <UpdatesView entries={await listUpdates()} locale="en" />;
}
