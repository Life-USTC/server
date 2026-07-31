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
import {
  cachedCatalogRuntimeData,
} from "@/lib/catalog-runtime-cache";
import { PUBLIC_CATALOG_HEADERS } from "@/lib/public-cache-control";
import { getCanonicalOrigin } from "@/lib/site-url";

export async function getMetadataRoute() {
  try {
    const metadata = await cachedCatalogRuntimeData(
      "api:metadata",
      "api:metadata",
      getCanonicalOrigin(),
      getAcademicMetadata,
    );

    return jsonResponse(metadata, {
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

    return jsonResponse(result, {
      headers: PUBLIC_CATALOG_HEADERS,
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
