import { getViewerContext } from "@/lib/auth/viewer-context";

export type HomeworkWriteAuthError = "forbidden" | "suspended";

export async function requireActiveHomeworkWriter(userId: string) {
  const viewer = await getViewerContext({ includeAdmin: true, userId });
  if (!viewer.isAuthenticated) {
    return { ok: false as const, error: "forbidden" as const };
  }
  if (viewer.isSuspended) {
    return {
      ok: false as const,
      error: "suspended" as const,
      reason: viewer.suspensionReason,
    };
  }
  return { ok: true as const, viewer };
}
