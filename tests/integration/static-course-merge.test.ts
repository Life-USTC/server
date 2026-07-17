import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import {
  assertCourseAliasJwIdAvailable,
  assertCourseJwIdNamespace,
  mergeLegacyCourseDuplicates,
} from "@/static-loader/course-merge";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const testJwIds = [2_130_100_001, 2_130_100_002, 2_130_100_003, 2_130_100_004];
const testSectionJwId = 2_130_200_001;
const testCommentId = "integration-course-merge-comment";
const testUserEmails = [
  "target-editor@course-merge.integration",
  "source-editor@course-merge.integration",
];

async function cleanFixtures() {
  await prisma.comment.deleteMany({
    where: { id: testCommentId },
  });
  await prisma.section.deleteMany({
    where: { jwId: testSectionJwId },
  });
  await prisma.courseAlias.deleteMany({
    where: { jwId: { in: testJwIds } },
  });
  await prisma.course.deleteMany({
    where: { jwId: { in: testJwIds } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: testUserEmails } },
  });
}

beforeEach(cleanFixtures);
afterEach(cleanFixtures);
afterAll(() => disconnectTestPrisma(prisma));

describe("static Course merge persistence", () => {
  it("fails closed for Course and CourseAlias jwId collisions in both directions", async () => {
    const canonical = await prisma.course.create({
      data: {
        jwId: testJwIds[0],
        code: "INTEGRATION-COURSE-NAMESPACE-CANONICAL",
        nameCn: "课程编号命名空间测试",
      },
      select: { id: true },
    });
    await prisma.courseAlias.create({
      data: {
        jwId: testJwIds[1],
        courseId: canonical.id,
      },
    });

    await expect(
      assertCourseJwIdNamespace(prisma, [testJwIds[1]]),
    ).rejects.toThrow(`namespace collision: ${testJwIds[1]}`);
    await expect(
      assertCourseAliasJwIdAvailable(prisma, testJwIds[0]),
    ).rejects.toThrow(`namespace collision: ${testJwIds[0]}`);

    await prisma.course.create({
      data: {
        jwId: testJwIds[1],
        code: "INTEGRATION-COURSE-NAMESPACE-COLLISION",
        nameCn: "课程编号碰撞测试",
      },
    });
    await expect(assertCourseJwIdNamespace(prisma)).rejects.toThrow(
      `namespace collision: ${testJwIds[1]}`,
    );
    await expect(resolveCourseIdByJwId(prisma, testJwIds[1])).rejects.toThrow(
      `namespace collision: ${testJwIds[1]}`,
    );
  });

  it("resolves exact and alias jwIds to one canonical Course", async () => {
    const canonical = await prisma.course.create({
      data: {
        jwId: testJwIds[0],
        code: "INTEGRATION-COURSE-ALIAS",
        nameCn: "课程别名测试",
      },
      select: { id: true },
    });
    await prisma.courseAlias.create({
      data: {
        jwId: testJwIds[1],
        courseId: canonical.id,
      },
    });

    await expect(resolveCourseIdByJwId(prisma, testJwIds[0])).resolves.toBe(
      canonical.id,
    );
    await expect(resolveCourseIdByJwId(prisma, testJwIds[1])).resolves.toBe(
      canonical.id,
    );
    await expect(
      resolveCourseIdByJwId(prisma, testJwIds[2]),
    ).resolves.toBeNull();
  });

  it("keeps the newest Description metadata while moving all edits", async () => {
    const [targetEditor, sourceEditor, targetCourse, sourceCourse] =
      await Promise.all([
        prisma.user.create({
          data: {
            email: testUserEmails[0],
            name: "Target Editor",
          },
          select: { id: true },
        }),
        prisma.user.create({
          data: {
            email: testUserEmails[1],
            name: "Source Editor",
          },
          select: { id: true },
        }),
        prisma.course.create({
          data: {
            jwId: testJwIds[2],
            code: "INTEGRATION-COURSE-MERGE",
            nameCn: "课程合并目标",
            nameEn: "Course Merge Target",
          },
          select: { id: true },
        }),
        prisma.course.create({
          data: {
            jwId: testJwIds[3],
            code: "INTEGRATION-COURSE-MERGE",
            nameCn: "课程合并目标",
          },
          select: { id: true },
        }),
      ]);
    const targetCreatedAt = new Date("2019-01-01T00:00:00.000Z");
    const targetUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    const sourceCreatedAt = new Date("2018-01-01T00:00:00.000Z");
    const sourceUpdatedAt = new Date("2030-01-01T00:00:00.000Z");
    await prisma.description.createMany({
      data: [
        {
          id: "integration-course-merge-target",
          content: "identical description",
          courseId: targetCourse.id,
          createdAt: targetCreatedAt,
          updatedAt: targetUpdatedAt,
          lastEditedAt: targetUpdatedAt,
          lastEditedById: targetEditor.id,
        },
        {
          id: "integration-course-merge-source",
          content: "identical description",
          courseId: sourceCourse.id,
          createdAt: sourceCreatedAt,
          updatedAt: sourceUpdatedAt,
          lastEditedAt: sourceUpdatedAt,
          lastEditedById: sourceEditor.id,
        },
      ],
    });
    await prisma.descriptionEdit.createMany({
      data: [
        {
          id: "integration-course-merge-target-edit",
          descriptionId: "integration-course-merge-target",
          previousContent: null,
          nextContent: "identical description",
          createdAt: targetUpdatedAt,
        },
        {
          id: "integration-course-merge-source-edit",
          descriptionId: "integration-course-merge-source",
          previousContent: null,
          nextContent: "identical description",
          createdAt: sourceUpdatedAt,
        },
      ],
    });
    const sourceSection = await prisma.section.create({
      data: {
        jwId: testSectionJwId,
        code: "INTEGRATION-COURSE-MERGE-SECTION",
        courseId: sourceCourse.id,
      },
      select: { id: true },
    });
    await prisma.comment.create({
      data: {
        id: testCommentId,
        body: "course merge relationship content",
        courseId: sourceCourse.id,
      },
    });

    const merge = () =>
      prisma.$transaction((tx) =>
        mergeLegacyCourseDuplicates(
          tx,
          [
            {
              sourceKey: "integration-course-merge",
              jwId: testJwIds[2],
              code: "INTEGRATION-COURSE-MERGE",
              nameCn: "课程合并目标",
              nameEn: "Course Merge Target",
            },
          ],
          new Set([testJwIds[2]]),
        ),
      );

    await merge();
    await merge();

    const [
      description,
      sourceDescription,
      sourceCourseAfterMerge,
      alias,
      edits,
      section,
      comment,
    ] = await Promise.all([
      prisma.description.findUnique({
        where: { id: "integration-course-merge-target" },
        select: {
          createdAt: true,
          updatedAt: true,
          lastEditedAt: true,
          lastEditedById: true,
        },
      }),
      prisma.description.findUnique({
        where: { id: "integration-course-merge-source" },
        select: { id: true },
      }),
      prisma.course.findUnique({
        where: { id: sourceCourse.id },
        select: { id: true },
      }),
      prisma.courseAlias.findUnique({
        where: { jwId: testJwIds[3] },
        select: { courseId: true },
      }),
      prisma.descriptionEdit.findMany({
        where: { descriptionId: "integration-course-merge-target" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      prisma.section.findUnique({
        where: { id: sourceSection.id },
        select: { courseId: true },
      }),
      prisma.comment.findUnique({
        where: { id: testCommentId },
        select: { body: true, courseId: true },
      }),
    ]);
    expect(description).toMatchObject({
      createdAt: sourceCreatedAt,
      updatedAt: sourceUpdatedAt,
      lastEditedAt: sourceUpdatedAt,
      lastEditedById: sourceEditor.id,
    });
    expect(sourceDescription).toBeNull();
    expect(sourceCourseAfterMerge).toBeNull();
    expect(alias?.courseId).toBe(targetCourse.id);
    expect(edits.map((edit) => edit.id)).toEqual([
      "integration-course-merge-target-edit",
      "integration-course-merge-source-edit",
    ]);
    expect(section?.courseId).toBe(targetCourse.id);
    expect(comment).toEqual({
      body: "course merge relationship content",
      courseId: targetCourse.id,
    });
  });
});
