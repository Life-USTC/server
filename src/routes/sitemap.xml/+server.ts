import {
  getCachedSitemap,
  requestMatchesSitemapEtag,
} from "@/features/catalog/server/sitemap-cache";
import { prisma } from "@/lib/db/prisma";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Cloudflare-CDN-Cache-Control":
    "public, max-age=3600, stale-while-revalidate=21600",
  "Content-Type": "application/xml; charset=utf-8",
};

const STATIC_ROUTES = [
  "/",
  "/courses",
  "/sections",
  "/teachers",
  "/bus-map",
  "/api/docs/tag/sections",
  "/privacy",
  "/terms",
];

async function getEntityUrls(origin: string) {
  const [courses, sections, teachers] = await Promise.all([
    prisma.course.findMany({ select: { jwId: true } }),
    prisma.section.findMany({
      where: { retiredAt: null },
      select: { jwId: true },
    }),
    prisma.teacher.findMany({ select: { id: true } }),
  ]);

  const courseUrls = courses.map(({ jwId }) => `${origin}/courses/${jwId}`);
  const sectionUrls = sections.map(({ jwId }) => `${origin}/sections/${jwId}`);
  const teacherUrls = teachers.map(({ id }) => `${origin}/teachers/${id}`);

  return [...courseUrls, ...sectionUrls, ...teacherUrls];
}

async function loadSitemapUrls() {
  const origin = getCanonicalOrigin();
  const entityUrls = await getEntityUrls(origin);
  return [...STATIC_ROUTES.map((route) => `${origin}${route}`), ...entityUrls];
}

export const GET: RequestHandler = async ({ request }) => {
  const sitemap = await getCachedSitemap(loadSitemapUrls);
  const headers = {
    ...RESPONSE_HEADERS,
    ETag: sitemap.etag,
  };

  if (requestMatchesSitemapEtag(request, sitemap.etag)) {
    return new Response(null, {
      headers,
      status: 304,
    });
  }

  return new Response(sitemap.body, {
    headers,
  });
};
