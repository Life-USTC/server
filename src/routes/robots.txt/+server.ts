import { CONTENT_SIGNAL } from "@/lib/seo/content-signal";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  const origin = getCanonicalOrigin();

  return new Response(
    [
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
    {
      headers: {
        "Content-Signal": CONTENT_SIGNAL,
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
