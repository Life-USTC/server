import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeOwnedUploadSessionMock,
  requireWriteAuthMock,
  uploadKeyBelongsToUserMock,
} = vi.hoisted(() => ({
  completeOwnedUploadSessionMock: vi.fn(),
  requireWriteAuthMock: vi.fn(),
  uploadKeyBelongsToUserMock: vi.fn(),
}));

vi.mock("@/features/uploads/server/upload-service", () => ({
  completeOwnedUploadSession: completeOwnedUploadSessionMock,
  createOwnedUploadSession: vi.fn(),
  uploadKeyBelongsToUser: uploadKeyBelongsToUserMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireWriteAuth: requireWriteAuthMock,
}));

import { postUploadCompleteRoute } from "@/lib/api/routes/upload-session-routes";

describe("upload session routes", () => {
  beforeEach(() => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
    uploadKeyBelongsToUserMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a stable 502 when completion storage cleanup fails", async () => {
    completeOwnedUploadSessionMock.mockResolvedValue({
      ok: false,
      error: "storage_delete_failed",
    });

    const response = await postUploadCompleteRoute(
      new Request("https://example.test/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "test.txt",
          key: "uploads/user-1/test.txt",
        }),
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete upload object",
    });
  });
});
