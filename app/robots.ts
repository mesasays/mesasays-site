import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "PerplexityBot",
  "ClaudeBot",
  "Anthropic-AI",
  "Applebot",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/invite", "/vault", "/graph", "/auth", "/api"],
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: ["/", "/llms.txt", "/llms-full.txt", "/sitemap.xml"],
        disallow: ["/invite", "/vault", "/graph", "/auth", "/api"],
      })),
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
