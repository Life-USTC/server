import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { findSectionToolSummaryByJwId } from "./course-section-read-queries";

const sectionExamInclude = {
  examBatch: true,
  examRooms: true,
  section: {
    include: {
      course: true,
    },
  },
} satisfies Prisma.ExamInclude;

export async function listExamsBySectionJwId(
  sectionJwId: number,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const section = await findSectionToolSummaryByJwId(sectionJwId, locale);
  if (!section) {
    return null;
  }

  const exams = await getPrisma(locale).exam.findMany({
    where: { sectionId: section.id },
    include: sectionExamInclude,
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
  });

  return { exams, section };
}
