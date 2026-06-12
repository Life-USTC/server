import { buildPaginatedResponse, normalizePagination } from "@/lib/api/helpers";
import { getPrisma } from "@/lib/db/prisma";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";
import {
  ilike,
  teacherDetailInclude,
  teacherListInclude,
} from "@/lib/query-helpers";

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
  const localizedPrisma = getPrisma(locale);
  const pagination = normalizePagination({ page, pageSize: limit });
  const where = {
    ...(departmentId ? { departmentId } : {}),
    ...(search
      ? {
          OR: [
            { nameCn: ilike(search) },
            { nameEn: ilike(search) },
            { code: ilike(search) },
          ],
        }
      : {}),
  };

  const [teachers, total] = await Promise.all([
    localizedPrisma.teacher.findMany({
      where,
      skip: pagination.skip,
      take: pagination.pageSize,
      include: teacherListInclude,
      orderBy: { nameCn: "asc" },
    }),
    localizedPrisma.teacher.count({ where }),
  ]);

  return jsonToolResult(
    buildPaginatedResponse(
      teachers,
      pagination.page,
      pagination.pageSize,
      total,
    ),
    {
      mode: resolveMcpMode(mode),
    },
  );
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
