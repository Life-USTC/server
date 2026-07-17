import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import {
  assertCourseAliasJwIdAvailable,
  assertCourseJwIdNamespace,
  mergeLegacyCourseDuplicates,
} from "@/static-loader/course-merge";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();
const testJwIds = [
  2_130_100_001, 2_130_100_002, 2_130_100_003, 2_130_100_004, 2_130_100_005,
  2_130_100_006, 2_130_100_007, 2_130_100_008,
];
const testSectionJwId = 2_130_200_001;
const testCommentId = "integration-course-merge-comment";
const testSecondCommentId = "integration-course-merge-comment-second";
const concurrentCommentId = "integration-course-merge-concurrent-comment";
const concurrentDescriptionId =
  "integration-course-merge-concurrent-description";
const concurrentlyEditedDescriptionId =
  "integration-course-merge-concurrently-edited-description";
const concurrentDescriptionEditId =
  "integration-course-merge-concurrent-description-edit";
const testUserEmails = [
  "target-editor@course-merge.integration",
  "source-editor@course-merge.integration",
];

async function cleanFixtures() {
  await prisma.comment.deleteMany({
    where: {
      id: {
        in: [testCommentId, testSecondCommentId, concurrentCommentId],
      },
    },
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

  it("preserves source-only Description metadata and edit history", async () => {
    const [editor, targetCourse, sourceCourse] = await Promise.all([
      prisma.user.create({
        data: {
          email: testUserEmails[0],
          name: "Source-only Editor",
        },
        select: { id: true },
      }),
      prisma.course.create({
        data: {
          jwId: testJwIds[2],
          code: "INTEGRATION-COURSE-MERGE-SOURCE-ONLY",
          nameCn: "课程单侧简介合并目标",
          nameEn: "Source-only Description Target",
        },
        select: { id: true },
      }),
      prisma.course.create({
        data: {
          jwId: testJwIds[3],
          code: "INTEGRATION-COURSE-MERGE-SOURCE-ONLY",
          nameCn: "课程单侧简介合并目标",
        },
        select: { id: true },
      }),
    ]);
    const createdAt = new Date("2017-01-01T00:00:00.000Z");
    const updatedAt = new Date("2018-02-03T04:05:06.000Z");
    const lastEditedAt = new Date("2018-02-02T03:04:05.000Z");
    await prisma.description.create({
      data: {
        id: "integration-course-merge-source-only",
        content: "source-only description",
        courseId: sourceCourse.id,
        createdAt,
        updatedAt,
        lastEditedAt,
        lastEditedById: editor.id,
      },
    });
    await prisma.descriptionEdit.create({
      data: {
        id: "integration-course-merge-source-only-edit",
        descriptionId: "integration-course-merge-source-only",
        previousContent: null,
        nextContent: "source-only description",
        createdAt: lastEditedAt,
      },
    });

    await prisma.$transaction((tx) =>
      mergeLegacyCourseDuplicates(
        tx,
        [
          {
            sourceKey: "integration-course-merge-source-only",
            jwId: testJwIds[2],
            code: "INTEGRATION-COURSE-MERGE-SOURCE-ONLY",
            nameCn: "课程单侧简介合并目标",
            nameEn: "Source-only Description Target",
          },
        ],
        new Set([testJwIds[2]]),
      ),
    );

    const [description, edits] = await Promise.all([
      prisma.description.findUnique({
        where: { id: "integration-course-merge-source-only" },
        select: {
          content: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
          lastEditedAt: true,
          lastEditedById: true,
        },
      }),
      prisma.descriptionEdit.findMany({
        where: { descriptionId: "integration-course-merge-source-only" },
        select: {
          id: true,
          previousContent: true,
          nextContent: true,
          createdAt: true,
        },
      }),
    ]);
    expect(description).toEqual({
      content: "source-only description",
      courseId: targetCourse.id,
      createdAt,
      updatedAt,
      lastEditedAt,
      lastEditedById: editor.id,
    });
    expect(edits).toEqual([
      {
        id: "integration-course-merge-source-only-edit",
        previousContent: null,
        nextContent: "source-only description",
        createdAt: lastEditedAt,
      },
    ]);
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
    const firstCommentCreatedAt = new Date("2021-01-01T00:00:00.000Z");
    const firstCommentUpdatedAt = new Date("2021-02-01T00:00:00.000Z");
    const secondCommentCreatedAt = new Date("2022-01-01T00:00:00.000Z");
    const secondCommentUpdatedAt = new Date("2022-03-01T00:00:00.000Z");
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
    await prisma.comment.createMany({
      data: [
        {
          id: testCommentId,
          body: "course merge relationship content",
          courseId: sourceCourse.id,
          createdAt: firstCommentCreatedAt,
          updatedAt: firstCommentUpdatedAt,
        },
        {
          id: testSecondCommentId,
          body: "second course merge relationship content",
          courseId: sourceCourse.id,
          createdAt: secondCommentCreatedAt,
          updatedAt: secondCommentUpdatedAt,
        },
      ],
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
      comments,
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
      prisma.comment.findMany({
        where: { id: { in: [testCommentId, testSecondCommentId] } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          body: true,
          courseId: true,
          createdAt: true,
          updatedAt: true,
        },
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
    expect(comments).toEqual([
      {
        id: testCommentId,
        body: "course merge relationship content",
        courseId: targetCourse.id,
        createdAt: firstCommentCreatedAt,
        updatedAt: firstCommentUpdatedAt,
      },
      {
        id: testSecondCommentId,
        body: "second course merge relationship content",
        courseId: targetCourse.id,
        createdAt: secondCommentCreatedAt,
        updatedAt: secondCommentUpdatedAt,
      },
    ]);
  });

  it("preserves a concurrent Comment and Description committed during merge", async () => {
    const [targetCourse, sourceCourse] = await Promise.all([
      prisma.course.create({
        data: {
          jwId: testJwIds[4],
          code: "INTEGRATION-COURSE-MERGE-CONCURRENT",
          nameCn: "课程并发合并目标",
          nameEn: "Concurrent Course Merge Target",
        },
        select: { id: true },
      }),
      prisma.course.create({
        data: {
          jwId: testJwIds[5],
          code: "INTEGRATION-COURSE-MERGE-CONCURRENT",
          nameCn: "课程并发合并目标",
        },
        select: { id: true },
      }),
    ]);
    const mergePrisma = createTestPrisma();
    const writerPrisma = createTestPrisma();
    let signalInserted: () => void = () => {};
    let allowWriterCommit: () => void = () => {};
    const inserted = new Promise<void>((resolve) => {
      signalInserted = resolve;
    });
    const mayCommit = new Promise<void>((resolve) => {
      allowWriterCommit = resolve;
    });

    try {
      const writer = writerPrisma.$transaction(async (tx) => {
        await tx.comment.create({
          data: {
            id: concurrentCommentId,
            body: "concurrent course merge comment",
            courseId: sourceCourse.id,
          },
        });
        await tx.description.create({
          data: {
            id: concurrentDescriptionId,
            content: "concurrent course merge description",
            courseId: sourceCourse.id,
          },
        });
        signalInserted();
        await mayCommit;
      });
      await inserted;

      let signalMergePid: (pid: number) => void = () => {};
      const mergePid = new Promise<number>((resolve) => {
        signalMergePid = resolve;
      });
      const merge = mergePrisma.$transaction(async (tx) => {
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid
        `;
        signalMergePid(backend.pid);
        await mergeLegacyCourseDuplicates(
          tx,
          [
            {
              sourceKey: "integration-course-merge-concurrent",
              jwId: testJwIds[4],
              code: "INTEGRATION-COURSE-MERGE-CONCURRENT",
              nameCn: "课程并发合并目标",
              nameEn: "Concurrent Course Merge Target",
            },
          ],
          new Set([testJwIds[4]]),
        );
      });

      const pid = await mergePid;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [activity] = await writerPrisma.$queryRaw<
          Array<{ waitEventType: string | null }>
        >`
          SELECT "wait_event_type" AS "waitEventType"
          FROM pg_stat_activity
          WHERE pid = ${pid}
        `;
        if (activity?.waitEventType === "Lock") break;
        if (attempt === 99) {
          throw new Error(
            "Course merge did not wait for the concurrent writer",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      allowWriterCommit();
      await writer;
      await merge;

      const [comment, description] = await Promise.all([
        prisma.comment.findUnique({
          where: { id: concurrentCommentId },
          select: { body: true, courseId: true },
        }),
        prisma.description.findUnique({
          where: { id: concurrentDescriptionId },
          select: { content: true, courseId: true },
        }),
      ]);
      expect(comment).toEqual({
        body: "concurrent course merge comment",
        courseId: targetCourse.id,
      });
      expect(description).toEqual({
        content: "concurrent course merge description",
        courseId: targetCourse.id,
      });
    } finally {
      allowWriterCommit();
      await Promise.all([
        disconnectTestPrisma(mergePrisma),
        disconnectTestPrisma(writerPrisma),
      ]);
    }
  });

  it("waits for an existing Description edit before moving it", async () => {
    const [editor, targetCourse, sourceCourse] = await Promise.all([
      prisma.user.create({
        data: {
          email: testUserEmails[0],
          name: "Concurrent Description Editor",
        },
        select: { id: true },
      }),
      prisma.course.create({
        data: {
          jwId: testJwIds[6],
          code: "INTEGRATION-COURSE-MERGE-CONCURRENT-EDIT",
          nameCn: "课程并发简介编辑目标",
          nameEn: "Concurrent Description Edit Target",
        },
        select: { id: true },
      }),
      prisma.course.create({
        data: {
          jwId: testJwIds[7],
          code: "INTEGRATION-COURSE-MERGE-CONCURRENT-EDIT",
          nameCn: "课程并发简介编辑目标",
        },
        select: { id: true },
      }),
    ]);
    const originalCreatedAt = new Date("2020-01-01T00:00:00.000Z");
    const originalUpdatedAt = new Date("2020-02-01T00:00:00.000Z");
    const editedAt = new Date("2030-03-04T05:06:07.000Z");
    await prisma.description.create({
      data: {
        id: concurrentlyEditedDescriptionId,
        content: "before concurrent edit",
        courseId: sourceCourse.id,
        createdAt: originalCreatedAt,
        updatedAt: originalUpdatedAt,
      },
    });

    const mergePrisma = createTestPrisma();
    const writerPrisma = createTestPrisma();
    let signalEdited: () => void = () => {};
    let allowWriterCommit: () => void = () => {};
    const edited = new Promise<void>((resolve) => {
      signalEdited = resolve;
    });
    const mayCommit = new Promise<void>((resolve) => {
      allowWriterCommit = resolve;
    });

    try {
      const writer = writerPrisma.$transaction(async (tx) => {
        await tx.description.update({
          where: { id: concurrentlyEditedDescriptionId },
          data: {
            content: "after concurrent edit",
            updatedAt: editedAt,
            lastEditedAt: editedAt,
            lastEditedById: editor.id,
          },
        });
        await tx.descriptionEdit.create({
          data: {
            id: concurrentDescriptionEditId,
            descriptionId: concurrentlyEditedDescriptionId,
            editorId: editor.id,
            previousContent: "before concurrent edit",
            nextContent: "after concurrent edit",
            createdAt: editedAt,
          },
        });
        signalEdited();
        await mayCommit;
      });
      await edited;

      let signalMergePid: (pid: number) => void = () => {};
      const mergePid = new Promise<number>((resolve) => {
        signalMergePid = resolve;
      });
      const merge = mergePrisma.$transaction(async (tx) => {
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid
        `;
        signalMergePid(backend.pid);
        await mergeLegacyCourseDuplicates(
          tx,
          [
            {
              sourceKey: "integration-course-merge-concurrent-edit",
              jwId: testJwIds[6],
              code: "INTEGRATION-COURSE-MERGE-CONCURRENT-EDIT",
              nameCn: "课程并发简介编辑目标",
              nameEn: "Concurrent Description Edit Target",
            },
          ],
          new Set([testJwIds[6]]),
        );
      });

      const pid = await mergePid;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const [activity] = await writerPrisma.$queryRaw<
          Array<{ waitEventType: string | null }>
        >`
          SELECT "wait_event_type" AS "waitEventType"
          FROM pg_stat_activity
          WHERE pid = ${pid}
        `;
        if (activity?.waitEventType === "Lock") break;
        if (attempt === 99) {
          throw new Error(
            "Course merge did not wait for the concurrent Description edit",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      allowWriterCommit();
      await writer;
      await merge;

      const [description, edit] = await Promise.all([
        prisma.description.findUnique({
          where: { id: concurrentlyEditedDescriptionId },
          select: {
            content: true,
            courseId: true,
            createdAt: true,
            updatedAt: true,
            lastEditedAt: true,
            lastEditedById: true,
          },
        }),
        prisma.descriptionEdit.findUnique({
          where: { id: concurrentDescriptionEditId },
          select: {
            descriptionId: true,
            editorId: true,
            previousContent: true,
            nextContent: true,
            createdAt: true,
          },
        }),
      ]);
      expect(description).toEqual({
        content: "after concurrent edit",
        courseId: targetCourse.id,
        createdAt: originalCreatedAt,
        updatedAt: editedAt,
        lastEditedAt: editedAt,
        lastEditedById: editor.id,
      });
      expect(edit).toEqual({
        descriptionId: concurrentlyEditedDescriptionId,
        editorId: editor.id,
        previousContent: "before concurrent edit",
        nextContent: "after concurrent edit",
        createdAt: editedAt,
      });
    } finally {
      allowWriterCommit();
      await Promise.all([
        disconnectTestPrisma(mergePrisma),
        disconnectTestPrisma(writerPrisma),
      ]);
    }
  });
});
