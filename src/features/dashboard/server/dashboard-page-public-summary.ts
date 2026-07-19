import { selectCurrentSemesterFromList } from "@/features/catalog/lib/current-semester";
import { type AppLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";

export async function loadDashboardPublicSummary(
  prisma: ReturnType<typeof getPrisma> | null,
  referenceNow: Date | null,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const links = await import(
    "@/features/dashboard-links/server/dashboard-link-data"
  ).then((mod) => mod.getPublicDashboardLinksData(locale));

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
      prisma.section.count({ where: { retiredAt: null } }),
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

export async function loadDashboardPublicSummaryWithFallback(
  locale: AppLocale,
  referenceNow: Date | null,
) {
  try {
    return await loadDashboardPublicSummary(
      getPrisma(locale),
      referenceNow,
      locale,
    );
  } catch {
    return loadDashboardPublicSummary(null, referenceNow, locale);
  }
}
