import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphqlContext } from "@/lib/graphql/context";
import { graphqlMutationResolvers } from "@/lib/graphql/mutations";

const {
  completeOwnedUploadSessionMock,
  createOwnedUploadSessionMock,
  deleteOwnedUploadMock,
  deleteOwnCommentsBatchMock,
  renameOwnedUploadMock,
  requireGraphqlMutationMock,
  setDashboardLinkPinStatesBatchMock,
} = vi.hoisted(() => ({
  completeOwnedUploadSessionMock: vi.fn(),
  createOwnedUploadSessionMock: vi.fn(),
  deleteOwnedUploadMock: vi.fn(),
  deleteOwnCommentsBatchMock: vi.fn(),
  renameOwnedUploadMock: vi.fn(),
  requireGraphqlMutationMock: vi.fn(),
  setDashboardLinkPinStatesBatchMock: vi.fn(),
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-pin-batch", () => ({
  setDashboardLinkPinStatesBatch: setDashboardLinkPinStatesBatchMock,
}));

vi.mock("@/features/comments/server/comment-batch-delete", () => ({
  deleteOwnCommentsBatch: deleteOwnCommentsBatchMock,
}));

vi.mock("@/features/uploads/server/upload-service", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/features/uploads/server/upload-service")
    >();
  return {
    ...original,
    completeOwnedUploadSession: completeOwnedUploadSessionMock,
    createOwnedUploadSession: createOwnedUploadSessionMock,
    deleteOwnedUpload: deleteOwnedUploadMock,
    renameOwnedUpload: renameOwnedUploadMock,
  };
});

vi.mock("@/lib/graphql/mutation-guard", () => ({
  requireGraphqlMutation: requireGraphqlMutationMock,
}));

const context = {
  locale: "en-us",
  principal: { kind: "anonymous" },
  request: new Request("https://life.example/api/graphql", {
    headers: { "user-agent": "graphql-test" },
  }),
} as unknown as GraphqlContext;

describe("remaining ordinary GraphQL mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGraphqlMutationMock.mockResolvedValue({ userId: "user-1" });
  });

  it("delegates ordered dashboard pin batches to the shared service", async () => {
    setDashboardLinkPinStatesBatchMock.mockResolvedValue({
      ok: true,
      pinnedSlugs: ["mail"],
    });

    await expect(
      graphqlMutationResolvers.Mutation.setDashboardLinkPinStates(
        null,
        {
          items: [
            { slug: " mail ", pinned: true },
            { slug: "mail", pinned: false },
          ],
        },
        context,
      ),
    ).resolves.toEqual({
      pinnedSlugs: ["mail"],
      maxPinnedLinks: 4,
    });
    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(
      context,
      "dashboard",
      { rateLimitTier: "batch" },
    );
    expect(setDashboardLinkPinStatesBatchMock).toHaveBeenCalledWith({
      items: [
        { slug: "mail", action: "pin" },
        { slug: "mail", action: "unpin" },
      ],
      userId: "user-1",
    });
  });

  it("returns stable comment delete results from the audited batch service", async () => {
    const payload = {
      results: [
        { success: true, id: "comment-1" },
        {
          success: false,
          id: "comment-2",
          error: { code: "locked", message: "Comment locked" },
        },
      ],
    };
    deleteOwnCommentsBatchMock.mockResolvedValue(payload);

    await expect(
      graphqlMutationResolvers.Mutation.deleteComments(
        null,
        { ids: [" comment-1 ", "comment-2"] },
        context,
      ),
    ).resolves.toEqual(payload);
    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(
      context,
      "comment",
      { rateLimitTier: "batch" },
    );
    expect(deleteOwnCommentsBatchMock).toHaveBeenCalledWith({
      auditMetadata: {
        ipAddress: undefined,
        source: "graphql",
        userAgent: "graphql-test",
      },
      ids: ["comment-1", "comment-2"],
      userId: "user-1",
    });
  });

  it("creates an upload session without accepting object bytes", async () => {
    createOwnedUploadSessionMock.mockResolvedValue({
      ok: true,
      session: {
        key: "uploads/user-1/file",
        url: "https://life.example/api/uploads/object?key=file",
        maxFileSizeBytes: 52_428_800,
        quotaBytes: 1_073_741_824,
        usedBytes: 42,
      },
    });

    await expect(
      graphqlMutationResolvers.Mutation.createUploadSession(
        null,
        {
          input: {
            filename: " report.pdf ",
            contentType: " application/pdf ",
            size: 42,
          },
        },
        context,
      ),
    ).resolves.toMatchObject({
      key: "uploads/user-1/file",
      usedBytes: 42,
    });
    expect(createOwnedUploadSessionMock).toHaveBeenCalledWith({
      origin: "https://life.example",
      upload: {
        filename: "report.pdf",
        contentType: "application/pdf",
        size: 42,
      },
      userId: "user-1",
    });
  });

  it("completes, renames, and deletes through ownership-aware services", async () => {
    const upload = {
      id: "upload-1",
      key: "uploads/user-1/file",
      filename: "renamed.pdf",
      size: 42,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    };
    completeOwnedUploadSessionMock.mockResolvedValue({
      ok: true,
      completion: {
        upload,
        usedBytes: 42,
        quotaBytes: 1_073_741_824,
      },
    });
    renameOwnedUploadMock.mockResolvedValue({ ok: true, upload });
    deleteOwnedUploadMock.mockResolvedValue({
      ok: true,
      deletedId: upload.id,
      deletedSize: upload.size,
    });

    await expect(
      graphqlMutationResolvers.Mutation.completeUploadSession(
        null,
        {
          input: {
            key: " uploads/user-1/file ",
            filename: " report.pdf ",
          },
        },
        context,
      ),
    ).resolves.toMatchObject({ upload: { id: "upload-1" }, usedBytes: 42 });
    await expect(
      graphqlMutationResolvers.Mutation.renameUpload(
        null,
        { id: " upload-1 ", filename: " renamed.pdf " },
        context,
      ),
    ).resolves.toEqual({ upload });
    await expect(
      graphqlMutationResolvers.Mutation.deleteUpload(
        null,
        { id: " upload-1 " },
        context,
      ),
    ).resolves.toEqual({
      id: "upload-1",
      success: true,
      deletedSize: 42,
    });
    expect(deleteOwnedUploadMock).toHaveBeenCalledWith({
      audit: {
        ipAddress: undefined,
        source: "graphql",
        userAgent: "graphql-test",
      },
      id: "upload-1",
      userId: "user-1",
    });
  });

  it("surfaces storage deletion failure without deleting metadata", async () => {
    deleteOwnedUploadMock.mockResolvedValue({
      ok: false,
      error: "storage_delete_failed",
    });

    await expect(
      graphqlMutationResolvers.Mutation.deleteUpload(
        null,
        { id: "upload-1" },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "SERVICE_UNAVAILABLE" },
      message: "Upload storage deletion failed; metadata was preserved.",
    });
  });

  it("rejects duplicate comment targets and invalid upload metadata before services", async () => {
    await expect(
      graphqlMutationResolvers.Mutation.deleteComments(
        null,
        { ids: ["comment-1", " comment-1 "] },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
      message: "comment IDs must not contain duplicate targets.",
    });
    await expect(
      graphqlMutationResolvers.Mutation.createUploadSession(
        null,
        {
          input: {
            filename: "report.pdf",
            contentType: "application/pdf",
            size: 1.5,
          },
        },
        context,
      ),
    ).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
      message: expect.stringContaining("size must be an integer"),
    });
    expect(deleteOwnCommentsBatchMock).not.toHaveBeenCalled();
    expect(createOwnedUploadSessionMock).not.toHaveBeenCalled();
  });
});
