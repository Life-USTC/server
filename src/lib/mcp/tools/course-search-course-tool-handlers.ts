import {
  findCourseDetailByJwId,
  listCoursesBySearch,
} from "@/lib/course-section-queries";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];
type CourseSearchLocale = Parameters<typeof listCoursesBySearch>[2];

export async function searchCoursesTool({
  search,
  limit,
  locale,
  mode,
}: {
  search: string;
  limit: number;
  locale: CourseSearchLocale;
  mode?: McpModeInput;
}) {
  const courses = await listCoursesBySearch(search, limit, locale);

  return jsonToolResult(
    { courses },
    {
      mode: resolveMcpMode(mode),
    },
  );
}

export async function getCourseByJwIdTool({
  jwId,
  locale,
  mode,
}: {
  jwId: number;
  locale: CourseSearchLocale;
  mode?: McpModeInput;
}) {
  const course = await findCourseDetailByJwId(jwId, locale);

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
