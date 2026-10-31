import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a phone on the same wifi load the dev server (demo previews); no effect in production.
  allowedDevOrigins: [],
  poweredByHeader: false,
  async headers() {
    // Baseline browser protections; a CSP is deferred (inline scripts from Next and Analytics).
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // Preserve every old path and query string during the domain migration.
    return ["thediningdispatch.fr", "www.thediningdispatch.fr", "www.mesasays.com"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host.replaceAll(".", "\\.") }],
      destination: "https://mesasays.com/:path*",
      permanent: true,
    }));
  },
  outputFileTracingIncludes: {
    "*": [
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
    ],
  },
};

export default nextConfig;
