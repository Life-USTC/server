import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { prisma } from "@/lib/db/prisma";
import {
  getUserId,
  jsonToolResult,
  type McpModeInput,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { userProfileSelect } from "@/lib/mcp/tools/profile-tool-helpers";

type ToolExtra = { authInfo?: AuthInfo };

export async function getMyProfileAction(
  { mode }: { mode?: McpModeInput },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userProfileSelect,
  });

  if (!user) {
    return jsonToolResult({
      success: false,
      message: "User not found",
    });
  }

  return jsonToolResult(user, {
    mode: resolveMcpMode(mode),
  });
}
