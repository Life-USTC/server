import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () =>
  new Response("User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
