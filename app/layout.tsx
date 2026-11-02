import type { Metadata, Viewport } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SiteHeader } from "@/components/SiteHeader";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={SITE_LOCALE}>
      <body>
        <div className="ms-shell">
          <JsonLd data={siteGraphJsonLd()} />
          <SiteHeader />
          <span id="content" tabIndex={-1} />
          {children}
        </div>
      </body>
    </html>
  );
}
