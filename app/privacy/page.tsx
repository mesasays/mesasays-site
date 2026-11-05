import type { Metadata } from "next";
import { PrivacyView } from "@/components/views/TrustViews";
import { pageMetadata, publicRobots } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Privacy",
    description: "No analytics, no cookies, no tracking. What earlier Say posts store, and who hosts the site.",
    path: "/privacy",
    robots: publicRobots(),
  });
}

export default function Page() {
  return <PrivacyView locale="en" />;
}
