import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

const ROUTES = [
  "/",
  "/courses",
  "/sections",
  "/teachers",
  "/bus-map",
  "/api-docs",
  "/privacy",
  "/terms",
];

export const GET: RequestHandler = () => {
  const origin = getCanonicalOrigin();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
