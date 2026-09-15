import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewerContextMock, queryRawMock, withUserDbContextMock } =
  vi.hoisted(() => ({
    getViewerContextMock: vi.fn(),
    queryRawMock: vi.fn(),
    withUserDbContextMock: vi.fn(),
  }));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
  withUserDbContext: withUserDbContextMock,
}));

import { findDownloadableUpload } from "@/features/uploads/server/upload-service";

const downloadableUpload = {
  contentType: "text/plain",
  filename: "note.txt",
  key: "uploads/owner/upload.txt",
  userId: "owner",
};

describe("上传下载 RLS 边界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getViewerContextMock.mockResolvedValue({ isAuthenticated: true });
    withUserDbContextMock.mockImplementation((_userId, action) =>
      action({ $queryRaw: queryRawMock }),
    );
  });

  it("只通过当前 viewer 上下文调用窄下载函数", async () => {
    queryRawMock.mockResolvedValue([downloadableUpload]);

    await expect(findDownloadableUpload("upload-1", "viewer")).resolves.toEqual(
      downloadableUpload,
    );

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "viewer",
      expect.any(Function),
    );
    expect(queryRawMock).toHaveBeenCalledOnce();
    const [query] = queryRawMock.mock.calls[0] as [
      { sql: string; values: unknown[] },
    ];
    expect(query.sql).toContain("public.find_downloadable_upload(");
    expect(query.values).toEqual(["upload-1"]);
    expect(query.sql).not.toContain('FROM public."Upload"');
  });

  it("数据库函数隐藏不可下载的记录", async () => {
    queryRawMock.mockResolvedValue([]);

    await expect(
      findDownloadableUpload("upload-1", "viewer"),
    ).resolves.toBeNull();
  });

  it("未认证 viewer 不进入 SECURITY DEFINER 边界", async () => {
    getViewerContextMock.mockResolvedValue({ isAuthenticated: false });

    await expect(
      findDownloadableUpload("upload-1", "viewer"),
    ).resolves.toBeNull();
    expect(withUserDbContextMock).not.toHaveBeenCalled();
    expect(queryRawMock).not.toHaveBeenCalled();
  });
});
