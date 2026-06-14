import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /oauth/",
      "Disallow: /settings/",
      "Disallow: /signin/",
      "Disallow: /welcome/",
      "Sitemap: /sitemap.xml",
      "",
    ].join("\n"),
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
