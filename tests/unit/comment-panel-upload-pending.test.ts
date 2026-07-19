import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentEditorMode } from "@/features/comments/lib/comment-panel-draft-state";
import { createCommentPanelEditActions } from "@/features/comments/lib/comment-panel-edit-actions";
import { createCommentPanelLoadSubmitActions } from "@/features/comments/lib/comment-panel-load-submit-actions";
import {
  commentUploadPendingForMode,
  commentUploadPendingStateWithDelta,
  createCommentUploadPendingState,
} from "@/features/comments/lib/comment-panel-upload-state";
import type { CommentTargetOption } from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
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
    rootId: "comment-1",
    status: "active",
    updatedAt: "2026-01-01T00:00:00+08:00",
    visibility: "public",
    ...overrides,
  };
}

function createSubmitActions({
  body = "new body",
  pendingModes = [],
}: {
  body?: string;
  pendingModes?: CommentEditorMode[];
} = {}) {
  let currentBody = body;
  let submitting = false;
  const pending = new Set(pendingModes);

  return createCommentPanelLoadSubmitActions({
    cancelReply: vi.fn(),
    getBody: () => currentBody,
    getCommentCopy: () => ({
      loadFailed: "load failed",
      submitFailed: "submit failed",
    }),
    getIsAnonymous: () => false,
    getReplyAttachmentIds: () => ["reply-upload"],
    getReplyIsAnonymous: () => false,
    getReplyVisibility: () => "public",
    getSelectedAttachments: () => ["new-upload"],
    getShowAllTargets: () => false,
    getSubmitting: () => submitting,
    getTargetType: () => "section",
    getTargets: () => [target],
    getVisibility: () => "public",
    hasPendingUploads: (mode) => pending.has(mode),
    scrollToHashComment: vi.fn(),
    selectedPostTarget: () => target,
    setBody: (value) => {
      currentBody = value;
    },
    setComments: vi.fn(),
    setHiddenCount: vi.fn(),
    setLoading: vi.fn(),
    setMessage: vi.fn(),
    setSelectedAttachments: vi.fn(),
    setSubmitting: (value) => {
      submitting = value;
    },
    setUploadedFiles: vi.fn(),
    setViewer: vi.fn(),
  });
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
    const actions = createSubmitActions({ pendingModes: ["new"] });

    await actions.submitComment();

    expect(apiClientMock.POST).not.toHaveBeenCalled();
  });

  it("回复编辑器上传期间阻止回复提交", async () => {
    const actions = createSubmitActions({ pendingModes: ["reply"] });

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
    });

    await actions.saveEdit(comment());

    expect(apiClientMock.PATCH).not.toHaveBeenCalled();
    expect(loadComments).not.toHaveBeenCalled();
  });

  it("回复上传不会阻塞新评论提交", async () => {
    const actions = createSubmitActions({ pendingModes: ["reply"] });

    await actions.submitComment();

    expect(apiClientMock.POST).toHaveBeenCalledWith("/api/comments", {
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
});
