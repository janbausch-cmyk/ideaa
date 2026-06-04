import type { MetadataRoute } from "next";

// IDEAA-99: sitemap so Google can discover the German landing page, which now
// lives at the site root (/). We hardcode the canonical production host because
// metadataBase falls back to VERCEL_URL (the per-deploy hash hostname), which
// is not the URL we want search engines to index.
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
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE}/impressum`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
    {
      url: `${SITE}/datenschutz`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];
}
