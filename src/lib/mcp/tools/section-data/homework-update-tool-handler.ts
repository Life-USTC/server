import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import { hasHomeworkUpdateIntentChanges } from "@/features/homeworks/server/homework-update-intent";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import {
  buildHomeworkUpdateIntentForTool,
  parseHomeworkUpdateDates,
  type UpdateHomeworkOnSectionArgs,
} from "./homework-update-input";

type ToolExtra = { authInfo?: AuthInfo };

export async function updateHomeworkOnSectionTool(
  {
    homeworkId,
    title,
    description,
    isMajor,
    requiresTeam,
    publishedAt,
    submissionStartAt,
    submissionDueAt,
    locale,
    mode,
  }: UpdateHomeworkOnSectionArgs,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);

  const parsedDates = parseHomeworkUpdateDates(
    {
      publishedAt,
      submissionDueAt,
      submissionStartAt,
    },
    resolvedMode,
  );
  if (!parsedDates.ok) {
    return parsedDates.result;
  }

  const update = buildHomeworkUpdateIntentForTool(
    { isMajor, requiresTeam, title },
    userId,
    parsedDates.value,
    description,
  );

  if (!hasHomeworkUpdateIntentChanges(update)) {
    return jsonToolResult(
      { success: false, message: "No changes" },
      { mode: resolvedMode },
    );
  }

  const result = await updateHomework({
    homeworkId,
    update,
    userId,
  });
  if (!result.ok) {
    if (result.error === "no_changes") {
      return jsonToolResult(
        { success: false, message: "No changes" },
        { mode: resolvedMode },
      );
    }
    if (result.error === "not_found") {
      return jsonToolResult(
        {
          success: false,
          message: "Homework not found",
          hint: "Use community_section_homework_list or workspace_homework_list to confirm the homeworkId before updating it.",
        },
        { mode: resolvedMode },
      );
    }
    if (result.error === "suspended") {
      return jsonToolResult(
        {
          success: false,
          message: "Suspended",
          reason: "reason" in result ? (result.reason ?? null) : null,
        },
        { mode: resolvedMode },
      );
    }
    if (result.error === "forbidden") {
      return jsonToolResult(
        { success: false, message: "Forbidden" },
        { mode: resolvedMode },
      );
    }
    return jsonToolResult(
      { success: false, message: "Homework deleted" },
      { mode: resolvedMode },
    );
  }

  const homeworkItem = await requireHomeworkItemById({
    homeworkId,
    locale,
    userId,
  });

  return jsonToolResult(
    { success: true, homework: homeworkItem },
    { mode: resolvedMode },
  );
}
