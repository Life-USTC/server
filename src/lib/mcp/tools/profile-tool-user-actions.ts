import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { findUserProfileForTool } from "@/features/profile/server/profile-read-model";
import {
  getUserId,
  jsonToolResult,
  type McpModeInput,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

type ToolExtra = { authInfo?: AuthInfo };

export async function getMyProfileAction(
  { mode }: { mode?: McpModeInput },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const user = await findUserProfileForTool(userId);

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
