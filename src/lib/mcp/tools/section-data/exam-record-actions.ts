import { listExamsBySectionJwId } from "@/features/catalog/server/course-section-queries";
import type { AppLocale } from "@/i18n/config";
import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";
import { sectionNotFoundToolResult } from "./shared";

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
  const result = await listExamsBySectionJwId(sectionJwId, locale);
  if (!result) {
    return sectionNotFoundToolResult(sectionJwId, mode);
  }
  const { exams, section } = result;

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
