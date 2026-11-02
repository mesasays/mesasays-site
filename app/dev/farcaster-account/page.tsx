import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FarcasterAccountSetup } from "@/components/dev/FarcasterAccountSetup";
import { MESASAYS_APP_KEY } from "@/lib/say/farcaster/config";

// Local-only page: Jules creates the MesaSays Farcaster account with his own wallet (custody 0xA730…0350).
// It does not exist in production (nor in the static IPFS copy). Nothing is sent without a signature in his wallet.
// The account exists since 2026-11-01 (fid 3357281); the page stays to check it or to add a new key.

export const metadata: Metadata = { title: "Compte Farcaster MesaSays (local)", robots: { index: false, follow: false } };

export default function FarcasterAccountPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="ms-page">
      <h1 className="ms-title">Compte Farcaster MesaSays</h1>
      <FarcasterAccountSetup publicKey={MESASAYS_APP_KEY} />
    </main>
  );
}
