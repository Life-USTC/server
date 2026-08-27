import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as z from "zod";
import type { CommentTargetLoadState } from "@/features/comments/lib/comment-panel-data";
import type { CommentEditorMode } from "@/features/comments/lib/comment-panel-draft-state";
import { createCommentPanelEditActions } from "@/features/comments/lib/comment-panel-edit-actions";
import { createCommentPanelLoadSubmitActions } from "@/features/comments/lib/comment-panel-load-submit-actions";
import {
  commentUploadPendingForMode,
  commentUploadPendingStateWithDelta,
  createCommentUploadPendingState,
} from "@/features/comments/lib/comment-panel-upload-state";
import type {
  CommentNodeWithContext,
  CommentTargetOption,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import type { commentThreadTargetSchema } from "@/lib/api/schemas/comment-target-response-schema";
import type { ViewerContext } from "@/lib/auth/viewer-context";

const apiClientMock = vi.hoisted(() => ({
  GET: vi.fn(),
  PATCH: vi.fn(),
  POST: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiClientMock,
}));

const target: CommentTargetOption = {
  key: "section",
  label: "Section",
  sectionId: 1,
  targetId: 1,
  type: "section",
};

const secondaryTarget: CommentTargetOption = {
  key: "course",
  label: "Course",
  targetId: 2,
  type: "course",
};

const sectionTeacherTarget: CommentTargetOption = {
  key: "section-teacher",
  label: "Teacher",
  sectionId: 1,
  teacherId: 3,
  type: "section-teacher",
};

function viewer(): ViewerContext {
  return {
    image: null,
    isAdmin: false,
    isAuthenticated: true,
    isSuspended: false,
    name: "Viewer",
    suspensionExpiresAt: null,
    suspensionReason: null,
    userId: "user-1",
  };
}

function commentsListResponse() {
  return {
    data: [],
    meta: {
      hiddenCount: 0,
      target: {
        courseId: null,
        courseJwId: null,
        courseName: null,
        homeworkId: null,
        homeworkSectionCode: null,
        homeworkSectionJwId: null,
        homeworkTitle: null,
        sectionCode: null,
        sectionId: 1,
        sectionJwId: 1,
        sectionTeacherCourseJwId: null,
        sectionTeacherCourseName: null,
        sectionTeacherId: null,
        sectionTeacherSectionCode: null,
        sectionTeacherSectionId: null,
        sectionTeacherSectionJwId: null,
        sectionTeacherTeacherId: null,
        sectionTeacherTeacherName: null,
        targetId: 1,
        teacherId: null,
        teacherName: null,
        type: "section",
      },
      viewer: viewer(),
    },
    pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
  };
}

const targetMetadata = commentsListResponse().meta.target;

function comment(overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    attachments: [],
    author: null,
    authorHidden: false,
    body: "existing body",
    renderedBody: "<p>existing body</p>",
    canDelete: false,
    canEdit: true,
    canModerate: false,
    canReact: false,
    canReply: false,
    createdAt: "2026-01-01T00:00:00+08:00",
    id: "comment-1",
    isAnonymous: false,
    isAuthor: true,
    parentId: null,
    reactions: [],
    replies: [],
    repliesNextCursor: null,
    rootId: "comment-1",
    status: "active",
    updatedAt: "2026-01-01T00:00:00+08:00",
    visibility: "public",
    ...overrides,
  };
}

function commentsThreadResponse(
  id = "comment-created",
  overrides: Partial<z.infer<typeof commentThreadTargetSchema>> = {},
) {
  const { type: _type, targetId: _targetId, ...target } = targetMetadata;
  return {
    focusId: id,
    hiddenCount: 0,
    target: { ...target, ...overrides },
    thread: [comment({ id })],
    viewer: viewer(),
  };
}

function sectionTeacherThreadResponse(id: string) {
  return commentsThreadResponse(id, {
    sectionId: 1,
    sectionTeacherId: 31,
    sectionTeacherSectionId: 1,
    sectionTeacherTeacherId: 3,
    teacherId: 3,
  });
}

function createSubmitActions({
  body = "new body",
  onSuccess,
  pendingModes = [],
  targetLoadStates = [],
  targets = [target],
  selectedTarget = target,
  showAllTargets = false,
}: {
  body?: string;
  onSuccess?: (mode: "comment" | "reply") => void;
  pendingModes?: CommentEditorMode[];
  targetLoadStates?: CommentTargetLoadState[];
  targets?: CommentTargetOption[];
  selectedTarget?: CommentTargetOption | null;
  showAllTargets?: boolean;
} = {}) {
  let currentBody = body;
  let submitting = false;
  let currentComments: CommentNodeWithContext[] = showAllTargets
    ? targetLoadStates.flatMap((state) => state.comments)
    : (targetLoadStates[0]?.comments ?? []);
  let currentTargetLoadStates = targetLoadStates;
  const pending = new Set(pendingModes);
  const setComments = vi.fn((value: CommentNodeWithContext[]) => {
    currentComments = value;
  });
  const setMessage = vi.fn();
  const setMessageVariant = vi.fn();
  const setTargetLoadStates = vi.fn((value: CommentTargetLoadState[]) => {
    currentTargetLoadStates = value;
  });

  const actions = createCommentPanelLoadSubmitActions({
    cancelReply: vi.fn(),
    getBody: () => currentBody,
    getCommentCopy: () => ({
      loadFailed: "load failed",
      submitFailed: "submit failed",
    }),
    getComments: () => currentComments,
    getIsAnonymous: () => false,
    getReplyAttachmentIds: () => ["reply-upload"],
    getReplyIsAnonymous: () => false,
    getReplyVisibility: () => "public",
    getSelectedAttachments: () => ["new-upload"],
    getShowAllTargets: () => showAllTargets,
    getSubmitting: () => submitting,
    getTargetLoadStates: () => currentTargetLoadStates,
    getTargetType: () => selectedTarget?.type ?? "section",
    getTargets: () => targets,
    getVisibility: () => "public",
    hasPendingUploads: (mode) => pending.has(mode),
    onSuccess,
    scrollToHashComment: vi.fn(),
    selectedPostTarget: () => selectedTarget,
    setBody: (value) => {
      currentBody = value;
    },
    setComments,
    setHiddenCount: vi.fn(),
    setLoading: vi.fn(),
    setLoadingReplyRootId: vi.fn(),
    setLoadingTargetKey: vi.fn(),
    setMessage,
    setMessageVariant,
    setSelectedAttachments: vi.fn(),
    setSubmitting: (value) => {
      submitting = value;
    },
    setTargetLoadStates,
    setUploadedFiles: vi.fn(),
    setViewer: vi.fn(),
  });

  return {
    actions,
    currentComments: () => currentComments,
    currentTargetLoadStates: () => currentTargetLoadStates,
    setMessage,
    setMessageVariant,
  };
}

describe("评论面板上传挂起状态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiClientMock.GET.mockResolvedValue({
      data: commentsListResponse(),
      response: new Response(null, { status: 200 }),
    });
    apiClientMock.PATCH.mockResolvedValue({
      response: new Response(null, { status: 200 }),
    });
    apiClientMock.POST.mockResolvedValue({
      data: { id: "comment-created" },
      response: new Response(null, { status: 200 }),
    });
  });

  it("在该编辑器的所有上传完成前保持挂起状态为 true", () => {
    let state = createCommentUploadPendingState();

    state = commentUploadPendingStateWithDelta({
      delta: 1,
      mode: "new",
      state,
    });
    state = commentUploadPendingStateWithDelta({
      delta: 1,
      mode: "new",
      state,
    });
    state = commentUploadPendingStateWithDelta({
      delta: -1,
      mode: "new",
      state,
    });

    expect(commentUploadPendingForMode(state, "new")).toBe(true);

    state = commentUploadPendingStateWithDelta({
      delta: -1,
      mode: "new",
      state,
    });
    state = commentUploadPendingStateWithDelta({
      delta: -1,
      mode: "new",
      state,
    });

    expect(commentUploadPendingForMode(state, "new")).toBe(false);
  });

  it("新评论编辑器上传期间阻止新评论提交", async () => {
    const { actions } = createSubmitActions({ pendingModes: ["new"] });

    await actions.submitComment();

    expect(apiClientMock.POST).not.toHaveBeenCalled();
  });

  it("回复编辑器上传期间阻止回复提交", async () => {
    const { actions } = createSubmitActions({ pendingModes: ["reply"] });

    await actions.submitComment("comment-1", "reply body", target);

    expect(apiClientMock.POST).not.toHaveBeenCalled();
  });

  it("编辑编辑器上传期间阻止编辑保存", async () => {
    const loadComments = vi.fn();
    const actions = createCommentPanelEditActions({
      applyEditDraftState: vi.fn(),
      getCommentCopy: () => ({ submitFailed: "submit failed" }),
      getEditAttachmentIds: () => ["edit-upload"],
      getEditDraft: () => "edited body",
      getEditIsAnonymous: () => false,
      getEditVisibility: () => "public",
      hasPendingUploads: (mode) => mode === "edit",
      loadComments,
      setActionMenuId: vi.fn(),
      setMessage: vi.fn(),
      setMessageVariant: vi.fn(),
    });

    await actions.saveEdit(comment());

    expect(apiClientMock.PATCH).not.toHaveBeenCalled();
    expect(loadComments).not.toHaveBeenCalled();
  });

  it("回复上传不会阻塞新评论提交", async () => {
    const { actions } = createSubmitActions({ pendingModes: ["reply"] });

    await actions.submitComment();

    expect(apiClientMock.POST).toHaveBeenCalledWith("/api/community/comments", {
      body: {
        attachmentIds: ["new-upload"],
        body: "new body",
        isAnonymous: false,
        parentId: null,
        sectionId: 1,
        targetId: 1,
        targetType: "section",
        visibility: "public",
      },
    });
  });

  it("评论提交成功反馈不等待列表刷新", async () => {
    const onSuccess = vi.fn();
    let resolveReload: ((value: unknown) => void) | undefined;
    const reload = new Promise((resolve) => {
      resolveReload = resolve;
    });
    apiClientMock.GET.mockReturnValueOnce(reload);
    const { actions } = createSubmitActions({
      onSuccess,
      targetLoadStates: [
        {
          comments: [],
          hiddenCount: 0,
          loaded: true,
          page: 1,
          target,
          total: 0,
          totalPages: 1,
        },
      ],
    });

    const submit = actions.submitComment();
    await vi.waitFor(() => expect(apiClientMock.POST).toHaveBeenCalled());
    await vi.waitFor(() => expect(apiClientMock.GET).toHaveBeenCalled());

    expect(onSuccess).toHaveBeenCalledWith("comment");
    expect(submit).toBeInstanceOf(Promise);

    resolveReload?.({
      data: commentsThreadResponse(),
      response: new Response(null, { status: 200 }),
    });
    await submit;
  });

  it("二级目标未加载时只刷新该目标并合并新评论", async () => {
    apiClientMock.GET.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/community/comments/comment-created")) {
        return {
          data: commentsThreadResponse(),
          response: new Response(null, { status: 200 }),
        };
      }
      return {
        data: commentsListResponse(),
        response: new Response(null, { status: 200 }),
      };
    });
    const { actions, currentComments, currentTargetLoadStates } =
      createSubmitActions({
        showAllTargets: true,
        targets: [target, secondaryTarget],
        selectedTarget: secondaryTarget,
        targetLoadStates: [
          {
            comments: [],
            hiddenCount: 0,
            loaded: true,
            page: 1,
            target,
            total: 0,
            totalPages: 1,
          },
        ],
      });

    await actions.submitComment();

    expect(apiClientMock.GET).toHaveBeenCalledTimes(2);
    expect(apiClientMock.GET.mock.calls[0]?.[0]).toBe(
      "/api/community/comments?targetType=course&targetId=2&pageSize=20&page=1",
    );
    expect(apiClientMock.GET.mock.calls[1]?.[0]).toBe(
      "/api/community/comments/comment-created",
    );
    expect(
      apiClientMock.GET.mock.calls.some(([path]) =>
        String(path).includes("targetType=section"),
      ),
    ).toBe(false);
    expect(currentComments().map((entry) => entry.id)).toContain(
      "comment-created",
    );
    expect(
      currentTargetLoadStates().find(
        (state) => state.target.key === secondaryTarget.key,
      ),
    ).toMatchObject({ loaded: true, comments: [expect.anything()] });
  });

  it("已加载目标的第 21 个根评论通过聚焦读取立即可见", async () => {
    apiClientMock.GET.mockResolvedValueOnce({
      data: commentsThreadResponse(),
      response: new Response(null, { status: 200 }),
    });
    const existingComments = Array.from({ length: 20 }, (_, index) => {
      const id = `existing-${index + 1}`;
      return {
        ...comment({ id, rootId: id }),
        contextKey: target.key,
        replies: [],
      };
    });
    const { actions, currentComments } = createSubmitActions({
      targetLoadStates: [
        {
          comments: existingComments,
          hiddenCount: 0,
          loaded: true,
          page: 1,
          target,
          total: 21,
          totalPages: 2,
        },
      ],
    });

    await actions.submitComment();

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(apiClientMock.GET).toHaveBeenCalledWith(
      "/api/community/comments/comment-created",
    );
    expect(currentComments().map((entry) => entry.id)).toContain(
      "comment-created",
    );
  });

  it("普通目标分页读取后从目标状态重建可见评论列表", async () => {
    const pageComment = comment({ id: "page-root", rootId: "page-root" });
    apiClientMock.GET.mockResolvedValueOnce({
      data: {
        data: [pageComment],
        meta: {
          hiddenCount: 2,
          target: targetMetadata,
          viewer: viewer(),
        },
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      response: new Response(null, { status: 200 }),
    });
    const { actions, currentComments, currentTargetLoadStates } =
      createSubmitActions({
        showAllTargets: true,
        targets: [target, secondaryTarget],
      });

    await actions.loadTarget(target.key);

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(apiClientMock.GET).toHaveBeenCalledWith(
      "/api/community/comments?targetType=section&targetId=1&sectionId=1&pageSize=20&page=1",
    );
    expect(currentComments().map((entry) => entry.id)).toEqual(["page-root"]);
    expect(currentTargetLoadStates()).toEqual([
      expect.objectContaining({
        comments: [expect.objectContaining({ id: "page-root" })],
        hiddenCount: 2,
        loaded: true,
        page: 1,
        target,
      }),
      expect.objectContaining({ loaded: false, target: secondaryTarget }),
    ]);
  });

  it("根评论固定链接超出第一页时通过一次聚焦读取可见", async () => {
    apiClientMock.GET.mockResolvedValueOnce({
      data: commentsThreadResponse("root-21"),
      response: new Response(null, { status: 200 }),
    });
    const existingComments = Array.from({ length: 20 }, (_, index) => {
      const id = `root-${index + 1}`;
      return {
        ...comment({ id, rootId: id }),
        contextKey: target.key,
      };
    });
    const { actions, currentComments } = createSubmitActions({
      targetLoadStates: [
        {
          comments: existingComments,
          hiddenCount: 0,
          loaded: true,
          page: 1,
          target,
          total: 21,
          totalPages: 2,
        },
      ],
    });

    await actions.loadCommentForHash("root-21");

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(apiClientMock.GET).toHaveBeenCalledWith(
      "/api/community/comments/root-21",
    );
    expect(currentComments().map((entry) => entry.id)).toContain("root-21");
  });

  it("回复固定链接超出预览时合并聚焦线程而不加载其他页面", async () => {
    const existingReplies = Array.from({ length: 10 }, (_, index) =>
      comment({
        createdAt: `2026-01-01T00:00:${String(index + 1).padStart(2, "0")}+08:00`,
        id: `reply-${index + 1}`,
        parentId: "root-1",
        rootId: "root-1",
      }),
    );
    apiClientMock.GET.mockResolvedValueOnce({
      data: {
        ...commentsThreadResponse("reply-11"),
        thread: [
          comment({
            id: "root-1",
            replies: [
              comment({
                createdAt: "2026-01-01T00:00:11+08:00",
                id: "reply-11",
                parentId: "root-1",
                rootId: "root-1",
              }),
            ],
            rootId: "root-1",
          }),
        ],
      },
      response: new Response(null, { status: 200 }),
    });
    const { actions, currentComments } = createSubmitActions({
      targetLoadStates: [
        {
          comments: [
            {
              ...comment({
                id: "root-1",
                replies: existingReplies,
                repliesNextCursor: "cursor-1",
              }),
              contextKey: target.key,
            },
          ],
          hiddenCount: 0,
          loaded: true,
          page: 1,
          target,
          total: 1,
          totalPages: 1,
        },
      ],
    });

    await actions.loadCommentForHash("reply-11");

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(currentComments()[0]?.replies.map((entry) => entry.id)).toContain(
      "reply-11",
    );
  });

  it("完整主目标 SSR 数据下将 section-teacher 固定链接合并到二级目标", async () => {
    apiClientMock.GET.mockResolvedValueOnce({
      data: sectionTeacherThreadResponse("teacher-comment"),
      response: new Response(null, { status: 200 }),
    });
    const primaryComment = {
      ...comment({ id: "primary-comment" }),
      contextKey: target.key,
    };
    const { actions, currentComments, currentTargetLoadStates } =
      createSubmitActions({
        showAllTargets: true,
        targets: [target, sectionTeacherTarget],
        targetLoadStates: [
          {
            comments: [primaryComment],
            hiddenCount: 0,
            loaded: true,
            page: 1,
            target,
            total: 1,
            totalPages: 1,
          },
          {
            comments: [],
            hiddenCount: 0,
            loaded: false,
            page: 0,
            target: sectionTeacherTarget,
            total: 0,
            totalPages: 0,
          },
        ],
      });

    await actions.loadCommentForHash("teacher-comment");

    expect(apiClientMock.GET).toHaveBeenCalledOnce();
    expect(
      currentTargetLoadStates().find(
        (state) => state.target.key === sectionTeacherTarget.key,
      ),
    ).toMatchObject({
      comments: [expect.objectContaining({ id: "teacher-comment" })],
      loaded: false,
      page: 0,
    });
    expect(currentComments().map((entry) => entry.id)).toEqual([
      "primary-comment",
      "teacher-comment",
    ]);
  });

  it("刷新失败只报告读取失败且不撤销提交成功反馈", async () => {
    const onSuccess = vi.fn();
    apiClientMock.GET.mockRejectedValueOnce(new Error("refresh failed"));
    const harness = createSubmitActions({
      onSuccess,
      targetLoadStates: [
        {
          comments: [],
          hiddenCount: 0,
          loaded: true,
          page: 1,
          target,
          total: 0,
          totalPages: 1,
        },
      ],
    });

    await harness.actions.submitComment();

    expect(onSuccess).toHaveBeenCalledWith("comment");
    expect(harness.setMessage).toHaveBeenCalledWith("refresh failed");
    expect(harness.setMessage).not.toHaveBeenCalledWith("submit failed");
  });
});
