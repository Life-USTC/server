import type { AppLocale } from "@/i18n/config";
import {
  jsonToolResult,
  resolveMcpMode,
  resolveSectionByJwId,
} from "@/lib/mcp/tools/_helpers";
import { sectionExamInclude, sectionNotFoundToolResult } from "./shared";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

type ListExamsBySectionInput = {
  locale: AppLocale;
  mode?: McpModeInput;
  sectionJwId: number;
};

export async function listExamsBySectionAction({
  sectionJwId,
  locale,
  mode,
}: ListExamsBySectionInput) {
  const { localizedPrisma, section } = await resolveSectionByJwId(
    sectionJwId,
    locale,
  );

  if (!section) {
    return sectionNotFoundToolResult(sectionJwId, mode);
  }

  const exams = await localizedPrisma.exam.findMany({
    where: { sectionId: section.id },
    include: sectionExamInclude,
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { jwId: "asc" }],
  });

  return jsonToolResult(
    {
      found: true,
      section,
      exams,
    },
    {
      mode: resolveMcpMode(mode),
    },
  );
}
