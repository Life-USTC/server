import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { updateHomework } from "@/features/homeworks/server/homework-mutations";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import { hasHomeworkUpdateIntentChanges } from "@/features/homeworks/server/homework-update-intent";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
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
  const suspension = await findActiveSuspension(userId);
  if (suspension) {
    return jsonToolResult(
      {
        success: false,
        message: "Suspended",
        reason: suspension.reason ?? null,
      },
      { mode: resolvedMode },
    );
  }

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
          hint: "Use list_homeworks_by_section or list_my_homeworks to confirm the homeworkId before updating it.",
        },
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
