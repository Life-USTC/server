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

  it("does not give an administrator ordinary delete access to another creator's homework", async () => {
    await expect(
      deleteHomework({ userId: "admin-1", homeworkId: "homework-1" }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(updateHomework).not.toHaveBeenCalled();
    expect(writeAuditLog).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("retains creator deletion for administrator accounts", async () => {
    await expect(
      deleteHomework({ userId: "creator-1", homeworkId: "homework-1" }),
    ).resolves.toEqual({ ok: true, alreadyDeleted: false });
    expect(updateHomework).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith(42);
  });

  it("allows another creator's homework only through explicit admin moderation", async () => {
    await expect(
      deleteHomeworkForModeration({
        userId: "admin-1",
        homeworkId: "homework-1",
      }),
    ).resolves.toEqual({ ok: true, alreadyDeleted: false });
    expect(updateHomework).toHaveBeenCalledOnce();
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "homework_delete" }),
      expect.anything(),
    );
  });

  it("rejects non-admin creators from the moderation use-case", async () => {
    viewer.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: false,
      isAdmin: false,
    });
    await expect(
      deleteHomeworkForModeration({
        userId: "creator-1",
        homeworkId: "homework-1",
      }),
    ).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(updateHomework).not.toHaveBeenCalled();
  });

  it("does not allow suspended administrators to moderate", async () => {
    viewer.mockResolvedValue({
      isAuthenticated: true,
      isSuspended: true,
      isAdmin: true,
      suspensionReason: "suspended",
    });
    await expect(
      deleteHomeworkForModeration({
        userId: "admin-1",
        homeworkId: "homework-1",
      }),
    ).resolves.toMatchObject({ ok: false, error: "suspended" });
    expect(updateHomework).not.toHaveBeenCalled();
  });
});
