import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeworkExpectation } from "../../../shared/specifications/homework";

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

  async function verifyAuthority(id: string) {
    const specification = homeworkExpectation(id, "authorization");
    if (specification.surface !== "service")
      throw new Error("Deletion matrix requires service-layer evidence");
    const services = { deleteHomework, deleteHomeworkForModeration };
    const effects = {
      homework: updateHomework,
      audit: writeAuditLog,
      calendar: invalidate,
    };
    for (const scenario of specification.cases) {
      vi.clearAllMocks();
      viewer.mockResolvedValue({
        isAuthenticated: scenario.authenticated,
        isSuspended: scenario.suspended,
        isAdmin: scenario.role === "admin",
      });
      const userId =
        scenario.relationship === "creator" ? "creator-1" : "other-1";
      const result = await services[specification.operation]({
        userId,
        homeworkId: "homework-1",
      });
      if (scenario.outcome === "allowed") {
        expect(result, scenario.id).toEqual({
          ok: true,
          alreadyDeleted: false,
        });
        expect(updateHomework, scenario.id).toHaveBeenCalledOnce();
        expect(writeAuditLog, scenario.id).toHaveBeenCalledWith(
          expect.objectContaining({ userId, action: "homework_delete" }),
          expect.anything(),
        );
        expect(invalidate, scenario.id).toHaveBeenCalledWith(42);
      } else {
        expect(result, scenario.id).toMatchObject({
          ok: false,
          error: scenario.outcome,
        });
        for (const effect of specification.denied_effects) {
          expect(
            effects[effect],
            `${scenario.id}: ${effect}`,
          ).not.toHaveBeenCalled();
        }
      }
    }
  }

  it("enforces the specified ordinary deletion authority matrix", async () => {
    await verifyAuthority("homework.creator-only-delete");
  });

  it("enforces the specified moderation deletion authority matrix", async () => {
    await verifyAuthority("homework.moderation-delete");
  });
});
