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
  identifier,
  mode,
}: {
  identifier: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const profile =
    (await getUserProfileByUsername(identifier.toLowerCase())) ??
    (await getUserProfileById(identifier));

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
