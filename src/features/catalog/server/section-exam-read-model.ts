import { sectionPublicContextSelect } from "@/features/catalog/server/academic-query-includes";
import type { Prisma } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { toSectionPublicContextDto } from "./academic-summary-dto-mappers";

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
  const sectionWithExams = await getPrisma(locale).section.findUnique({
    where: { jwId: sectionJwId },
    select: {
      ...sectionPublicContextSelect,
      exams: {
        include: sectionExamInclude,
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
      },
    },
  });

  if (!sectionWithExams) {
    return null;
  }

  const { exams, ...rawSection } = sectionWithExams;
  const section = toSectionPublicContextDto(rawSection, locale);

  return { exams, section };
}
