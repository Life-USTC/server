import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadCommentReplies,
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../shared/prisma";

describe("comment root pagination read model", () => {
  let testPrisma: TestPrismaClient;
  let sectionId: number;
  let ownerId: string;
  let otherUserId: string;
  let adminId: string;
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
    const [owner, otherUser, admin] = await Promise.all([
      testPrisma.user.create({
        data: { email: `${marker}-owner@example.test`, name: "Owner" },
        select: { id: true },
      }),
      testPrisma.user.create({
        data: { email: `${marker}-other@example.test`, name: "Other" },
        select: { id: true },
      }),
      testPrisma.user.create({
        data: {
          email: `${marker}-admin@example.test`,
          isAdmin: true,
          name: "Admin",
        },
        select: { id: true },
      }),
    ]);
    ownerId = owner.id;
    otherUserId = otherUser.id;
    adminId = admin.id;
    await testPrisma.comment.create({
      data: {
        body: `${marker}-active-root`,
        sectionId,
        status: "active",
        visibility: "public",
      },
    });
    await testPrisma.comment.create({
      data: {
        body: `${marker}-owner-softbanned-root`,
        sectionId,
        status: "softbanned",
        userId: ownerId,
        visibility: "public",
      },
    });
    await testPrisma.comment.create({
      data: {
        body: `${marker}-other-softbanned-root`,
        sectionId,
        status: "softbanned",
        userId: otherUserId,
        visibility: "public",
      },
    });
    await testPrisma.comment.create({
      data: {
        body: `${marker}-logged-in-root`,
        sectionId,
        status: "active",
        visibility: "logged_in_only",
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
    await testPrisma.user.deleteMany({
      where: { id: { in: [ownerId, otherUserId, adminId] } },
    });
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

  it("preserves anonymous, owner, and admin visibility boundaries", async () => {
    const baseTarget = {
      empty: false,
      homeworkId: null,
      sectionId: null,
      sectionTeacherId: null,
      targetId: sectionId,
      teacherId: null,
      verified: true,
      whereTarget: { sectionId },
    } as const;
    const baseViewer = {
      image: null,
      isSuspended: false,
      name: null,
      suspensionExpiresAt: null,
      suspensionReason: null,
    } as const;
    const loadFor = (input: {
      isAdmin: boolean;
      isAuthenticated: boolean;
      userId: string | null;
    }) =>
      loadCommentThread({
        pagination: { pageSize: 20, skip: 0 },
        target: baseTarget,
        viewer: { ...baseViewer, ...input },
        viewerUserId: input.userId,
      });
    const bodies = (result: Awaited<ReturnType<typeof loadFor>>) =>
      result.comments.map((comment) => comment.body);

    const [anonymous, owner, otherUser, admin] = await Promise.all([
      loadFor({ isAdmin: false, isAuthenticated: false, userId: null }),
      loadFor({ isAdmin: false, isAuthenticated: true, userId: ownerId }),
      loadFor({ isAdmin: false, isAuthenticated: true, userId: otherUserId }),
      loadFor({ isAdmin: true, isAuthenticated: true, userId: adminId }),
    ]);

    expect(anonymous.total).toBe(2);
    expect(anonymous.hiddenCount).toBe(1);
    expect(bodies(anonymous)).toEqual(
      expect.arrayContaining([
        `${marker}-active-root`,
        `${marker}-visible-reply`,
      ]),
    );
    expect(bodies(anonymous)).not.toContain(`${marker}-owner-softbanned-root`);
    expect(bodies(anonymous)).not.toContain(`${marker}-other-softbanned-root`);

    expect(owner.total).toBe(4);
    expect(bodies(owner)).toEqual(
      expect.arrayContaining([
        `${marker}-active-root`,
        `${marker}-owner-softbanned-root`,
        `${marker}-logged-in-root`,
        `${marker}-visible-reply`,
      ]),
    );
    expect(bodies(owner)).not.toContain(`${marker}-other-softbanned-root`);

    expect(otherUser.total).toBe(4);
    expect(bodies(otherUser)).toEqual(
      expect.arrayContaining([
        `${marker}-active-root`,
        `${marker}-other-softbanned-root`,
        `${marker}-logged-in-root`,
        `${marker}-visible-reply`,
      ]),
    );
    expect(bodies(otherUser)).not.toContain(`${marker}-owner-softbanned-root`);

    expect(admin.total).toBe(5);
    expect(bodies(admin)).toEqual(
      expect.arrayContaining([
        `${marker}-active-root`,
        `${marker}-owner-softbanned-root`,
        `${marker}-other-softbanned-root`,
        `${marker}-logged-in-root`,
        `${marker}-softbanned-root`,
      ]),
    );
  });

  it("bounds reply payloads and continues from the preview cursor", async () => {
    const previewMarker = `${marker}-reply-window`;
    const root = await testPrisma.comment.create({
      data: {
        body: `${previewMarker}-root`,
        sectionId,
        status: "active",
        visibility: "public",
      },
      select: { id: true },
    });
    await testPrisma.comment.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        body: `${previewMarker}-reply-${index + 1}`,
        createdAt: new Date(Date.now() + (index + 1) * 1_000),
        parentId: root.id,
        rootId: root.id,
        sectionId,
        status: "active" as const,
        visibility: "public" as const,
      })),
    });

    try {
      const firstPage = await loadCommentThread({
        pagination: { pageSize: 100, skip: 0 },
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
      const rootPreview = firstPage.comments.find(
        (comment) => comment.id === root.id,
      );

      expect(rootPreview?.replies).toHaveLength(10);
      expect(rootPreview?.repliesNextCursor).toEqual(expect.any(String));
      expect(JSON.stringify(rootPreview)).not.toContain(
        `${previewMarker}-reply-11`,
      );
      expect(JSON.stringify(rootPreview).length).toBeLessThan(20_000);

      const continuation = await loadCommentReplies({
        commentId: root.id,
        cursor: rootPreview?.repliesNextCursor,
        pageSize: 20,
        viewerUserId: null,
      });
      expect(continuation.ok).toBe(true);
      if (!continuation.ok) return;
      expect(continuation.nextCursor).toBeNull();
      expect(continuation.thread[0]?.replies).toHaveLength(11);
      expect(
        continuation.thread[0]?.replies.map((reply) => reply.id),
      ).not.toEqual(
        expect.arrayContaining(
          rootPreview?.replies.map((reply) => reply.id) ?? [],
        ),
      );
    } finally {
      await testPrisma.comment.deleteMany({
        where: { body: { startsWith: previewMarker } },
      });
    }
  });

  it("keeps the focused reply's bounded ancestry outside the preview", async () => {
    const focusMarker = `${marker}-focused-ancestry`;
    const root = await testPrisma.comment.create({
      data: {
        body: `${focusMarker}-root`,
        sectionId,
        status: "active",
        visibility: "public",
      },
      select: { id: true },
    });
    let parentId = root.id;
    let focusId = root.id;
    for (let index = 1; index <= 18; index += 1) {
      const reply = await testPrisma.comment.create({
        data: {
          body: `${focusMarker}-reply-${index}`,
          parentId,
          rootId: root.id,
          sectionId,
          status: "active",
          visibility: "public",
        },
        select: { id: true },
      });
      parentId = reply.id;
      focusId = reply.id;
    }

    try {
      const result = await loadFocusedCommentThread({
        commentId: focusId,
        viewerUserId: null,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const focused = findCommentNode(result.thread, focusId);
      expect(focused).toBeDefined();
      expect(findCommentNode(result.thread, root.id)).toBeDefined();
      expect(countCommentNodes(result.thread)).toBe(19);
    } finally {
      await testPrisma.comment.deleteMany({
        where: { body: { startsWith: focusMarker } },
      });
    }
  });
});

type CommentTreeNode = { id: string; replies: CommentTreeNode[] };

function findCommentNode(
  nodes: CommentTreeNode[],
  id: string,
): CommentTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findCommentNode(node.replies, id);
    if (nested) return nested;
  }
  return undefined;
}

function countCommentNodes(nodes: CommentTreeNode[]): number {
  return nodes.reduce(
    (count, node) => count + 1 + countCommentNodes(node.replies),
    0,
  );
}
