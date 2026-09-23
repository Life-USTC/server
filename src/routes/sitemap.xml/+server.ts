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
  "/catalog/weather",
  "/catalog/young-events",
  "/api/docs/tag/catalog-section",
  "/usage/mobile",
  "/usage/bot",
  "/usage/mcp",
  "/usage/cli",
  "/privacy",
  "/terms",
];

async function getEntityUrls(origin: string) {
  const [courses, sections, teachers, youngEvents] = await Promise.all([
    prisma.course.findMany({ select: { jwId: true } }),
    prisma.section.findMany({
      where: { retiredAt: null },
      select: { jwId: true },
    }),
    prisma.teacher.findMany({ select: { id: true } }),
    // Only signup-open events are worth indexing; ended events churn quickly.
    prisma.youngEvent.findMany({
      where: { isActive: true },
      select: { youngId: true },
    }),
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
  const youngEventUrls = youngEvents.map(
    ({ youngId }) => `${origin}/catalog/young-events/${youngId}`,
  );

  return [...courseUrls, ...sectionUrls, ...teacherUrls, ...youngEventUrls];
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
