import { afterEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, putStorageObjectMock, requireAuthMock } = vi.hoisted(
  () => ({
    findUniqueMock: vi.fn(),
    putStorageObjectMock: vi.fn(),
    requireAuthMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    uploadPending: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  putStorageObject: putStorageObjectMock,
}));

function uploadRequest(input: {
  body?: string;
  contentLength?: string;
  key?: string;
}) {
  const key = input.key ?? "uploads/user-1/test.txt";
  const headers = new Headers({ "Content-Type": "text/plain" });
  if (input.contentLength != null) {
    headers.set("Content-Length", input.contentLength);
  }

  return new Request(`https://example.test/api/uploads/object?key=${key}`, {
    body: input.body ?? "ok",
    headers,
    method: "PUT",
  });
}

describe("putUploadObjectRoute", () => {
  afterEach(() => {
    findUniqueMock.mockReset();
    putStorageObjectMock.mockReset();
    requireAuthMock.mockReset();
    vi.resetModules();
  });

  it("requires content length before writing to R2", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    const { putUploadObjectRoute } = await import(
      "@/lib/api/routes/upload-object-put-route"
    );

    const response = await putUploadObjectRoute(uploadRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing content length",
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(putStorageObjectMock).not.toHaveBeenCalled();
  });

  it("rejects keys outside the authenticated user's upload prefix", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    const { putUploadObjectRoute } = await import(
      "@/lib/api/routes/upload-object-put-route"
    );

    const response = await putUploadObjectRoute(
      uploadRequest({
        contentLength: "2",
        key: "uploads/user-2/test.txt",
      }),
    );

    expect(response.status).toBe(403);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(putStorageObjectMock).not.toHaveBeenCalled();
  });

  it("rejects expired upload sessions", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(Date.now() - 1_000),
      size: 2,
      userId: "user-1",
    });
    const { putUploadObjectRoute } = await import(
      "@/lib/api/routes/upload-object-put-route"
    );

    const response = await putUploadObjectRoute(
      uploadRequest({ contentLength: "2" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Upload session expired",
    });
    expect(putStorageObjectMock).not.toHaveBeenCalled();
  });

  it("rejects bodies larger than the pending reservation", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(Date.now() + 60_000),
      size: 1,
      userId: "user-1",
    });
    const { putUploadObjectRoute } = await import(
      "@/lib/api/routes/upload-object-put-route"
    );

    const response = await putUploadObjectRoute(
      uploadRequest({ contentLength: "2" }),
    );

    expect(response.status).toBe(413);
    expect(putStorageObjectMock).not.toHaveBeenCalled();
  });

  it("writes a valid pending upload to R2", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(Date.now() + 60_000),
      size: 2,
      userId: "user-1",
    });
    putStorageObjectMock.mockResolvedValue(undefined);
    const { putUploadObjectRoute } = await import(
      "@/lib/api/routes/upload-object-put-route"
    );

    const request = uploadRequest({ contentLength: "2" });
    const response = await putUploadObjectRoute(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(putStorageObjectMock).toHaveBeenCalledWith({
      body: request.body,
      contentType: "text/plain",
      key: "uploads/user-1/test.txt",
    });
  });
});
