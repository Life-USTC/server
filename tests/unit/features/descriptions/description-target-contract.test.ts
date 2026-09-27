import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveDescriptionTarget,
  resolveDescriptionTargetReference,
} from "@/features/descriptions/server/description-targets";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { descriptionUpsertRequestSchema } from "@/lib/api/schemas/request-description-mutation-schemas";

const { database } = vi.hoisted(() => ({
  database: {
    $transaction: vi.fn(),
    course: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    teacher: { findUnique: vi.fn() },
    homework: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: database }));
vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: vi.fn(async () => ({
    isAuthenticated: true,
    isSuspended: false,
  })),
}));

beforeEach(() => {
  vi.resetAllMocks();
  database.course.findUnique.mockResolvedValue({ id: 11 });
  database.section.findUnique.mockResolvedValue({ id: 22 });
  database.teacher.findUnique.mockResolvedValue({ id: 33 });
  database.homework.findUnique.mockResolvedValue({ id: "homework-44" });
});

describe("description target contract", () => {
  it("description.target-identifiers", async () => {
    for (const input of [
      { targetType: "course" as const, rawTargetId: 11, expected: 11 },
      { targetType: "course" as const, courseJwId: 111, expected: 11 },
      { targetType: "section" as const, rawTargetId: 22, expected: 22 },
      { targetType: "section" as const, sectionJwId: 222, expected: 22 },
      { targetType: "teacher" as const, rawTargetId: 33, expected: 33 },
      { targetType: "teacher" as const, teacherId: 33, expected: 33 },
      {
        targetType: "homework" as const,
        rawTargetId: "homework-44",
        expected: "homework-44",
      },
      {
        targetType: "homework" as const,
        homeworkId: "homework-44",
        expected: "homework-44",
      },
    ]) {
      const { expected, rawTargetId, ...publicInput } = input;
      expect(
        descriptionUpsertRequestSchema.safeParse({
          ...publicInput,
          targetId: rawTargetId,
          content: "Text",
        }).success,
      ).toBe(true);
      expect(
        await resolveDescriptionTargetReference({
          ...input,
          verifyExistence: true,
        }),
      ).toMatchObject({
        ok: true,
        targetType: input.targetType,
        targetId: expected,
      });
    }
    expect(database.course.findUnique).toHaveBeenCalledWith({
      where: { jwId: 111 },
      select: { id: true },
    });
    expect(database.section.findUnique).toHaveBeenCalledWith({
      where: { jwId: 222 },
      select: { id: true },
    });
  });

  it("description.attached-object-types", async () => {
    for (const targetType of [
      "course",
      "section",
      "teacher",
      "homework",
    ] as const) {
      const targetId = targetType === "homework" ? "homework-44" : 11;
      expect(
        descriptionUpsertRequestSchema.safeParse({
          targetType,
          targetId,
          content: "Text",
        }).success,
      ).toBe(true);
      const target = resolveDescriptionTarget(targetType, targetId);
      expect(target).not.toBeNull();
      database[targetType].findUnique.mockResolvedValueOnce(null);
      expect(await target?.ensureExists()).toBeNull();
      database[targetType].findUnique.mockResolvedValueOnce(null);
      expect(
        await resolveDescriptionTargetReference({
          targetType,
          rawTargetId: targetId,
          verifyExistence: true,
        }),
      ).toMatchObject({ ok: false, error: "target_not_found" });
      database[targetType].findUnique.mockResolvedValueOnce(null);
      expect(
        await upsertDescriptionContent({
          targetType,
          targetId,
          userId: "editor",
          content: "Text",
        }),
      ).toEqual({ ok: false, error: "not_found" });
    }
    expect(database.$transaction).not.toHaveBeenCalled();
    for (const targetType of [
      "section-teacher",
      "young-event",
      "user",
      "unknown",
      "",
    ]) {
      expect(
        descriptionUpsertRequestSchema.safeParse({
          targetType,
          targetId: 11,
          content: "Text",
        }).success,
      ).toBe(false);
    }
  });
});
