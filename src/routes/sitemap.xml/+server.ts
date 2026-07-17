import { prisma } from "@/lib/db/prisma";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

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

export const GET: RequestHandler = async () => {
  const origin = getCanonicalOrigin();
  const entityUrls = await getEntityUrls(origin);
  const urls = [
    ...STATIC_ROUTES.map((route) => `${origin}${route}`),
    ...entityUrls,
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
