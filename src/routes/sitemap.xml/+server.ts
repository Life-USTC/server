import { getCachedSitemap } from "@/features/catalog/server/sitemap-cache";
import { prisma } from "@/lib/db/prisma";
import { createCrawlerDiscoveryResponse } from "@/lib/seo/crawler-discovery-response";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

const STATIC_ROUTES = [
  "/",
  "/catalog/courses",
  "/catalog/sections",
  "/catalog/teachers",
  "/catalog/bus",
  "/catalog/links",
  "/catalog/bus/map",
  "/api/docs/tag/catalog-section",
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

  const courseUrls = courses.map(
    ({ jwId }) => `${origin}/catalog/courses/${jwId}`,
  );
  const sectionUrls = sections.map(
    ({ jwId }) => `${origin}/catalog/sections/${jwId}`,
  );
  const teacherUrls = teachers.map(
    ({ id }) => `${origin}/catalog/teachers/${id}`,
  );

  return [...courseUrls, ...sectionUrls, ...teacherUrls];
}

async function loadSitemapUrls() {
  const origin = getCanonicalOrigin();
  const entityUrls = await getEntityUrls(origin);
  return [...STATIC_ROUTES.map((route) => `${origin}${route}`), ...entityUrls];
}

export const GET: RequestHandler = async ({ request }) => {
  const sitemap = await getCachedSitemap(loadSitemapUrls);

  return createCrawlerDiscoveryResponse({
    body: sitemap.body,
    contentType: "application/xml; charset=utf-8",
    etag: sitemap.etag,
    request,
  });
};
