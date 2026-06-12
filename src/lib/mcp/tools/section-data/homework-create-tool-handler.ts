import type { AppLocale } from "@/i18n/config";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
  resolveSectionByJwId,
} from "@/lib/mcp/tools/_helpers";
import {
  createHomeworkOnSectionRecord,
  parseCreateHomeworkTimestamps,
  suspendedCreateHomeworkResult,
} from "./homework-create-actions";
import { getHomeworkItemById } from "./homework-tool-helpers";
import { sectionNotFoundToolResult } from "./shared";

type McpModeInput = Parameters<typeof resolveMcpMode>[0];

export async function createHomeworkOnSectionTool(
  {
    sectionJwId,
    title,
    description,
    isMajor,
    requiresTeam,
    publishedAt,
    submissionStartAt,
    submissionDueAt,
    locale,
    mode,
  }: {
    description?: string | null;
    isMajor?: boolean;
    locale: AppLocale;
    mode?: McpModeInput;
    publishedAt?: string | null;
    requiresTeam?: boolean;
    sectionJwId: number;
    submissionDueAt?: string | null;
    submissionStartAt?: string | null;
    title: string;
  },
  extra: { authInfo?: Parameters<typeof getUserId>[0] },
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const suspensionResult = await suspendedCreateHomeworkResult(
    userId,
    resolvedMode,
  );
  if (suspensionResult) return suspensionResult;

  const { section } = await resolveSectionByJwId(sectionJwId, locale);
  if (!section) {
    return sectionNotFoundToolResult(sectionJwId, resolvedMode);
  }

  const parsedTimestamps = parseCreateHomeworkTimestamps({
    publishedAt,
    submissionStartAt,
    submissionDueAt,
  });
  if (!parsedTimestamps.ok) return parsedTimestamps.result;

  const homework = await createHomeworkOnSectionRecord({
    description,
    isMajor,
    publishedAt: parsedTimestamps.publishedAt ?? null,
    requiresTeam,
    sectionId: section.id,
    submissionDueAt: parsedTimestamps.submissionDueAt ?? null,
    submissionStartAt: parsedTimestamps.submissionStartAt ?? null,
    title,
    userId,
  });
  const homeworkItem = await getHomeworkItemById(homework.id, locale, userId);

  return jsonToolResult(
    { success: true, id: homework.id, homework: homeworkItem },
    { mode: resolvedMode },
  );
}
