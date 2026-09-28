import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeworkExpectation } from "../../../shared/specifications/homework";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

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
    const contract = await semanticContract(id, "authorization");
    contract.equal("/surface", "service");
    if (specification.surface !== "service")
      throw new Error("Deletion matrix requires service-layer evidence");
    const services = { deleteHomework, deleteHomeworkForModeration };
    const effects = {
      homework: updateHomework,
      audit: writeAuditLog,
      calendar: invalidate,
    };
    const service = services[specification.operation];
    contract.equal("/operation", service.name);
    const denied = new Set<string>();
    for (const [index, scenario] of specification.cases.entries()) {
      vi.clearAllMocks();
      viewer.mockResolvedValue({
        isAuthenticated: scenario.authenticated,
        isSuspended: scenario.suspended,
        isAdmin: scenario.role === "admin",
      });
      const userId =
        scenario.relationship === "creator" ? "creator-1" : "other-1";
      const result = await service({
        userId,
        homeworkId: "homework-1",
      });
      const actor = await viewer.mock.results.at(-1)?.value;
      contract.equal(`/cases/${index}`, {
        id: `${actor.isAdmin ? "admin" : "user"}-${userId === "creator-1" ? "creator" : "other"}-${!actor.isAuthenticated ? "anonymous" : actor.isSuspended ? "suspended" : "active"}`,
        authenticated: actor.isAuthenticated,
        suspended: actor.isSuspended,
        role: actor.isAdmin ? "admin" : "user",
        relationship: userId === "creator-1" ? "creator" : "other",
        outcome: result.ok ? "allowed" : result.error,
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
        for (const [effect, mock] of Object.entries(effects)) {
          expect(mock, `${scenario.id}: ${effect}`).not.toHaveBeenCalled();
          denied.add(effect);
        }
      }
    }
    contract.set("/denied_effects", [...denied]);
    return contract;
  }

  it("homework.creator-only-delete", async (context) => {
    const contract = await verifyAuthority("homework.creator-only-delete");
    contract.recordVitest(context);
  });

  it("homework.moderation-delete", async (context) => {
    const contract = await verifyAuthority("homework.moderation-delete");
    contract.recordVitest(context);
  });
});
