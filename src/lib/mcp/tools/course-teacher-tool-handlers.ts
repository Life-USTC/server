import { paginatedTeacherQuery } from "@/features/catalog/server/academic-paginated-queries";
import { teacherDetailInclude } from "@/features/catalog/server/academic-query-includes";
import { buildTeacherWhere } from "@/features/catalog/server/teacher-query";
import { getPrisma } from "@/lib/db/prisma";
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
  locale: string;
  mode?: McpModeInput;
}) {
  const result = await paginatedTeacherQuery(
    page,
    limit,
    buildTeacherWhere({ departmentId, search }),
    { nameCn: "asc" },
    locale,
  );

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
  locale: string;
  mode?: McpModeInput;
}) {
  const localizedPrisma = getPrisma(locale);
  const teacher = await localizedPrisma.teacher.findUnique({
    where: { id },
    include: teacherDetailInclude,
  });

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
