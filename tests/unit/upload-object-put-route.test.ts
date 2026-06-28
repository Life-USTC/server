import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteStorageObjectMock,
  findUniqueMock,
  headStorageObjectMock,
  putStorageObjectMock,
  requireWriteAuthMock,
} = vi.hoisted(() => ({
  deleteStorageObjectMock: vi.fn(),
  findUniqueMock: vi.fn(),
  headStorageObjectMock: vi.fn(),
  putStorageObjectMock: vi.fn(),
  requireWriteAuthMock: vi.fn(),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireWriteAuth: requireWriteAuthMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    uploadPending: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/storage/r2-object", () => ({
  deleteStorageObject: deleteStorageObjectMock,
  headStorageObject: headStorageObjectMock,
  putStorageObject: putStorageObjectMock,
}));

const FIXED_NOW = new Date("2026-01-15T00:00:00.000Z");

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    deleteStorageObjectMock.mockReset();
    findUniqueMock.mockReset();
    headStorageObjectMock.mockReset();
    putStorageObjectMock.mockReset();
    requireWriteAuthMock.mockReset();
    vi.resetModules();
  });

  it("写入 R2 前要求 Content-Length", async () => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
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

  it("拒绝超出认证用户上传前缀的 key", async () => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
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

  it("拒绝过期的上传会话", async () => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(FIXED_NOW.getTime() - 1_000),
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

  it("拒绝超过待处理预留大小的请求体", async () => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
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

  it("将有效的待处理上传写入 R2", async () => {
    requireWriteAuthMock.mockResolvedValue({ userId: "user-1" });
    findUniqueMock.mockResolvedValue({
      contentType: "text/plain",
      expiresAt: new Date(FIXED_NOW.getTime() + 60_000),
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
