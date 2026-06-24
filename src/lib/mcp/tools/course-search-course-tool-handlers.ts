import {
  findCourseDetailByJwId,
  listCourseSummaries,
} from "@/features/catalog/server/course-section-queries";
import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function searchCoursesTool({
  search,
  educationLevelId,
  categoryId,
  classTypeId,
  page,
  limit,
  locale,
  mode,
}: {
  search?: string;
  educationLevelId?: number;
  categoryId?: number;
  classTypeId?: number;
  page: number;
  limit: number;
  locale?: AppLocale;
  mode?: McpModeInput;
}) {
  const result = await listCourseSummaries({
    filters: {
      categoryId,
      classTypeId,
      educationLevelId,
      search,
    },
    locale: locale ?? DEFAULT_LOCALE,
    pagination: {
      page,
      pageSize: limit,
    },
  });

  return jsonToolResult(result, {
    mode: resolveMcpMode(mode),
  });
}

export async function getCourseByJwIdTool({
  jwId,
  locale,
  mode,
}: {
  jwId: number;
  locale?: AppLocale;
  mode?: McpModeInput;
}) {
  const course = await findCourseDetailByJwId(jwId, locale ?? DEFAULT_LOCALE);

  return jsonToolResult(
    {
      found: Boolean(course),
      course,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
