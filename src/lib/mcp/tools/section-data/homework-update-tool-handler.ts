import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { findActiveSuspension } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { getHomeworkItemById } from "./homework-tool-helpers";
import { updateHomeworkDescription } from "./homework-update-description";
import {
  buildHomeworkUpdates,
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

  const parsedDates = parseHomeworkUpdateDates({
    publishedAt,
    submissionDueAt,
    submissionStartAt,
  });
  if (!parsedDates.ok) {
    return parsedDates.result;
  }

  const existing = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: { id: true, deletedAt: true },
  });
  if (!existing) {
    return jsonToolResult(
      {
        success: false,
        message: "Homework not found",
        hint: "Use list_homeworks_by_section or list_my_homeworks to confirm the homeworkId before updating it.",
      },
      { mode: resolvedMode },
    );
  }
  if (existing.deletedAt) {
    return jsonToolResult(
      { success: false, message: "Homework deleted" },
      { mode: resolvedMode },
    );
  }

  const updates = buildHomeworkUpdates(
    { isMajor, requiresTeam, title },
    userId,
    parsedDates.value,
  );
  const wantsDescription = description !== undefined;

  if (Object.keys(updates).length === 1 && !wantsDescription) {
    return jsonToolResult(
      { success: false, message: "No changes" },
      { mode: resolvedMode },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(updates).length > 1) {
      await tx.homework.update({
        where: { id: homeworkId },
        data: updates,
      });
    }

    await updateHomeworkDescription(tx, {
      description,
      homeworkId,
      userId,
    });
  });
  const homeworkItem = await getHomeworkItemById(
    homeworkId,
    DEFAULT_LOCALE,
    userId,
  );

  return jsonToolResult(
    { success: true, homework: homeworkItem },
    { mode: resolvedMode },
  );
}
