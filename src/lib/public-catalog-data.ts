import { getPagePrisma, LIST_LIMIT, toLoadData } from "@/lib/page-data-utils";

export async function getPublicCatalog(locale = "zh-cn") {
  const prisma = await getPagePrisma(locale);
  const [courses, sections, teachers] = await Promise.all([
    prisma.course.findMany({
      take: LIST_LIMIT,
      orderBy: [{ nameCn: "asc" }],
      select: {
        jwId: true,
        code: true,
        nameCn: true,
        nameEn: true,
        _count: { select: { sections: true } },
      },
    }),
    prisma.section.findMany({
      take: LIST_LIMIT,
      orderBy: [{ id: "desc" }],
      select: {
        jwId: true,
        code: true,
        course: { select: { nameCn: true, nameEn: true } },
        semester: { select: { nameCn: true } },
        teachers: { take: 3, select: { nameCn: true, nameEn: true } },
      },
    }),
    prisma.teacher.findMany({
      take: LIST_LIMIT,
      orderBy: [{ nameCn: "asc" }],
      select: {
        id: true,
        nameCn: true,
        nameEn: true,
        department: { select: { nameCn: true, nameEn: true } },
        _count: { select: { sections: true } },
      },
    }),
  ]);

  return toLoadData({ courses, sections, teachers });
}
