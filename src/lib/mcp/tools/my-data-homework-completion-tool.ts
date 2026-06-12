import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export async function setMyHomeworkCompletionTool(
  {
    completed,
    homeworkId,
    mode,
  }: {
    completed: boolean;
    homeworkId: string;
    mode?: Parameters<typeof resolveMcpMode>[0];
  },
  extra: { authInfo?: AuthInfo },
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    select: { id: true, deletedAt: true },
  });

  if (!homework || homework.deletedAt) {
    return jsonToolResult({
      success: false,
      message: "Homework not found",
      hint: "Use list_my_homeworks or list_homeworks_by_section to confirm the homeworkId before updating completion.",
    });
  }

  if (completed) {
    const record = await prisma.homeworkCompletion.upsert({
      where: { userId_homeworkId: { userId, homeworkId } },
      update: { completedAt: new Date() },
      create: { userId, homeworkId },
    });

    return jsonToolResult(
      {
        success: true,
        completion: {
          homeworkId,
          completed: true,
          completedAt: record.completedAt,
        },
      },
      { mode: resolvedMode },
    );
  }

  await prisma.homeworkCompletion.deleteMany({
    where: { userId, homeworkId },
  });

  return jsonToolResult(
    {
      success: true,
      completion: {
        homeworkId,
        completed: false,
        completedAt: null,
      },
    },
    { mode: resolvedMode },
  );
}
