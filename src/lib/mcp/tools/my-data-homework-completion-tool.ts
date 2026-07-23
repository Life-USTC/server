import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { setHomeworkCompletion } from "@/features/homeworks/server/homework-completion";
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
  const result = await setHomeworkCompletion({
    completed,
    homeworkId,
    userId,
  });

  if (!result.success) {
    return jsonToolResult({
      success: false,
      message:
        result.error.code === "deleted"
          ? "Homework not found"
          : result.error.message,
      hint: "Use workspace_homework_list or community_section_homework_list to confirm the homeworkId before updating completion.",
    });
  }

  return jsonToolResult(
    {
      success: true,
      completion: {
        homeworkId: result.homeworkId,
        completed: result.completed,
        completedAt: result.completedAt,
      },
    },
    { mode: resolvedMode },
  );
}
