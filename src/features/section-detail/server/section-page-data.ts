import { serializeDescriptionRecord } from "@/features/descriptions/server/description-payload";
import {
  buildSectionPageLoadData,
  SECTION_RELATED_PREVIEW_LIMIT,
  sectionPageDescriptionSelect,
  sectionPageRelatedSectionSelect,
  sectionPageSelect,
  sectionPageTeachersWithDepartmentSelect,
} from "@/features/section-detail/server/section-page-shape";
import type { Prisma } from "@/generated/prisma/client";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { getPrisma } from "@/lib/db/prisma";

type SectionPageRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPageSelect;
}>;

export async function getSectionPage(jwId: number, locale = "zh-cn") {
  const prisma = getPrisma(locale);
  const relatedWhere = {
    jwId: { not: jwId },
    retiredAt: null,
  } as const;
  const section = await runCloudflareTraceSpan(
    "catalog.detail.section.query",
    { "catalog.detail.kind": "section" },
    () =>
      prisma.section.findUnique({
        where: { jwId },
        select: {
          ...sectionPageSelect,
          course: {
            select: {
              ...sectionPageSelect.course.select,
              _count: { select: { sections: { where: relatedWhere } } },
              sections: {
                where: relatedWhere,
                orderBy: [
                  { semester: { jwId: "desc" as const } },
                  { code: "asc" as const },
                ],
                take: SECTION_RELATED_PREVIEW_LIMIT,
                select: sectionPageRelatedSectionSelect,
              },
            },
          },
          description: { select: sectionPageDescriptionSelect },
          teachers: sectionPageTeachersWithDepartmentSelect,
          exams: sectionPageSelect.exams,
          schedules: sectionPageSelect.schedules,
        },
      }),
  );

  if (!section) return null;

  return runCloudflareTraceSpan(
    "catalog.detail.section.transform",
    { "catalog.detail.kind": "section" },
    () => {
      const {
        course: courseRecord,
        description,
        exams,
        schedules,
        ...data
      } = section;
      const {
        _count: relatedCount,
        sections: relatedSections,
        ...course
      } = courseRecord;
      const normalizedSection = {
        ...data,
        course,
        examCount: exams.length,
        exams,
        scheduleCount: schedules.length,
        schedules,
      } as unknown as SectionPageRecord & {
        examCount: number;
        scheduleCount: number;
      };

      return {
        description: serializeDescriptionRecord(description),
        section: buildSectionPageLoadData(normalizedSection, {
          otherCourseSectionCount: relatedCount.sections,
          otherCourseSections: relatedSections,
        }),
      };
    },
  );
}
