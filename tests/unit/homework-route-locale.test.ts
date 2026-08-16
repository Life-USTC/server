import { afterEach, describe, expect, it, vi } from "vitest";

const {
  listSectionHomeworkPageWithAuditMock,
  listSubscribedHomeworkPageMock,
  requireAuthMock,
  resolveHomeworkSectionIdsMock,
  resolveSessionUserIdMock,
} = vi.hoisted(() => ({
  listSectionHomeworkPageWithAuditMock: vi.fn(),
  listSubscribedHomeworkPageMock: vi.fn(),
  requireAuthMock: vi.fn(),
  resolveHomeworkSectionIdsMock: vi.fn(),
  resolveSessionUserIdMock: vi.fn(),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  resolveSessionUserId: resolveSessionUserIdMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedHomeworkPage: listSubscribedHomeworkPageMock,
}));

vi.mock("@/features/homeworks/server/homework-list-read-model", () => ({
  listSectionHomeworkPageWithAudit: listSectionHomeworkPageWithAuditMock,
  resolveHomeworkSectionIds: resolveHomeworkSectionIdsMock,
}));

function request(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
    },
  });
}

describe("homework REST locale 适配", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("将请求 locale 传递给公开作业列表读取", async () => {
    resolveSessionUserIdMock.mockResolvedValue("viewer-1");
    resolveHomeworkSectionIdsMock.mockResolvedValue({
      ok: true,
      sectionIds: [12],
    });
    listSectionHomeworkPageWithAuditMock.mockResolvedValue({
      auditLogs: [],
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      viewer: { userId: "viewer-1" },
    });
    const { getHomeworksRoute } = await import(
      "@/lib/api/routes/homework-list-read-route"
    );

    const response = await getHomeworksRoute(
      request("/api/community/section-homeworks?sectionId=12"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      auditLogs: [],
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      viewer: { userId: "viewer-1" },
    });
    expect(listSectionHomeworkPageWithAuditMock).toHaveBeenCalledWith({
      includeDeleted: false,
      locale: "en-us",
      pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
      sectionIds: [12],
      userId: "viewer-1",
    });

    const includeDeletedResponse = await getHomeworksRoute(
      request(
        "/api/community/section-homeworks?sectionId=12&includeDeleted=true",
      ),
    );
    expect(includeDeletedResponse.status).toBe(200);
    expect(listSectionHomeworkPageWithAuditMock).toHaveBeenLastCalledWith({
      includeDeleted: true,
      locale: "en-us",
      pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
      sectionIds: [12],
      userId: "viewer-1",
    });
  });

  it("将请求 locale 传递给已订阅作业列表读取", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    listSubscribedHomeworkPageMock.mockResolvedValue({
      data: [{ id: "homework-1" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    const { getSubscribedHomeworksRoute } = await import(
      "@/lib/api/routes/homework-subscribed-read-route"
    );

    const response = await getSubscribedHomeworksRoute(
      request("/api/workspace/homeworks"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "homework-1" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(listSubscribedHomeworkPageMock).toHaveBeenCalledWith("user-1", {
      includeEditors: true,
      locale: "en-us",
      pagination: expect.objectContaining({ page: 1, pageSize: 20 }),
    });
  });

  it("去重公开 sectionIds 并拒绝越界列表与分页", async () => {
    resolveSessionUserIdMock.mockResolvedValue(null);
    resolveHomeworkSectionIdsMock.mockImplementation(async (input) => ({
      ok: true,
      sectionIds: input.sectionIds,
    }));
    listSectionHomeworkPageWithAuditMock.mockResolvedValue({
      auditLogs: [],
      data: [],
      pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 },
      viewer: { userId: null },
    });
    const { getHomeworksRoute } = await import(
      "@/lib/api/routes/homework-list-read-route"
    );

    const accepted = await getHomeworksRoute(
      request(
        "/api/community/section-homeworks?sectionIds=12,12,13&page=2&pageSize=10",
      ),
    );
    expect(accepted.status).toBe(200);
    expect(listSectionHomeworkPageWithAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ page: 2, pageSize: 10 }),
        sectionIds: [12, 13],
      }),
    );

    const overflowIds = Array.from({ length: 51 }, (_, index) => index + 1);
    expect(
      (
        await getHomeworksRoute(
          request(
            `/api/community/section-homeworks?sectionIds=${overflowIds.join(",")}`,
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await getHomeworksRoute(
          request("/api/community/section-homeworks?sectionId=12&page=101"),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await getHomeworksRoute(
          request("/api/community/section-homeworks?sectionId=12&pageSize=51"),
        )
      ).status,
    ).toBe(400);
  });

  it("拒绝已订阅作业的越界分页", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    const { getSubscribedHomeworksRoute } = await import(
      "@/lib/api/routes/homework-subscribed-read-route"
    );

    expect(
      (
        await getSubscribedHomeworksRoute(
          request("/api/workspace/homeworks?page=101"),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await getSubscribedHomeworksRoute(
          request("/api/workspace/homeworks?pageSize=51"),
        )
      ).status,
    ).toBe(400);
    expect(listSubscribedHomeworkPageMock).not.toHaveBeenCalled();
  });
});
