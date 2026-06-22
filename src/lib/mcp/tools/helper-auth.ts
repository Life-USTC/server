import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { findViewerInfoById } from "@/features/profile/server/profile-read-model";

export function getUserId(authInfo?: AuthInfo): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error("Authenticated user context is missing");
  }

  return userId;
}

export async function getViewerInfo(userId: string) {
  const user = await findViewerInfoById(userId);

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  return user;
}
