import type { Metadata } from "next";
import { ProofView } from "@/components/say/ProofView";
import { pageMetadata } from "@/lib/seo";

// Landing page of the proof link under every relayed Say post on Farcaster. The proof itself is in the
// part of the link after "#", which browsers never send to a server: this page decodes it in the browser.
export const metadata: Metadata = pageMetadata({
  title: "Say proof",
  description: "The signature behind a post published on Farcaster by MesaSays, and how to check it without us.",
  path: "/proof",
  robots: { index: false, follow: true },
});

export default function ProofPage() {
  return (
    <main className="ms-page ms-say-page">
      <h1 className="ms-title say-page-title">Say proof</h1>
      <ProofView />
    </main>
  );
}
