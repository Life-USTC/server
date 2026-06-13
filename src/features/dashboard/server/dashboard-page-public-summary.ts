import { selectCurrentSemesterFromList } from "@/lib/current-semester";
import type { getPrisma } from "@/lib/db/prisma";

export async function loadDashboardPublicSummary(
  prisma: ReturnType<typeof getPrisma> | null,
  referenceNow: Date | null,
) {
  const links = await import("@/features/home/server/dashboard-link-data").then(
    (mod) => mod.getPublicDashboardLinksData(),
  );

  if (!prisma) {
    return {
      counts: {
        semesters: 0,
        courses: 0,
        sections: 0,
      },
      currentTermName: null,
      links,
    };
  }

  const [semesterCount, courseCount, sectionCount, semesters] =
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
