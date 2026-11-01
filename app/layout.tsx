import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SiteHeader } from "@/components/SiteHeader";
import { catalogCounts } from "@/lib/data";
import { siteGraphJsonLd } from "@/lib/jsonld";
import { defaultMetadata } from "@/lib/seo";
import { SITE_LOCALE, SITE_NAME, SITE_SERP_DESCRIPTION } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_SERP_DESCRIPTION,
  applicationName: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "only light",
  themeColor: "#fbf9f4",
};

async function headerStats() {
  const counts = await catalogCounts();
  return { restaurants: counts.restaurants, menus: counts.menus, updated: counts.latestCheck };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={SITE_LOCALE}>
      <body>
        <div className="ms-shell">
          <JsonLd data={siteGraphJsonLd()} />
          <SiteHeader stats={await headerStats()} />
          <span id="content" tabIndex={-1} />
          {children}
        </div>
      </body>
    </html>
  );
}
