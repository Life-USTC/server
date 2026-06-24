import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { findAuthenticatedUserProfileById } from "@/features/profile/server/profile-read-model";
import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
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
  const user = await findAuthenticatedUserProfileById(userId);

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

export async function getPublicUserProfileAction({
  username,
  userId,
  mode,
}: {
  username?: string;
  userId?: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  if (username && userId) {
    return jsonToolResult(
      {
        success: false,
        error: "invalid_request",
        message: "Provide either username or userId, not both",
      },
      { mode: resolvedMode },
    );
  }

  if (!username && !userId) {
    return jsonToolResult(
      {
        success: false,
        error: "invalid_request",
        message: "Provide username or userId",
      },
      { mode: resolvedMode },
    );
  }

  const profile = username
    ? await getUserProfileByUsername(username)
    : userId
      ? await getUserProfileById(userId)
      : null;

  if (!profile) {
    return jsonToolResult(
      {
        success: false,
        found: false,
        error: "not_found",
        message: "User not found",
      },
      { mode: resolvedMode },
    );
  }

  return jsonToolResult(
    {
      found: true,
      ...profile,
    },
    { mode: resolvedMode },
  );
}
