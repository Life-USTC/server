import { afterAll, describe, expect, it } from "vitest";
import { reconcileCatalogTeacherFallbacks } from "@/static-loader/teacher-reconciliation";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

afterAll(async () => {
  await disconnectTestPrisma(prisma);
});

describe("static teacher fallback reconciliation", () => {
  it("migrates unique relationships, preserves conflicts, and is idempotent", async () => {
    const rollback = new Error("ROLLBACK_STATIC_TEACHER_RECONCILIATION_TEST");
    const marker = `[integration-test] teacher-reconciliation-${Date.now()}`;
    const numericMarker = 1_500_000_000 + (Date.now() % 100_000_000);

    try {
      await prisma.$transaction(async (tx) => {
        const department = await tx.department.create({
          data: {
            code: marker,
            nameCn: marker,
          },
        });
        const uniqueTarget = await tx.teacher.create({
          data: {
            personId: numericMarker,
            code: `${marker}-unique-target`,
            nameCn: `${marker}-unique`,
            departmentId: department.id,
          },
        });
        const uniqueFallback = await tx.teacher.create({
          data: {
            nameCn: `${marker}-unique`,
            departmentId: department.id,
          },
        });
        const conflictTarget = await tx.teacher.create({
          data: {
            personId: numericMarker + 1,
            code: `${marker}-conflict-target`,
            nameCn: `${marker}-conflict`,
            departmentId: department.id,
          },
        });
        const conflictFallback = await tx.teacher.create({
          data: {
            nameCn: `${marker}-conflict`,
            departmentId: department.id,
          },
        });
        const ambiguousFallback = await tx.teacher.create({
          data: {
            nameCn: `${marker}-ambiguous`,
            departmentId: department.id,
          },
        });

        const course = await tx.course.create({
          data: {
            jwId: numericMarker,
            code: marker,
            nameCn: marker,
          },
        });
        const section = await tx.section.create({
          data: {
            jwId: numericMarker,
            code: marker,
            courseId: course.id,
            teachers: { connect: { id: uniqueFallback.id } },
          },
        });
        const sourceOnlySection = await tx.section.create({
          data: {
            jwId: numericMarker + 1,
            code: `${marker}-source-only`,
            courseId: course.id,
          },
        });
        const scheduleGroup = await tx.scheduleGroup.create({
          data: {
            jwId: numericMarker,
            no: 1,
            limitCount: 1,
            stdCount: 1,
            actualPeriods: 1,
            isDefault: true,
            sectionId: section.id,
          },
        });
        const schedule = await tx.schedule.create({
          data: {
            periods: 1,
            weekday: 1,
            startTime: 1,
            endTime: 2,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            sectionId: section.id,
            scheduleGroupId: scheduleGroup.id,
            teachers: { connect: { id: uniqueFallback.id } },
          },
        });
        await tx.teacherAssignment.create({
          data: {
            teacherId: uniqueFallback.id,
            sectionId: section.id,
            role: "primary",
          },
        });
        const targetSectionTeacher = await tx.sectionTeacher.create({
          data: {
            teacherId: uniqueTarget.id,
            sectionId: section.id,
          },
        });
        const fallbackSectionTeacher = await tx.sectionTeacher.create({
          data: {
            teacherId: uniqueFallback.id,
            sectionId: section.id,
          },
        });
        const sourceOnlySectionTeacher = await tx.sectionTeacher.create({
          data: {
            teacherId: uniqueFallback.id,
            sectionId: sourceOnlySection.id,
          },
        });
        const directComment = await tx.comment.create({
          data: {
            body: `${marker}-direct-comment`,
            teacherId: uniqueFallback.id,
          },
        });
        const sectionTeacherComment = await tx.comment.create({
          data: {
            body: `${marker}-section-teacher-comment`,
            sectionTeacherId: fallbackSectionTeacher.id,
          },
        });
        const sourceOnlySectionTeacherComment = await tx.comment.create({
          data: {
            body: `${marker}-source-only-section-teacher-comment`,
            sectionTeacherId: sourceOnlySectionTeacher.id,
          },
        });
        const uniqueDescription = await tx.description.create({
          data: {
            content: `${marker}-unique-description`,
            teacherId: uniqueFallback.id,
          },
        });
        const conflictTargetDescription = await tx.description.create({
          data: {
            content: `${marker}-conflict-target-description`,
            teacherId: conflictTarget.id,
          },
        });
        const conflictFallbackDescription = await tx.description.create({
          data: {
            content: `${marker}-conflict-fallback-description`,
            teacherId: conflictFallback.id,
          },
        });

        const resolutions = [
          {
            fallback: {
              nameCn: uniqueFallback.nameCn,
              departmentCode: department.code,
            },
            targetIdentity: { personId: uniqueTarget.personId ?? undefined },
          },
          {
            fallback: {
              nameCn: conflictFallback.nameCn,
              departmentCode: department.code,
            },
            targetIdentity: { personId: conflictTarget.personId ?? undefined },
          },
          {
            fallback: {
              nameCn: ambiguousFallback.nameCn,
              departmentCode: department.code,
            },
            targetIdentity: null,
          },
        ];
        const targetIds = new Map([
          [uniqueTarget.personId, uniqueTarget.id],
          [conflictTarget.personId, conflictTarget.id],
        ]);
        const warnings: string[] = [];
        const reconcile = () =>
          reconcileCatalogTeacherFallbacks(tx, resolutions, {
            resolveDepartmentId: (code) =>
              code === department.code ? department.id : undefined,
            resolveTargetId: (identity) =>
              identity.personId == null
                ? undefined
                : targetIds.get(identity.personId),
            warn: (message) => warnings.push(message),
          });

        await expect(reconcile()).resolves.toEqual({
          matchedFallbacks: 2,
          transferredDescriptions: 1,
          deletedFallbacks: 1,
          retainedFallbacks: 1,
          skippedResolutions: 1,
        });

        await expect(
          tx.teacher.findUnique({ where: { id: uniqueFallback.id } }),
        ).resolves.toBeNull();
        await expect(
          tx.description.findUnique({
            where: { id: uniqueDescription.id },
            select: { teacherId: true },
          }),
        ).resolves.toEqual({ teacherId: uniqueTarget.id });
        await expect(
          tx.comment.findUnique({
            where: { id: directComment.id },
            select: { teacherId: true },
          }),
        ).resolves.toEqual({ teacherId: uniqueTarget.id });
        await expect(
          tx.comment.findUnique({
            where: { id: sectionTeacherComment.id },
            select: { sectionTeacherId: true },
          }),
        ).resolves.toEqual({ sectionTeacherId: targetSectionTeacher.id });
        await expect(
          tx.sectionTeacher.findUnique({
            where: { id: fallbackSectionTeacher.id },
          }),
        ).resolves.toBeNull();
        await expect(
          tx.sectionTeacher.findUnique({
            where: { id: sourceOnlySectionTeacher.id },
            select: { teacherId: true },
          }),
        ).resolves.toEqual({ teacherId: uniqueTarget.id });
        await expect(
          tx.comment.findUnique({
            where: { id: sourceOnlySectionTeacherComment.id },
            select: { sectionTeacherId: true },
          }),
        ).resolves.toEqual({
          sectionTeacherId: sourceOnlySectionTeacher.id,
        });
        await expect(
          tx.section.findUnique({
            where: { id: section.id },
            select: { teachers: { select: { id: true } } },
          }),
        ).resolves.toEqual({ teachers: [{ id: uniqueTarget.id }] });
        await expect(
          tx.schedule.findUnique({
            where: { id: schedule.id },
            select: { teachers: { select: { id: true } } },
          }),
        ).resolves.toEqual({ teachers: [{ id: uniqueTarget.id }] });
        await expect(
          tx.teacherAssignment.findUnique({
            where: {
              teacherId_sectionId: {
                teacherId: uniqueTarget.id,
                sectionId: section.id,
              },
            },
            select: { role: true },
          }),
        ).resolves.toEqual({ role: "primary" });

        await expect(
          tx.teacher.findUnique({ where: { id: conflictFallback.id } }),
        ).resolves.not.toBeNull();
        await expect(
          tx.description.findMany({
            where: {
              id: {
                in: [
                  conflictTargetDescription.id,
                  conflictFallbackDescription.id,
                ],
              },
            },
            orderBy: { id: "asc" },
            select: { id: true, teacherId: true },
          }),
        ).resolves.toEqual(
          [
            {
              id: conflictTargetDescription.id,
              teacherId: conflictTarget.id,
            },
            {
              id: conflictFallbackDescription.id,
              teacherId: conflictFallback.id,
            },
          ].sort((left, right) => left.id.localeCompare(right.id)),
        );
        await expect(
          tx.teacher.findUnique({ where: { id: ambiguousFallback.id } }),
        ).resolves.not.toBeNull();
        expect(
          warnings.some((warning) => warning.includes("globally ambiguous")),
        ).toBe(true);
        expect(
          warnings.some((warning) => warning.includes("Description content")),
        ).toBe(true);

        const stateBeforeSecondRun = await tx.teacher.findMany({
          where: {
            id: {
              in: [
                uniqueTarget.id,
                conflictTarget.id,
                conflictFallback.id,
                ambiguousFallback.id,
              ],
            },
          },
          orderBy: { id: "asc" },
          select: {
            id: true,
            description: { select: { id: true } },
            comments: { select: { id: true }, orderBy: { id: "asc" } },
            sectionTeachers: {
              select: { id: true },
              orderBy: { id: "asc" },
            },
          },
        });
        await expect(reconcile()).resolves.toEqual({
          matchedFallbacks: 1,
          transferredDescriptions: 0,
          deletedFallbacks: 0,
          retainedFallbacks: 1,
          skippedResolutions: 1,
        });
        await expect(
          tx.teacher.findMany({
            where: {
              id: {
                in: [
                  uniqueTarget.id,
                  conflictTarget.id,
                  conflictFallback.id,
                  ambiguousFallback.id,
                ],
              },
            },
            orderBy: { id: "asc" },
            select: {
              id: true,
              description: { select: { id: true } },
              comments: { select: { id: true }, orderBy: { id: "asc" } },
              sectionTeachers: {
                select: { id: true },
                orderBy: { id: "asc" },
              },
            },
          }),
        ).resolves.toEqual(stateBeforeSecondRun);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
