import type { MetadataRoute } from "next";
import { LEGAL_INFO } from "@/lib/legal";

const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/presentation", "/brand/"],
        disallow: [
          "/api/",
          "/login",
          "/media/",
          ...(LEGAL_INFO.draft ? ["/mentions-legales", "/confidentialite"] : []),
          "/change-password",
          "/dashboard",
          "/sessions",
          "/tasks",
          "/bugs",
          "/files",
          "/editor",
          "/infrastructure",
          "/console",
          "/terminal",
          "/users",
          "/team",
          "/settings",
          "/audit-logs",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
