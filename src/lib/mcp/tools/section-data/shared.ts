import type { Prisma } from "@/generated/prisma/client";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";

export const sectionExamInclude = {
  examBatch: true,
  examRooms: true,
  section: {
    include: {
      course: true,
    },
  },
} satisfies Prisma.ExamInclude;

export function sectionNotFoundToolResult(
  sectionJwId: number,
  mode?: "summary" | "default" | "full",
) {
  return jsonToolResult(
    {
      success: false,
      found: false,
      message: `Section ${sectionJwId} was not found`,
      hint: "Use search_sections to find a valid section jwId, or match_section_codes if you only have a section code.",
    },
    { mode: resolveMcpMode(mode) },
  );
}
