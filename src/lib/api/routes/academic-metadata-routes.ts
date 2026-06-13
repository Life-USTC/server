import {
  buildPaginatedResponse,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { semestersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { findCurrentSemester } from "@/lib/current-semester";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";

const SEMESTERS_API_CACHE_TTL_MS = 60_000;

export async function getMetadataRoute() {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const [
      educationLevels,
      courseCategories,
      courseClassifies,
      classTypes,
      courseTypes,
      courseGradations,
      examModes,
      teachLanguages,
      campuses,
    ] = await Promise.all([
      prisma.educationLevel.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.courseCategory.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.courseClassify.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.classType.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.courseType.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.courseGradation.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.examMode.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.teachLanguage.findMany({ orderBy: { nameCn: "asc" } }),
      prisma.campus.findMany({
        orderBy: { nameCn: "asc" },
        include: { buildings: true },
      }),
    ]);

    return jsonResponse({
      educationLevels,
      courseCategories,
      courseClassifies,
      classTypes,
      courseTypes,
      courseGradations,
      examModes,
      teachLanguages,
      campuses,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch metadata", error);
  }
}

export async function getSemestersRoute(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const parsed = parseRouteQuery(
      searchParams,
      semestersQuerySchema,
      "Invalid semester query",
      { logErrors: true },
    );
    if (parsed instanceof Response) {
      return parsed;
    }
    const { page, pageSize, skip } = parsed.pagination;

    const { semesters, total } = await cachedPublicRuntimeData(
      `api:semesters:${JSON.stringify({ page, pageSize, skip })}`,
      SEMESTERS_API_CACHE_TTL_MS,
      async () => {
        const { prisma } = await import("@/lib/db/prisma");
        const [semesters, total] = await Promise.all([
          prisma.semester.findMany({
            skip,
            take: pageSize,
            orderBy: { startDate: "desc" },
          }),
          prisma.semester.count(),
        ]);
        return { semesters, total };
      },
    );

    return jsonResponse(
      buildPaginatedResponse(semesters, page, pageSize, total),
    );
  } catch (error) {
    return handleRouteError("Failed to fetch semesters", error);
  }
}

export async function getCurrentSemesterRoute() {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const currentSemester = await findCurrentSemester(
      prisma.semester,
      new Date(),
    );

    if (!currentSemester) {
      return notFound("No current semester found");
    }

    return jsonResponse(currentSemester);
  } catch (error) {
    return handleRouteError("Failed to fetch current semester", error);
  }
}
