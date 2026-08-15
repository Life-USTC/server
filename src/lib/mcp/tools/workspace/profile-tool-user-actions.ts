import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { projectAuthenticatedUserProfile } from "@/features/profile/lib/account-profile-projection";
import { findAuthenticatedUserProfileById } from "@/features/profile/server/profile-read-model";
import {
  getUserProfileById,
  getUserProfileByUsername,
} from "@/features/profile/server/user-profile-page-data";
import { listOAuthClientActivityPage } from "@/features/settings/server/account-activity";
import {
  getUserId,
  jsonToolResult,
  type McpModeInput,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";
import { OAUTH_EMAIL_SCOPE } from "@/lib/oauth/constants";

type ToolExtra = { authInfo?: AuthInfo };

export async function getOAuthClientActivityAction(
  {
    cursor,
    limit,
    mode,
  }: { cursor?: string; limit: number; mode?: McpModeInput },
  extra: ToolExtra,
) {
  const authInfo = extra.authInfo;
  const userId = getUserId(authInfo);
  if (!authInfo?.clientId || authInfo.clientId === "unknown") {
    throw new Error("Authenticated OAuth client context is missing");
  }
  const page = await listOAuthClientActivityPage(
    { userId, clientId: authInfo.clientId },
    { cursor, limit },
  );
  return jsonToolResult(page, { mode: resolveMcpMode(mode) });
}

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

  return jsonToolResult(
    projectAuthenticatedUserProfile(user, {
      email: extra.authInfo?.scopes.includes(OAUTH_EMAIL_SCOPE) ?? false,
      adminStatus: false,
    }),
    { mode: resolveMcpMode(mode) },
  );
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
