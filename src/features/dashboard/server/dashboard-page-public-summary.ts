import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import type { getPrisma } from "@/lib/db/prisma";

export async function loadDashboardPublicSummary(
  prisma: ReturnType<typeof getPrisma>,
  referenceNow: Date | null,
) {
  const [semesterCount, courseCount, sectionCount, semesters, links] =
    await Promise.all([
      prisma.semester.count(),
      prisma.course.count(),
      prisma.section.count(),
      prisma.semester.findMany({
        select: {
          id: true,
          nameCn: true,
          startDate: true,
          endDate: true,
        },
      }),
      import("@/features/home/server/dashboard-link-data").then((mod) =>
        mod.getPublicDashboardLinksData(),
      ),
    ]);

  return {
    counts: {
      semesters: semesterCount,
      courses: courseCount,
      sections: sectionCount,
    },
    currentTermName:
      selectCurrentSemesterFromList(semesters, referenceNow ?? new Date())
        ?.nameCn ?? null,
    links,
  };
}
