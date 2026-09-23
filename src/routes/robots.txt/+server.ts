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
      "Disallow: /account/settings$",
      "Disallow: /account/settings/",
      "Disallow: /account/sign-in$",
      "Disallow: /account/sign-in/",
      "Disallow: /account/welcome$",
      "Disallow: /account/welcome/",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
    contentType: "text/plain; charset=utf-8",
    request,
  });
};
