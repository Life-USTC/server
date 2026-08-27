import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("comment root pagination read model", () => {
  let testPrisma: TestPrismaClient;
  let sectionId: number;
  const marker = `[integration-test] comment-root-pagination-${Date.now()}`;

  beforeAll(async () => {
    testPrisma = createTestPrisma();
    const [course, semester] = await Promise.all([
      testPrisma.course.findFirstOrThrow({ select: { id: true } }),
      testPrisma.semester.findFirstOrThrow({ select: { id: true } }),
    ]);
    const section = await testPrisma.section.create({
      data: {
        code: marker,
        courseId: course.id,
        jwId: 2_000_000_000 + (Date.now() % 100_000_000),
        semesterId: semester.id,
      },
      select: { id: true },
    });
    sectionId = section.id;
    await testPrisma.comment.create({
      data: {
        body: `${marker}-active-root`,
        sectionId,
        status: "active",
        visibility: "public",
      },
    });
    const hiddenRoot = await testPrisma.comment.create({
      data: {
        body: `${marker}-softbanned-root`,
        sectionId,
        status: "softbanned",
        visibility: "public",
      },
    });
    await testPrisma.comment.create({
      data: {
        body: `${marker}-visible-reply`,
        parentId: hiddenRoot.id,
        rootId: hiddenRoot.id,
        sectionId,
        status: "active",
        visibility: "public",
      },
    });
  });

  afterAll(async () => {
    await testPrisma.comment.deleteMany({
      where: { body: { startsWith: marker } },
    });
    await testPrisma.section.delete({ where: { id: sectionId } });
    await disconnectTestPrisma(testPrisma);
  });

  it("returns one exact total with a paged root scan and visible-child roots", async () => {
    const result = await loadCommentThread({
      pagination: { pageSize: 1, skip: 0 },
      target: {
        empty: false,
        homeworkId: null,
        sectionId: null,
        sectionTeacherId: null,
        targetId: sectionId,
        teacherId: null,
        verified: true,
        whereTarget: { sectionId },
      },
      viewer: {
        image: null,
        isAdmin: false,
        isAuthenticated: false,
        isSuspended: false,
        name: null,
        suspensionExpiresAt: null,
        suspensionReason: null,
        userId: null,
      },
      viewerUserId: null,
    });

    expect(result.total).toBe(2);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.replies).toHaveLength(0);
  });
});
