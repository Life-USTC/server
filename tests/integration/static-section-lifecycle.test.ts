import { describe } from "vitest";
import { reconcileSectionPresence } from "@/static-loader/section-lifecycle";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

describe("static Section source lifecycle persistence", () => {
  it("section.retirement-preserves-data", {
    tags: ["@StaticImport/Service"],
  }, async ({
    isolatedDatabase: { owner: db },
    importer,
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const marker = "[integration-test] section-lifecycle";
      const numericMarker = 1;
      const firstObservedAt = new Date("2026-07-18T03:00:00.000Z");
      const secondObservedAt = new Date("2026-07-19T03:00:00.000Z");
      const {
        semester,
        reappearingSection,
        missingSection,
        schedule,
        exam,
        user,
        comment,
        description,
        homework,
        homeworkAudit,
      } = await db.$transaction(async (tx) => {
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
        const scheduleGroup = await tx.scheduleGroup.create({
          data: {
            jwId: numericMarker,
            no: 1,
            limitCount: 20,
            stdCount: 10,
            actualPeriods: 2,
            isDefault: true,
            sectionId: missingSection.id,
          },
        });
        const schedule = await tx.schedule.create({
          data: {
            sectionId: missingSection.id,
            scheduleGroupId: scheduleGroup.id,
            periods: 2,
            weekday: 1,
            startTime: 800,
            endTime: 1000,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
          },
        });
        const exam = await tx.exam.create({
          data: { jwId: numericMarker, sectionId: missingSection.id },
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
        const homeworkAudit = await tx.auditLog.create({
          data: {
            action: "homework_create",
            targetId: homework.id,
            targetType: "homework",
            metadata: { sectionId: missingSection.id },
          },
        });
        return {
          semester,
          reappearingSection,
          missingSection,
          schedule,
          exam,
          user,
          comment,
          description,
          homework,
          homeworkAudit,
        };
      });

      await expect(
        importer.$transaction((tx) =>
          reconcileSectionPresence(tx, {
            observedAt: firstObservedAt,
            scopedSemesterIds: [semester.id],
            seenSectionJwIds: [
              ...Array.from(
                { length: 70_000 },
                (_, index) => 1_000_000 + index,
              ),
              reappearingSection.jwId,
            ],
            snapshotSha256: "first-snapshot",
          }),
        ),
      ).resolves.toEqual({
        status: "applied",
        scopeSemesterCount: 1,
        seenSectionCount: 70_001,
        missingSectionCount: 1,
        deactivatedCount: 1,
        reactivatedCount: 1,
        before: { active: 1, retired: 1, total: 2 },
        after: { active: 1, retired: 1, total: 2 },
      });

      await expect(
        db.section.findMany({
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
        db.user.findUnique({
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
      expect(
        await db.schedule.findUnique({ where: { id: schedule.id } }),
      ).toEqual(schedule);
      expect(await db.exam.findUnique({ where: { id: exam.id } })).toEqual(
        exam,
      );
      const preservedUserData = [
        await db.comment.findUnique({ where: { id: comment.id } }),
        await db.description.findUnique({ where: { id: description.id } }),
        await db.homework.findUnique({ where: { id: homework.id } }),
        await db.auditLog.findUnique({
          where: { id: homeworkAudit.id },
        }),
      ];
      expect(preservedUserData).toEqual([
        expect.objectContaining({ sectionId: missingSection.id }),
        expect.objectContaining({ sectionId: missingSection.id }),
        expect.objectContaining({ sectionId: missingSection.id }),
        expect.objectContaining({
          targetId: homework.id,
          metadata: expect.objectContaining({
            sectionId: missingSection.id,
          }),
        }),
      ]);
      await expect(
        db.auditLog.findMany({
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
        importer.$transaction((tx) =>
          reconcileSectionPresence(tx, {
            observedAt: secondObservedAt,
            scopedSemesterIds: [semester.id],
            seenSectionJwIds: [reappearingSection.jwId, missingSection.jwId],
            snapshotSha256: "second-snapshot",
          }),
        ),
      ).resolves.toMatchObject({
        missingSectionCount: 0,
        deactivatedCount: 0,
        reactivatedCount: 1,
        after: { active: 2, retired: 0, total: 2 },
      });
      await expect(
        db.section.findUnique({
          where: { id: missingSection.id },
          select: {
            retiredAt: true,
            _count: {
              select: {
                comments: true,
                homeworks: true,
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
          sectionSubscriptions: 1,
        },
        description: { id: description.id },
      });
    });
  });
});
