import { cachedPublicDetailRuntimeData } from "@/features/catalog/server/catalog-detail-runtime-cache";
import {
  buildSectionPageLoadData,
  SECTION_RELATED_PREVIEW_LIMIT,
  sectionPageRelatedSectionSelect,
  sectionPageSelect,
  sectionPageTeachersWithDepartmentSelect,
} from "@/features/section-detail/server/section-page-shape";
import type { AppLocale } from "@/i18n/config";
import { getPrisma } from "@/lib/db/prisma";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";

import { loadSectionPageMutableData } from "./section-page-mutable-data";

async function getSectionPageCore(jwId: number, locale: AppLocale) {
  const relatedWhere = {
    jwId: { not: jwId },
    retiredAt: null,
  } as const;
  const section = await cachedPublicDetailRuntimeData({
    id: jwId,
    kind: "section",
    locale,
    shape: "page-core-v1",
    load: () =>
      runCloudflareTraceSpan(
        "catalog.detail.section.query",
        { "catalog.detail.kind": "section" },
        async () =>
          await getPrisma(locale).section.findUnique({
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
                      { jwId: "asc" as const },
                    ],
                    take: SECTION_RELATED_PREVIEW_LIMIT,
                    select: sectionPageRelatedSectionSelect,
                  },
                },
              },
              description: false,
              teachers: sectionPageTeachersWithDepartmentSelect,
              exams: sectionPageSelect.exams,
              schedules: sectionPageSelect.schedules,
            },
          }),
      ),
  });

  if (!section) return null;

  return runCloudflareTraceSpan(
    "catalog.detail.section.transform",
    { "catalog.detail.kind": "section" },
    () => {
      const { course: courseRecord, exams, schedules, ...data } = section;
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
        schedules: schedules.map((schedule) => ({
          ...schedule,
          teachers: schedule.teacherParticipations.map(
            ({ teacher }) => teacher,
          ),
        })),
      };

      return {
        section: buildSectionPageLoadData(normalizedSection, {
          otherCourseSectionCount: relatedCount.sections,
          otherCourseSections: relatedSections,
        }),
      };
    },
  );
}

export async function getSectionPage(
  jwId: number,
  locale: AppLocale = "zh-cn",
) {
  const [core, mutable] = await Promise.all([
    getSectionPageCore(jwId, locale),
    runCloudflareTraceSpan(
      "catalog.detail.section.mutable.query",
      { "catalog.detail.kind": "section" },
      () => loadSectionPageMutableData(jwId),
    ),
  ]);
  return core
    ? {
        ...core,
        description: mutable.description,
        section: { ...core.section, retiredAt: mutable.retiredAt },
      }
    : null;
}
