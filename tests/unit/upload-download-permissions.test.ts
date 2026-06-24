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

describe("upload download permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewerContextMock.mockResolvedValue(viewer());
  });

  it("allows owners to download unattached uploads", async () => {
    findUniqueMock.mockResolvedValue(upload({ userId: "viewer" }));

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      expect.objectContaining({ filename: "note.txt" }),
    );
  });

  it("allows signed-in non-owners through visible comment attachments", async () => {
    findUniqueMock.mockResolvedValue(
      upload({ commentAttachments: [attachmentComment()] }),
    );

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      expect.objectContaining({ key: "uploads/owner/upload.txt" }),
    );
  });

  it("does not expose unattached non-owner uploads", async () => {
    findUniqueMock.mockResolvedValue(upload());

    await expect(
      findDownloadableUpload("upload-1", "viewer"),
    ).resolves.toBeNull();
  });

  it("does not expose uploads through hidden comments", async () => {
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

  it("allows admins to download softbanned comment attachments", async () => {
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
