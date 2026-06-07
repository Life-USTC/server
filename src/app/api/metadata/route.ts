import { handleRouteError, jsonResponse } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get metadata dictionaries for filters.
 * @response metadataResponseSchema
 */
async function getRoute() {
  try {
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
export const GET = observedApiRoute(getRoute);
