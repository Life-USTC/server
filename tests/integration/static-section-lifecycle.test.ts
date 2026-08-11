import { afterAll, describe, expect, it } from "vitest";
import { reconcileSectionPresence } from "@/static-loader/section-lifecycle";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

afterAll(() => disconnectTestPrisma(prisma));

describe("static Section source lifecycle persistence", () => {
  it("retires and reactivates without deleting user data or history", async () => {
    const rollback = new Error("ROLLBACK_STATIC_SECTION_LIFECYCLE_TEST");
    const marker = `[integration-test] section-lifecycle-${Date.now()}`;
    const numericMarker = 2_140_000_000 + (Date.now() % 1_000_000);
    const firstObservedAt = new Date("2026-07-18T03:00:00.000Z");
    const secondObservedAt = new Date("2026-07-19T03:00:00.000Z");

    try {
      await prisma.$transaction(async (tx) => {
        const semester = await tx.semester.create({
          data: {
            jwId: numericMarker,
            code: marker,
            nameCn: marker,
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: numericMarker,
            code: marker,
            nameCn: marker,
          },
        });
        const reappearingSection = await tx.section.create({
          data: {
            jwId: numericMarker,
            code: `${marker}-reappearing`,
            courseId: course.id,
            semesterId: semester.id,
            retiredAt: new Date("2026-07-17T03:00:00.000Z"),
          },
        });
        const missingSection = await tx.section.create({
          data: {
            jwId: numericMarker + 1,
            code: `${marker}-missing`,
            courseId: course.id,
            semesterId: semester.id,
          },
        });
        const user = await tx.user.create({
          data: {
            email: `${numericMarker}@section-lifecycle.integration`,
            name: marker,
            sectionSubscriptions: { create: { sectionId: missingSection.id } },
          },
        });
        const comment = await tx.comment.create({
          data: {
            body: marker,
            sectionId: missingSection.id,
            userId: user.id,
          },
        });
        const description = await tx.description.create({
          data: {
            content: marker,
            lastEditedById: user.id,
            sectionId: missingSection.id,
          },
        });
        const homework = await tx.homework.create({
          data: {
            sectionId: missingSection.id,
            title: marker,
            createdById: user.id,
          },
        });
        const homeworkAudit = await tx.homeworkAuditLog.create({
          data: {
            action: "created",
            homeworkId: homework.id,
            sectionId: missingSection.id,
            titleSnapshot: marker,
          },
        });

        await expect(
          reconcileSectionPresence(tx, {
            observedAt: firstObservedAt,
            scopedSemesterIds: [semester.id],
            seenSectionJwIds: [reappearingSection.jwId],
            snapshotSha256: "first-snapshot",
          }),
        ).resolves.toEqual({
          status: "applied",
          scopeSemesterCount: 1,
          seenSectionCount: 1,
          missingSectionCount: 1,
          deactivatedCount: 1,
          reactivatedCount: 1,
          before: { active: 1, retired: 1, total: 2 },
          after: { active: 1, retired: 1, total: 2 },
        });

        await expect(
          tx.section.findMany({
            where: { id: { in: [reappearingSection.id, missingSection.id] } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              retiredAt: true,
            },
          }),
        ).resolves.toEqual([
          {
            id: reappearingSection.id,
            retiredAt: null,
          },
          {
            id: missingSection.id,
            retiredAt: firstObservedAt,
          },
        ]);
        await expect(
          tx.user.findUnique({
            where: { id: user.id },
            select: {
              sectionSubscriptions: {
                where: { sectionId: missingSection.id },
                select: { sectionId: true },
              },
            },
          }),
        ).resolves.toEqual({
          sectionSubscriptions: [{ sectionId: missingSection.id }],
        });
        const preservedUserData = [
          await tx.comment.findUnique({ where: { id: comment.id } }),
          await tx.description.findUnique({ where: { id: description.id } }),
          await tx.homework.findUnique({ where: { id: homework.id } }),
          await tx.homeworkAuditLog.findUnique({
            where: { id: homeworkAudit.id },
          }),
        ];
        expect(preservedUserData).toEqual([
          expect.objectContaining({ sectionId: missingSection.id }),
          expect.objectContaining({ sectionId: missingSection.id }),
          expect.objectContaining({ sectionId: missingSection.id }),
          expect.objectContaining({ sectionId: missingSection.id }),
        ]);
        await expect(
          tx.auditLog.findMany({
            where: {
              targetId: {
                in: [String(reappearingSection.id), String(missingSection.id)],
              },
              targetType: "section",
            },
            orderBy: { action: "asc" },
            select: { action: true, metadata: true, targetId: true },
          }),
        ).resolves.toEqual([
          {
            action: "section_retire",
            metadata: expect.objectContaining({
              snapshotSha256: "first-snapshot",
            }),
            targetId: String(missingSection.id),
          },
          {
            action: "section_reactivate",
            metadata: expect.objectContaining({
              snapshotSha256: "first-snapshot",
            }),
            targetId: String(reappearingSection.id),
          },
        ]);

        await expect(
          reconcileSectionPresence(tx, {
            observedAt: secondObservedAt,
            scopedSemesterIds: [semester.id],
            seenSectionJwIds: [reappearingSection.jwId, missingSection.jwId],
            snapshotSha256: "second-snapshot",
          }),
        ).resolves.toMatchObject({
          missingSectionCount: 0,
          deactivatedCount: 0,
          reactivatedCount: 1,
          after: { active: 2, retired: 0, total: 2 },
        });
        await expect(
          tx.section.findUnique({
            where: { id: missingSection.id },
            select: {
              retiredAt: true,
              _count: {
                select: {
                  comments: true,
                  homeworks: true,
                  homeworkAuditLogs: true,
                  sectionSubscriptions: true,
                },
              },
              description: { select: { id: true } },
            },
          }),
        ).resolves.toEqual({
          retiredAt: null,
          _count: {
            comments: 1,
            homeworks: 1,
            homeworkAuditLogs: 1,
            sectionSubscriptions: 1,
          },
          description: { id: description.id },
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
