import {
  getAcademicMetadata,
  getCachedCurrentSemester,
  listSemesters,
} from "@/features/catalog/server/academic-metadata-read-model";
import { handleRouteError, notFound, parseRouteQuery } from "@/lib/api/helpers";
import { schemaJsonResponse } from "@/lib/api/responses";
import { semestersQuerySchema } from "@/lib/api/schemas/request-schemas";
import {
  metadataResponseSchema,
  paginatedSemesterResponseSchema,
  semesterSchema,
} from "@/lib/api/schemas/response-schemas";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import {
  currentSemesterCacheHeaders,
  PUBLIC_CATALOG_HEADERS,
} from "@/lib/public-cache-control";
import { getCanonicalOrigin } from "@/lib/site-url";

export async function getMetadataRoute() {
  try {
    const metadata = await cachedCatalogRuntimeData(
      "api:metadata",
      "api:metadata",
      getCanonicalOrigin(),
      getAcademicMetadata,
    );

    return schemaJsonResponse(metadataResponseSchema, metadata, {
      headers: PUBLIC_CATALOG_HEADERS,
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

    const origin = new URL(request.url).origin;
    const result = await cachedCatalogRuntimeData(
      "api:semesters",
      `api:semesters:${JSON.stringify({ page, pageSize })}`,
      origin,
      () => listSemesters({ page, pageSize }),
    );

    return schemaJsonResponse(paginatedSemesterResponseSchema, result, {
      headers: PUBLIC_CATALOG_HEADERS,
    });
  } catch (error) {
    return handleRouteError("Failed to fetch semesters", error);
  }
}

export async function getCurrentSemesterRoute(referenceDate = new Date()) {
  try {
    const currentSemester = await getCachedCurrentSemester(referenceDate);

    if (!currentSemester) {
      return notFound("No current semester found");
    }

    return schemaJsonResponse(semesterSchema, currentSemester, {
      headers: currentSemesterCacheHeaders(referenceDate),
    });
  } catch (error) {
    return handleRouteError("Failed to fetch current semester", error);
  }
}
