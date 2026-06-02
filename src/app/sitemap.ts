import type { MetadataRoute } from "next";

// IDEAA-99: sitemap so Google can discover /geschaeftsidee-validieren.
// We hardcode the canonical production host because metadataBase falls back
// to VERCEL_URL (the per-deploy hash hostname), which is not the URL we want
// search engines to index.
const SITE = "https://ideaa-two.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE}/geschaeftsidee-validieren`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
