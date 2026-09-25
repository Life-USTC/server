import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminUsersActionConfig } from "@/features/admin/lib/admin-users-page-action-types";
import { suspendSelectedUser } from "@/features/admin/lib/admin-users-suspend-action";
import { suspendModerationCommentAuthorRequest } from "@/features/admin/lib/moderation-controller";
import { apiClient } from "@/lib/api/client";

function userActionConfig(
  duration: string,
  expiresAt = "",
): AdminUsersActionConfig {
  return {
    closeDialog: vi.fn(),
    getCopy: () => ({
      liftFailed: "lift failed",
      liftSuccess: "lifted",
      suspendFailed: "suspend failed",
      suspendSuccess: "suspended",
      updateFailed: "update failed",
      updateSuccess: "updated",
    }),
    getEditState: () => ({ isAdmin: false, name: "", username: "" }),
    getSelectedUser: () => ({
      id: "user-1",
      isAdmin: false,
      createdAt: "2026-09-25",
    }),
    getSuspendState: () => ({ duration, expiresAt, reason: " reason " }),
    onSuccess: vi.fn(),
    replaceUser: vi.fn(),
    setLiftingSuspension: vi.fn(),
    setMessage: vi.fn(),
    setMessageVariant: vi.fn(),
    setSaving: vi.fn(),
    setSuspending: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("admin suspension entry points", () => {
  it.each([
    ["1d", "", "2026-09-26T12:00:00+08:00"],
    ["3d", "", "2026-09-28T12:00:00+08:00"],
    ["7d", "", "2026-10-02T12:00:00+08:00"],
    ["30d", "", "2026-10-25T12:00:00+08:00"],
    ["permanent", "", undefined],
    ["custom", "2026-10-01T15:30", "2026-10-01T15:30:00+08:00"],
    ["custom", "   ", undefined],
    ["custom", " invalid ", "invalid"],
  ])(
    "both entry points send the same expiry for %s (%s)",
    async (duration, custom, expected) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-25T04:00:00Z"));
      const post = vi.spyOn(apiClient, "POST").mockResolvedValue({
        error: undefined,
        data: { suspension: { id: "suspension-1", expiresAt: expected } },
        response: new Response(null, { status: 200 }),
      });
      const config = userActionConfig(duration, custom);
      expect(await suspendSelectedUser(config)).toBe(true);
      await suspendModerationCommentAuthorRequest({
        duration,
        customExpiresAt: custom,
        fallbackMessage: "suspend failed",
        reason: " reason ",
        userId: "user-1",
      });
      expect(post).toHaveBeenCalledTimes(2);
      for (const call of post.mock.calls) {
        expect(call).toEqual([
          "/api/admin/suspensions",
          { body: { userId: "user-1", reason: "reason", expiresAt: expected } },
        ]);
      }
      expect(config.onSuccess).toHaveBeenCalledWith("suspend");
      expect(config.setSuspending).toHaveBeenLastCalledWith(false);
    },
  );

  it.each(["14d", "invalid", ""])(
    "neither entry point submits unsupported duration %s",
    async (duration) => {
      const post = vi.spyOn(apiClient, "POST");
      const config = userActionConfig(duration);
      expect(await suspendSelectedUser(config)).toBe(false);
      expect(config.setMessage).toHaveBeenLastCalledWith("suspend failed");
      expect(config.setMessageVariant).toHaveBeenLastCalledWith("destructive");
      expect(config.setSuspending).toHaveBeenLastCalledWith(false);
      expect(config.replaceUser).not.toHaveBeenCalled();
      expect(config.onSuccess).not.toHaveBeenCalled();
      await expect(
        suspendModerationCommentAuthorRequest({
          duration,
          customExpiresAt: "",
          fallbackMessage: "suspend failed",
          reason: "reason",
          userId: "user-1",
        }),
      ).rejects.toThrow("suspend failed");
      expect(post).not.toHaveBeenCalled();
    },
  );
});
