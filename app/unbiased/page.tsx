import type { Metadata } from "next";
import { UnbiasedView } from "@/components/views/UnbiasedView";
import { pageMetadata, publicRobots } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Unbiased, and why — the Mesasays project and values",
  description:
    "Mesasays is building the restaurant assistant that knows all of Mexico City. No restaurant pays, no ads, no commission, no tracking. Real menus and prices, dated.",
  path: "/unbiased",
  robots: publicRobots(),
});

export default function Page() {
  return <UnbiasedView locale="en" />;
}
