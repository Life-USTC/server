import {
  findTeacherDetailById,
  listTeacherSummaries,
} from "@/features/catalog/server/course-section-queries";
import type { AppLocale } from "@/i18n/config";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function searchTeachersTool({
  departmentId,
  search,
  page,
  limit,
  locale,
  mode,
}: {
  departmentId?: number;
  search?: string;
  page: number;
  limit: number;
  locale: AppLocale;
  mode?: McpModeInput;
}) {
  const result = await listTeacherSummaries({
    filters: { departmentId, search },
    locale,
    pagination: { page, pageSize: limit },
  });

  return jsonToolResult(result, {
    mode: resolveMcpMode(mode),
  });
}

export async function getTeacherByIdTool({
  id,
  locale,
  mode,
}: {
  id: number;
  locale: AppLocale;
  mode?: McpModeInput;
}) {
  const teacher = await findTeacherDetailById(id, locale);

  return jsonToolResult(
    {
      found: Boolean(teacher),
      teacher,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
