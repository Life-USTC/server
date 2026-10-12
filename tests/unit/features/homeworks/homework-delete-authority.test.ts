import { beforeEach, describe, expect, it, vi } from "vitest";

const { viewer, findHomework, updateHomework, writeAuditLog, invalidate } =
  vi.hoisted(() => ({
    viewer: vi.fn(),
    findHomework: vi.fn(),
    updateHomework: vi.fn(),
    writeAuditLog: vi.fn(),
    invalidate: vi.fn(),
  }));

vi.mock("@/lib/auth/viewer-context", () => ({ getViewerContext: viewer }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    homework: { findUnique: findHomework },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ homework: { update: updateHomework } }),
  },
}));
vi.mock("@/lib/audit/write-audit-log", () => ({ writeAuditLog }));
vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateCalendarExportsForSection: invalidate,
}));

import {
  deleteHomework,
  deleteHomeworkForModeration,
} from "@/features/homeworks/server/homework-mutations";

describe("homework deletion authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewer.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
      isAdmin: true,
    });
    findHomework.mockResolvedValue({
      id: "homework-1",
      createdById: "creator-1",
      deletedAt: null,
      sectionId: 42,
    });
  });

  const actors = [
    {
      name: "active user creator",
      userId: "creator-1",
      authenticated: true,
      suspended: false,
      admin: false,
      ordinary: "allowed",
      moderation: "forbidden",
    },
    {
      name: "active admin creator",
      userId: "creator-1",
      authenticated: true,
      suspended: false,
      admin: true,
      ordinary: "allowed",
      moderation: "allowed",
    },
    {
      name: "active other user",
      userId: "other-1",
      authenticated: true,
      suspended: false,
      admin: false,
      ordinary: "forbidden",
      moderation: "forbidden",
    },
    {
      name: "active other admin",
      userId: "other-1",
      authenticated: true,
      suspended: false,
      admin: true,
      ordinary: "forbidden",
      moderation: "allowed",
    },
    {
      name: "anonymous creator",
      userId: "creator-1",
      authenticated: false,
      suspended: false,
      admin: false,
      ordinary: "forbidden",
      moderation: "forbidden",
    },
    {
      name: "suspended user creator",
      userId: "creator-1",
      authenticated: true,
      suspended: true,
      admin: false,
      ordinary: "suspended",
      moderation: "suspended",
    },
    {
      name: "suspended admin creator",
      userId: "creator-1",
      authenticated: true,
      suspended: true,
      admin: true,
      ordinary: "suspended",
      moderation: "suspended",
    },
    {
      name: "suspended other admin",
      userId: "other-1",
      authenticated: true,
      suspended: true,
      admin: true,
      ordinary: "suspended",
      moderation: "suspended",
    },
    {
      name: "anonymous other admin",
      userId: "other-1",
      authenticated: false,
      suspended: false,
      admin: true,
      ordinary: "forbidden",
      moderation: "forbidden",
    },
  ] as const;

  describe.each([
    { mode: "ordinary", service: deleteHomework },
    { mode: "moderation", service: deleteHomeworkForModeration },
  ] as const)("$mode deletion", ({ mode, service }) => {
    it.each(actors)("$name", async (actor) => {
      viewer.mockResolvedValue({
        isAuthenticated: actor.authenticated,
        isSuspended: actor.suspended,
        isAdmin: actor.admin,
      });
      const result = await service({
        userId: actor.userId,
        homeworkId: "homework-1",
      });
      if (actor[mode] === "allowed") {
        expect(result).toEqual({ ok: true, alreadyDeleted: false });
        expect(updateHomework).toHaveBeenCalledOnce();
        expect(writeAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: actor.userId,
            action: "homework_delete",
          }),
          expect.anything(),
        );
        expect(invalidate).toHaveBeenCalledExactlyOnceWith(42);
      } else {
        expect(result).toMatchObject({ ok: false, error: actor[mode] });
        expect(updateHomework).not.toHaveBeenCalled();
        expect(writeAuditLog).not.toHaveBeenCalled();
        expect(invalidate).not.toHaveBeenCalled();
      }
    });
  });
});
