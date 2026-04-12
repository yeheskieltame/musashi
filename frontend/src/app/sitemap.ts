import type { MetadataRoute } from "next";

const SITE = "https://musashi-agent.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Anchor sections on the landing page — exposed so search engines can
  // surface deep links for queries like "MUSASHI gate pipeline" or
  // "MUSASHI 0G protocol".
  const landingAnchors = [
    "problem",
    "pipeline",
    "algorithms",
    "protocol",
    "architecture-diagram",
    "agent-memory",
    "deploy-agent",
    "setup",
    "demo",
  ];

  return [
    {
      url: `${SITE}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/dashboard`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...landingAnchors.map((id) => ({
      url: `${SITE}/#${id}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
