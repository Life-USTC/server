import {
  getAcademicMetadata,
  getCurrentSemester,
  listSemesters,
} from "@/features/catalog/server/academic-metadata-read-model";
import {
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteQuery,
} from "@/lib/api/helpers";
import { semestersQuerySchema } from "@/lib/api/schemas/request-schemas";
import { PUBLIC_CATALOG_CACHE_CONTROL } from "@/lib/public-cache-control";
import { cachedPublicRuntimeData } from "@/lib/public-runtime-cache";

const METADATA_API_CACHE_TTL_MS = 60_000;
const SEMESTERS_API_CACHE_TTL_MS = 60_000;

export async function getMetadataRoute() {
  try {
    const metadata = await cachedPublicRuntimeData(
      "api:metadata",
      METADATA_API_CACHE_TTL_MS,
      getAcademicMetadata,
    );

    return jsonResponse(metadata, {
      headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL },
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
    const { page, pageSize } = parsed.pagination;

    const result = await cachedPublicRuntimeData(
      `api:semesters:${JSON.stringify({ page, pageSize })}`,
      SEMESTERS_API_CACHE_TTL_MS,
      () => listSemesters({ page, pageSize }),
    );

    return jsonResponse(result, {
      headers: { "Cache-Control": PUBLIC_CATALOG_CACHE_CONTROL },
    });
  } catch (error) {
    return handleRouteError("Failed to fetch semesters", error);
  }
}

export async function getCurrentSemesterRoute() {
  try {
    const currentSemester = await getCurrentSemester(new Date());

    if (!currentSemester) {
      return notFound("No current semester found");
    }

    return jsonResponse(currentSemester);
  } catch (error) {
    return handleRouteError("Failed to fetch current semester", error);
  }
}
