import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireAuthMock,
  requireWriteAuthMock,
  resolveApiUserIdMock,
  updateDashboardLinkPinStateMock,
  renameOwnedUploadMock,
} = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  requireWriteAuthMock: vi.fn(),
  resolveApiUserIdMock: vi.fn(),
  updateDashboardLinkPinStateMock: vi.fn(),
  renameOwnedUploadMock: vi.fn(),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  requireWriteAuth: requireWriteAuthMock,
  resolveApiUserId: resolveApiUserIdMock,
}));

vi.mock("@/features/comments/server/comment-mutations", () => ({
  createComment: vi.fn(),
  updateOwnComment: vi.fn(),
}));

vi.mock("@/features/descriptions/server/description-upsert", () => ({
  upsertDescriptionContent: vi.fn(),
}));

vi.mock("@/features/uploads/server/upload-service", () => ({
  deleteOwnedUpload: vi.fn(),
  listUploads: vi.fn(),
  renameOwnedUpload: renameOwnedUploadMock,
}));

vi.mock("@/features/dashboard-links/server/dashboard-link-service", () => ({
  MAX_PINNED_LINKS: 6,
  logDashboardLinkPinFailure: vi.fn(),
  resolveDashboardLinkBySlug: vi.fn(),
  sanitizeDashboardReturnTo: (value: string | null | undefined) => value || "/",
  updateDashboardLinkPinState: updateDashboardLinkPinStateMock,
}));

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function jsonRequest(url: string, method: string) {
  return new Request(url, {
    body: "{",
    headers: { "Content-Type": "application/json" },
    method,
  });
}

describe("protected write route auth order", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    requireWriteAuthMock.mockReset();
    resolveApiUserIdMock.mockReset();
    updateDashboardLinkPinStateMock.mockReset();
    renameOwnedUploadMock.mockReset();
    vi.resetModules();
  });

  it("authenticates comment creation before parsing the JSON body", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postCommentRoute } = await import(
      "@/lib/api/routes/comments-create-route"
    );

    const response = await postCommentRoute(
      jsonRequest("https://example.test/api/comments", "POST"),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("authenticates comment updates before parsing the JSON body", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchCommentRoute } = await import(
      "@/lib/api/routes/comments-update-route"
    );

    const response = await patchCommentRoute(
      jsonRequest("https://example.test/api/comments/comment-1", "PATCH"),
      { id: "comment-1" },
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("authenticates description writes before parsing the JSON body", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postDescriptionRoute } = await import(
      "@/lib/api/routes/description-upsert-route"
    );

    const response = await postDescriptionRoute(
      jsonRequest("https://example.test/api/descriptions", "POST"),
    );

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("authenticates upload renames before parsing the JSON body", async () => {
    requireWriteAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchUploadRoute } = await import(
      "@/lib/api/routes/upload-management-routes"
    );

    const response = await patchUploadRoute(
      jsonRequest("https://example.test/api/uploads/upload-1", "PATCH"),
      { id: "upload-1" },
    );

    expect(response.status).toBe(401);
    expect(requireWriteAuthMock).toHaveBeenCalledOnce();
    expect(renameOwnedUploadMock).not.toHaveBeenCalled();
  });

  it("authenticates dashboard link pinning before parsing form data", async () => {
    resolveApiUserIdMock.mockResolvedValue(null);
    const { postDashboardLinkPinRoute } = await import(
      "@/lib/api/routes/dashboard-link-pin-route"
    );

    const response = await postDashboardLinkPinRoute(
      new Request("https://example.test/api/dashboard-links/pin", {
        body: "not-form-data",
        headers: {
          accept: "application/json",
          "Content-Type": "text/plain",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(resolveApiUserIdMock).toHaveBeenCalledOnce();
    expect(updateDashboardLinkPinStateMock).not.toHaveBeenCalled();
  });
});
