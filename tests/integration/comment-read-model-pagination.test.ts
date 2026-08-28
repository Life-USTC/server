import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadCommentReplies,
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import type { CommentNode } from "@/features/comments/server/comment-types";
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
    const bodies = (result: Awaited<ReturnType<typeof loadFor>>) => {
      const collect = (comments: CommentNode[]): string[] =>
        comments.flatMap((comment) => [
          comment.body,
          ...collect(comment.replies),
        ]);
      return collect(result.comments);
    };

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

  it("keeps visible branches when an ancestor is hidden and emits one root entry", async () => {
    const visibilityMarker = `${marker}-hidden-ancestor`;
    const hiddenRoot = await testPrisma.comment.create({
      data: {
        body: `${visibilityMarker}-root`,
        sectionId,
        status: "active",
        visibility: "logged_in_only",
      },
      select: { id: true },
    });
    await testPrisma.comment.createMany({
      data: [
        {
          body: `${visibilityMarker}-child-1`,
          parentId: hiddenRoot.id,
          rootId: hiddenRoot.id,
          sectionId,
          status: "active" as const,
          visibility: "public" as const,
        },
        {
          body: `${visibilityMarker}-child-2`,
          parentId: hiddenRoot.id,
          rootId: hiddenRoot.id,
          sectionId,
          status: "active" as const,
          visibility: "public" as const,
        },
      ],
    });

    const visibleRoot = await testPrisma.comment.create({
      data: {
        body: `${visibilityMarker}-visible-root`,
        sectionId,
        status: "active",
        visibility: "public",
      },
      select: { id: true },
    });
    const hiddenParent = await testPrisma.comment.create({
      data: {
        body: `${visibilityMarker}-parent`,
        parentId: visibleRoot.id,
        rootId: visibleRoot.id,
        sectionId,
        status: "active",
        visibility: "logged_in_only",
      },
      select: { id: true },
    });
    const visibleChild = await testPrisma.comment.create({
      data: {
        body: `${visibilityMarker}-visible-child`,
        parentId: hiddenParent.id,
        rootId: visibleRoot.id,
        sectionId,
        status: "active",
        visibility: "public",
      },
      select: { id: true },
    });

    try {
      const listed = await loadCommentThread({
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
      const hiddenRootEntries = listed.comments.filter(
        (comment) => comment.rootId === hiddenRoot.id,
      );
      expect(hiddenRootEntries).toHaveLength(1);
      expect(countCommentNodes(hiddenRootEntries)).toBe(3);
      expect(hiddenRootEntries[0]).toMatchObject({
        body: "",
        id: hiddenRoot.id,
        isAncestryPlaceholder: true,
        status: "active",
        visibility: "public",
      });

      const focused = await loadFocusedCommentThread({
        commentId: visibleChild.id,
        viewerUserId: null,
      });
      expect(focused.ok).toBe(true);
      if (!focused.ok) return;
      expect(focused.thread).toHaveLength(1);
      expect(findCommentNode(focused.thread, visibleRoot.id)).toBeDefined();
      expect(findCommentNode(focused.thread, visibleChild.id)).toBeDefined();
    } finally {
      await testPrisma.comment.deleteMany({
        where: { body: { startsWith: visibilityMarker } },
      });
    }
  });

  it("orders hidden roots by their earliest visible descendant across pages", async () => {
    const orderingMarker = `${marker}-hidden-root-ordering`;
    const hiddenRoot = await testPrisma.comment.create({
      data: {
        body: `${orderingMarker}-hidden-root`,
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
        sectionId,
        status: "active",
        visibility: "logged_in_only",
      },
      select: { id: true },
    });
    await testPrisma.comment.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        body: `${orderingMarker}-reply-${index + 1}`,
        createdAt: new Date(Date.UTC(2020, 2, 1, 0, index, 0, 0)),
        parentId: hiddenRoot.id,
        rootId: hiddenRoot.id,
        sectionId,
        status: "active" as const,
        visibility: "public" as const,
      })),
    });
    const visibleRoot = await testPrisma.comment.create({
      data: {
        body: `${orderingMarker}-visible-root`,
        createdAt: new Date("2020-02-01T00:00:00.000Z"),
        sectionId,
        status: "active",
        visibility: "public",
      },
      select: { id: true },
    });

    const target = {
      empty: false,
      homeworkId: null,
      sectionId: null,
      sectionTeacherId: null,
      targetId: sectionId,
      teacherId: null,
      verified: true,
      whereTarget: { sectionId },
    } as const;
    const viewer = {
      image: null,
      isAdmin: false,
      isAuthenticated: false,
      isSuspended: false,
      name: null,
      suspensionExpiresAt: null,
      suspensionReason: null,
      userId: null,
    } as const;

    try {
      const [firstPage, secondPage] = await Promise.all([
        loadCommentThread({
          pagination: { pageSize: 1, skip: 0 },
          target,
          viewer,
          viewerUserId: null,
        }),
        loadCommentThread({
          pagination: { pageSize: 1, skip: 1 },
          target,
          viewer,
          viewerUserId: null,
        }),
      ]);

      expect(firstPage.comments[0]?.id).toBe(visibleRoot.id);
      expect(secondPage.comments[0]).toMatchObject({
        createdAt: "2020-03-01T08:00:00+08:00",
        id: hiddenRoot.id,
        isAncestryPlaceholder: true,
      });
      expect(secondPage.comments[0]?.repliesNextCursor).toEqual(
        expect.any(String),
      );

      const continuation = await loadCommentReplies({
        commentId: hiddenRoot.id,
        cursor: secondPage.comments[0]?.repliesNextCursor,
        pageSize: 20,
        viewerUserId: null,
      });
      expect(continuation.ok).toBe(true);
      if (!continuation.ok) return;
      expect(continuation.thread).toHaveLength(1);
      expect(continuation.thread[0]).toMatchObject({
        id: hiddenRoot.id,
        isAncestryPlaceholder: true,
      });
      expect(continuation.thread[0]?.replies).toEqual([
        expect.objectContaining({
          body: `${orderingMarker}-reply-11`,
          parentId: hiddenRoot.id,
        }),
      ]);
    } finally {
      await testPrisma.comment.deleteMany({
        where: { body: { startsWith: orderingMarker } },
      });
    }
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
    await testPrisma.comment.update({
      where: { id: root.id },
      data: { rootId: root.id },
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
      expect(rootPreview?.replies.map((reply) => reply.body)).toEqual(
        Array.from(
          { length: 10 },
          (_, index) => `${previewMarker}-reply-${index + 1}`,
        ),
      );
      expect(rootPreview?.replies.some((reply) => reply.id === root.id)).toBe(
        false,
      );
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
        continuation.thread[0]?.replies.map((reply) => reply.body),
      ).toEqual(
        Array.from(
          { length: 11 },
          (_, index) => `${previewMarker}-reply-${index + 11}`,
        ),
      );
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

  it("does not spend the reply preview budget on deleted leaves", async () => {
    const previewMarker = `${marker}-deleted-replies`;
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
      data: Array.from({ length: 3 }, (_, index) => ({
        body: `${previewMarker}-deleted-leaf-${index + 1}`,
        createdAt: new Date(Date.now() + (index + 1) * 1_000),
        parentId: root.id,
        rootId: root.id,
        sectionId,
        status: "deleted" as const,
        visibility: "public" as const,
      })),
    });
    const deletedParent = await testPrisma.comment.create({
      data: {
        body: `${previewMarker}-deleted-parent`,
        createdAt: new Date(Date.now() + 4_000),
        parentId: root.id,
        rootId: root.id,
        sectionId,
        status: "deleted",
        visibility: "public",
      },
      select: { id: true },
    });
    await testPrisma.comment.create({
      data: {
        body: `${previewMarker}-visible-child`,
        createdAt: new Date(Date.now() + 5_000),
        parentId: deletedParent.id,
        rootId: root.id,
        sectionId,
        status: "active",
        visibility: "public",
      },
    });
    await testPrisma.comment.createMany({
      data: Array.from({ length: 10 }, (_, index) => ({
        body: `${previewMarker}-visible-reply-${index + 1}`,
        createdAt: new Date(Date.now() + (index + 6) * 1_000),
        parentId: root.id,
        rootId: root.id,
        sectionId,
        status: "active" as const,
        visibility: "public" as const,
      })),
    });

    try {
      const result = await loadCommentThread({
        pagination: { pageSize: 20, skip: 0 },
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
      const loadedRoot = result.comments.find(
        (comment) => comment.id === root.id,
      );
      const replies = loadedRoot?.replies ?? [];

      expect(replies).toHaveLength(10);
      expect(
        replies.some((reply) =>
          reply.body.startsWith(`${previewMarker}-deleted-leaf`),
        ),
      ).toBe(false);
      const loadedDeletedParent = replies.find(
        (reply) => reply.id === deletedParent.id,
      );
      expect(loadedDeletedParent).toMatchObject({ status: "deleted" });
      expect(loadedDeletedParent?.replies).toEqual([
        expect.objectContaining({
          body: `${previewMarker}-visible-child`,
          status: "active",
        }),
      ]);

      const continuation = await loadCommentReplies({
        commentId: root.id,
        cursor: loadedRoot?.repliesNextCursor,
        pageSize: 20,
        viewerUserId: null,
      });
      expect(continuation.ok).toBe(true);
      if (!continuation.ok) return;
      expect(continuation.nextCursor).toBeNull();
      expect(continuation.thread[0]?.replies).toEqual([
        expect.objectContaining({
          body: `${previewMarker}-visible-reply-10`,
          status: "active",
        }),
      ]);
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
    let omittedAncestorId = "";
    for (let index = 1; index <= 32; index += 1) {
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
      if (index === 11) omittedAncestorId = reply.id;
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
      expect(result.thread).toHaveLength(1);
      expect(findCommentNode(result.thread, omittedAncestorId)).toMatchObject({
        id: omittedAncestorId,
        isAncestryPlaceholder: true,
      });
      expect(countCommentNodes(result.thread)).toBe(33);
      expectNestedParentIds(result.thread);
    } finally {
      await testPrisma.comment.deleteMany({
        where: { body: { startsWith: focusMarker } },
      });
    }
  });
});

type CommentTreeNode = {
  id: string;
  parentId?: string | null;
  replies: CommentTreeNode[];
};

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

function expectNestedParentIds(nodes: CommentTreeNode[]) {
  for (const node of nodes) {
    for (const reply of node.replies) {
      expect(reply.parentId).toBe(node.id);
      expectNestedParentIds([reply]);
    }
  }
}
