import type { MetadataRoute } from "next";
import { LEGAL_INFO } from "@/lib/legal";

const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/presentation`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];

  if (!LEGAL_INFO.draft) {
    entries.push(
      {
        url: `${baseUrl}/mentions-legales`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.3,
      },
      {
        url: `${baseUrl}/confidentialite`,
        lastModified: new Date(),
        changeFrequency: "yearly",
        priority: 0.3,
      },
    );
  }

  return entries;
}
