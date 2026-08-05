import { localizedNameSelect } from "@/features/section-detail/server/section-page-name-selects";
import type { getPrisma } from "@/lib/db/prisma";

type PagePrisma = ReturnType<typeof getPrisma>;

type SectionPageRelatedSection = {
  courseId: number;
  id: number;
};

const relatedSectionSelect = {
  id: true,
  jwId: true,
  code: true,
  semesterId: true,
  semester: { select: { endDate: true, nameCn: true, startDate: true } },
  teachers: {
    select: {
      id: true,
      ...localizedNameSelect,
    },
  },
} as const;

export async function getSectionPageRelatedData({
  prisma,
  section,
}: {
  prisma: PagePrisma;
  section: SectionPageRelatedSection;
}) {
  const otherCourseSections = await prisma.section.findMany({
    where: {
      courseId: section.courseId,
      id: { not: section.id },
      retiredAt: null,
    },
    orderBy: [{ semester: { jwId: "desc" } }, { code: "asc" }],
    select: relatedSectionSelect,
  });

  return {
    otherCourseSections,
  };
}
