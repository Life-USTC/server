import { DEFAULT_LOCALE } from "@/i18n/config";
import {
  findSectionByJwId,
  type listCoursesBySearch,
} from "@/lib/course-section-queries";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";
import { searchSectionsForMcpTool } from "./course-search-section-tool";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];
type CourseSearchLocale = Parameters<typeof listCoursesBySearch>[2];

export async function getSectionByJwIdTool({
  jwId,
  locale,
  mode,
}: {
  jwId: number;
  locale: CourseSearchLocale;
  mode?: McpModeInput;
}) {
  const section = await findSectionByJwId(jwId, locale);

  if (!section) {
    return jsonToolResult({
      success: false,
      found: false,
      message: `Section ${jwId} was not found`,
      hint: "Use search_sections to find a valid section jwId, or match_section_codes if you only have a section code.",
    });
  }

  return jsonToolResult(
    {
      found: true,
      section,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}

export async function searchSectionsTool({
  courseId,
  courseJwId,
  semesterId,
  semesterJwId,
  campusId,
  departmentId,
  teacherId,
  teacherCode,
  ids,
  jwIds,
  search,
  page,
  limit,
  locale,
  mode,
}: {
  courseId?: number;
  courseJwId?: number;
  semesterId?: number;
  semesterJwId?: number;
  campusId?: number;
  departmentId?: number;
  teacherId?: number;
  teacherCode?: string;
  ids?: number[];
  jwIds?: number[];
  search?: string;
  page: number;
  limit: number;
  locale: CourseSearchLocale;
  mode?: McpModeInput;
}) {
  return jsonToolResult(
    await searchSectionsForMcpTool({
      campusId,
      courseId,
      courseJwId,
      departmentId,
      ids,
      jwIds,
      limit,
      locale: locale ?? DEFAULT_LOCALE,
      page,
      search,
      semesterId,
      semesterJwId,
      teacherCode,
      teacherId,
    }),
    {
      mode: resolveMcpMode(mode),
    },
  );
}
