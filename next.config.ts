import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// Build target, chosen with MESASAYS_TARGET:
// - unset: the current Vercel-style build (unchanged).
// - "server": same app, packaged as a standalone Node server for our own machine (infra/).
// - "ipfs": the guide as plain files in out/ (no server), for IPFS and mesasays.eth.
//   Say cannot run without a server, so scripts/build-ipfs.mjs swaps it for a static notice.
const TARGET = process.env.MESASAYS_TARGET ?? "";
if (TARGET && TARGET !== "server" && TARGET !== "ipfs") throw new Error(`Unknown MESASAYS_TARGET: ${TARGET}`);

const baseConfig: NextConfig = {
  devIndicators: false,
  // Lets a phone on the same wifi load the dev server (demo previews); no effect in production.
  allowedDevOrigins: [],
  poweredByHeader: false,
  // Say on Farcaster (server only): the protocol library is loaded by Node as is, not bundled.
  serverExternalPackages: ["@farcaster/core"],
  async headers() {
    // Baseline browser protections; a CSP is deferred (inline scripts from Next and Analytics).
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // Preserve every old path and query string during the domain migration.
    const hosts = ["thediningdispatch.fr", "www.thediningdispatch.fr", "www.mesasays.com"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host.replaceAll(".", "\\.") }],
      destination: "https://mesasays.com/:path*",
      permanent: true,
    }));
    // Repositioning of 2026-11-05: the "decentralized" manifesto pages fold into About, and Say is paused
    // (its code stays in app/say and components/say, dormant). permanent → 308.
    const paused = [
      { source: "/decentralized", destination: "/unbiased", permanent: true },
      { source: "/es/descentralizado", destination: "/es/imparcial", permanent: true },
      { source: "/say", destination: "/", permanent: true },
      { source: "/say/:path*", destination: "/", permanent: true },
    ];
    return [...hosts, ...paused];
  },
  outputFileTracingIncludes: {
    "*": [
      "./app/fonts/*.ttf",
      "./restaurant-intelligence/v1/site-data/**",
      "./restaurant-intelligence/v1/enriched/**",
      "./restaurant-intelligence/v1/menus/**",
      "./restaurant-intelligence/v1/registry.json",
      "./restaurant-intelligence/v1/allowlist.json",
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "./restaurant-intelligence/archive/**",
      "./restaurant-intelligence/pipeline/**",
      "./restaurant-intelligence/schema/**",
      "./restaurant-intelligence/site-data/**",
      // Static IPFS export output and its build stash, never part of the server.
      "./out/**",
      "./.ipfs-build/**",
    ],
  },
};

// Static export: no headers/redirects (a gateway serves the files as they are), folders with
// index.html so IPFS gateways resolve /restaurants/x/ without a server, and no image server.
const ipfsConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    resolveAlias: {
      // The live conversation block (server actions + /say/threads) becomes a link to mesasays.com/say.
      "@/components/say/Say": "./components/say/SayStatic.tsx",
    },
  },
};

const nextConfig: NextConfig =
  TARGET === "ipfs" ? ipfsConfig : TARGET === "server" ? { ...baseConfig, output: "standalone" } : baseConfig;

export default nextConfig;
