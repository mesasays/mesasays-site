import "server-only";

import { LONG_CAST_BYTES } from "@/lib/say/relayed";
import { hubList } from "@/lib/say/farcaster/hub";
import type { SayMode } from "@/lib/say/types";

// Every Farcaster setting comes from environment variables (Vercel → Settings → Environment Variables).
// The full list, with what to put where: docs/SAY_FARCASTER.md.
//
//   SAY_BACKEND=farcaster            read and write Say on Farcaster (otherwise supabase / postgres)
//   SAY_FARCASTER_FID                the MesaSays account's fid (a number)
//   SAY_FARCASTER_SIGNER_KEY         its Ed25519 app key, 64 hex characters (secret: Vercel only)
//   SAY_FARCASTER_RELAY              off | dry-run | live   (default dry-run: messages built, never sent)
//   SAY_FARCASTER_HUBS               comma-separated hub URLs (default: lib/say/farcaster/hub.ts)
//   SAY_FARCASTER_CHANNEL_URL        the /mesasays channel's parent URL, once it exists (optional)
//   SAY_PASSKEY_ORIGINS              comma-separated sites allowed to ask for passkey signatures
//   SAY_RELAY_ALLOW_UNSIGNED=1       relay unsigned posts too (default: a signature is required)
//   SAY_RELAY_MAX_PER_HOUR           relayed posts per hour per server instance, all authors (default 30)

/** The MesaSays account's registered app key (public), fid 3357281, added on Optimism 2026-11-01. */
export const MESASAYS_APP_KEY = "0x3359838606f387ffe95adf80ab754b03107b2048864ad711384a8f5b6c6f43d5";

export const isFarcasterBackend = () => process.env.SAY_BACKEND === "farcaster";

const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3206", "http://127.0.0.1:3000", "http://127.0.0.1:3206"];

export function farcasterSettings() {
  const fid = Number(process.env.SAY_FARCASTER_FID ?? "");
  const key = (process.env.SAY_FARCASTER_SIGNER_KEY ?? "").trim().replace(/^0x/, "");
  const wanted = (process.env.SAY_FARCASTER_RELAY ?? "dry-run").trim();
  const hasAccount = Number.isSafeInteger(fid) && fid > 0 && /^[0-9a-fA-F]{64}$/.test(key);
  // "live" without an account falls back to dry run: nothing can be published without the key anyway.
  const relay: SayMode["relay"] = wanted === "off" ? "off" : wanted === "live" && hasAccount ? "live" : "dry-run";
  const configured = (process.env.SAY_PASSKEY_ORIGINS ?? "").split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  const origins = [...new Set([...(configured.length ? configured : ["https://mesasays.com"]), ...(process.env.NODE_ENV === "production" ? [] : DEV_ORIGINS)])];
  return {
    fid: Number.isSafeInteger(fid) && fid > 0 ? fid : null,
    key: hasAccount ? key : null,
    relay,
    origins,
    hubs: hubList(),
    channel: (process.env.SAY_FARCASTER_CHANNEL_URL ?? "").trim().replace(/\/$/, "") || null,
    // Public half of the MesaSays app key (infra/farcaster/app-key.pub.json); override for another account.
    signer: (process.env.SAY_FARCASTER_SIGNER_PUBLIC ?? MESASAYS_APP_KEY).trim().toLowerCase() || null,
    allowUnsigned: process.env.SAY_RELAY_ALLOW_UNSIGNED === "1",
    maxPerHour: Math.max(1, Number(process.env.SAY_RELAY_MAX_PER_HOUR) || 30),
  };
}

/** Footer + room for the longest name: what is left of a 1,024-byte long cast for the post itself. */
export const RELAY_TEXT_BYTES = LONG_CAST_BYTES - 120;

export function sayMode(): SayMode {
  if (!isFarcasterBackend()) return { backend: "database", relay: "off", allowUnsigned: true, maxBytes: 0 };
  const settings = farcasterSettings();
  return { backend: "farcaster", relay: settings.relay, allowUnsigned: settings.allowUnsigned, maxBytes: RELAY_TEXT_BYTES };
}
