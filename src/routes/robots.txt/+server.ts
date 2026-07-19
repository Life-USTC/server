import { createCrawlerDiscoveryResponse } from "@/lib/seo/crawler-discovery-response";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const origin = getCanonicalOrigin();

  return createCrawlerDiscoveryResponse({
    body: [
      "User-agent: *",
      "Allow: /",
      "Allow: /api/docs$",
      "Allow: /api/docs/",
      "Disallow: /admin$",
      "Disallow: /admin/",
      "Disallow: /api$",
      "Disallow: /api/",
      "Disallow: /oauth$",
      "Disallow: /oauth/",
      "Disallow: /settings$",
      "Disallow: /settings/",
      "Disallow: /signin$",
      "Disallow: /signin/",
      "Disallow: /welcome$",
      "Disallow: /welcome/",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
    contentType: "text/plain; charset=utf-8",
    request,
  });
};
