import { beforeEach, describe, expect, it, vi } from "vitest";
import { findDownloadableUpload } from "@/features/uploads/server/upload-service";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    upload: {
      findUnique: vi.fn(),
    },
  },
}));

const findUniqueMock = vi.mocked(prisma.upload.findUnique);
const getViewerContextMock = vi.mocked(getViewerContext);

function upload(overrides: Record<string, unknown> = {}) {
  return {
    contentType: "text/plain",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    filename: "note.txt",
    id: "upload-1",
    key: "uploads/owner/upload.txt",
    size: 123,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    userId: "owner",
    commentAttachments: [],
    ...overrides,
  };
}

function viewer(overrides: Record<string, unknown> = {}) {
  return {
    image: null,
    isAdmin: false,
    isAuthenticated: true,
    isSuspended: false,
    name: "Viewer",
    suspensionExpiresAt: null,
    suspensionReason: null,
    userId: "viewer",
    ...overrides,
  };
}

function attachmentComment(overrides: Record<string, unknown> = {}) {
  return {
    comment: {
      status: "active",
      userId: "owner",
      visibility: "public",
      ...overrides,
    },
  };
}

describe("上传下载权限", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewerContextMock.mockResolvedValue(viewer());
  });

  it("允许所有者下载未附加的上传文件", async () => {
    findUniqueMock.mockResolvedValue(upload({ userId: "viewer" }));

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      expect.objectContaining({ filename: "note.txt" }),
    );
  });

  it("允许登录的非所有者通过可见评论附件下载", async () => {
    findUniqueMock.mockResolvedValue(
      upload({ commentAttachments: [attachmentComment()] }),
    );

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      expect.objectContaining({ key: "uploads/owner/upload.txt" }),
    );
  });

  it("不暴露未附加的非所有者上传文件", async () => {
    findUniqueMock.mockResolvedValue(upload());

    await expect(
      findDownloadableUpload("upload-1", "viewer"),
    ).resolves.toBeNull();
  });

  it("不通过隐藏评论暴露上传文件", async () => {
    findUniqueMock.mockResolvedValue(
      upload({
        commentAttachments: [
          attachmentComment({ status: "deleted" }),
          attachmentComment({ status: "softbanned" }),
        ],
      }),
    );

    await expect(
      findDownloadableUpload("upload-1", "viewer"),
    ).resolves.toBeNull();
  });

  it("允许管理员下载被软禁评论的附件", async () => {
    getViewerContextMock.mockResolvedValue(viewer({ isAdmin: true }));
    findUniqueMock.mockResolvedValue(
      upload({
        commentAttachments: [attachmentComment({ status: "softbanned" })],
      }),
    );

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      expect.objectContaining({ filename: "note.txt" }),
    );
  });
});
