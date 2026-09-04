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
import type { AppLocale } from "@/i18n/config";
import { cachedPublicDetailRuntimeData } from "@/lib/catalog-detail-runtime-cache";
import { getPrisma } from "@/lib/db/prisma";
import { runCloudflareTraceSpan } from "@/lib/ports/runtime";

type SectionPageRecord = Prisma.SectionGetPayload<{
  select: typeof sectionPageSelect;
}>;

async function getSectionPageCore(jwId: number, locale: AppLocale) {
  const prisma = getPrisma(locale);
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
          await prisma.section.findUnique({
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
        schedules,
      } as unknown as SectionPageRecord & {
        examCount: number;
        scheduleCount: number;
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

async function getSectionPageMutableData(jwId: number, locale: AppLocale) {
  const record = await runCloudflareTraceSpan(
    "catalog.detail.section.mutable.query",
    { "catalog.detail.kind": "section" },
    () =>
      getPrisma(locale).section.findUnique({
        where: { jwId },
        select: {
          description: { select: sectionPageDescriptionSelect },
          retiredAt: true,
        },
      }),
  );
  return {
    description: serializeDescriptionRecord(record?.description),
    retiredAt: record?.retiredAt?.toISOString() ?? null,
  };
}

export async function getSectionPage(
  jwId: number,
  locale: AppLocale = "zh-cn",
) {
  const [core, mutable] = await Promise.all([
    getSectionPageCore(jwId, locale),
    getSectionPageMutableData(jwId, locale),
  ]);
  return core
    ? {
        ...core,
        description: mutable.description,
        section: { ...core.section, retiredAt: mutable.retiredAt },
      }
    : null;
}
