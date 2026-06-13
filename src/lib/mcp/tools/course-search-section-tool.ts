import { buildPaginatedResponse, normalizePagination } from "@/lib/api/helpers";
import { buildSectionListQuery } from "@/lib/course-section-queries";
import { getPrisma } from "@/lib/db/prisma";
import { sectionSummarySelect } from "@/lib/query-helpers";

type SearchSectionsForMcpToolInput = {
  campusId?: number;
  courseId?: number;
  courseJwId?: number;
  departmentId?: number;
  ids?: number[];
  jwIds?: number[];
  limit: number;
  locale: Parameters<typeof getPrisma>[0];
  page: number;
  search?: string;
  semesterId?: number;
  semesterJwId?: number;
  teacherCode?: string;
  teacherId?: number;
};

export async function searchSectionsForMcpTool({
  campusId,
  courseId,
  courseJwId,
  departmentId,
  ids,
  jwIds,
  limit,
  locale,
  page,
  search,
  semesterId,
  semesterJwId,
  teacherCode,
  teacherId,
}: SearchSectionsForMcpToolInput) {
  const localizedPrisma = getPrisma(locale);
  const pagination = normalizePagination({ page, pageSize: limit });
  const { where, orderBy } = buildSectionListQuery({
    campusId,
    courseId,
    courseJwId,
    departmentId,
    ids,
    jwIds,
    search,
    semesterId,
    semesterJwId,
    teacherCode,
    teacherId,
  });

  const [sections, total] = await Promise.all([
    localizedPrisma.section.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      select: sectionSummarySelect,
      orderBy,
    }),
    localizedPrisma.section.count({ where }),
  ]);

  return buildPaginatedResponse(
    sections,
    pagination.page,
    pagination.pageSize,
    total,
  );
}
