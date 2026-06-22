import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getSubscribedSectionIdsMock,
  getViewerContextMock,
  listSectionHomeworksWithAuditMock,
  listSubscribedHomeworkAuditLogsMock,
  listSubscribedHomeworksMock,
  requireAuthMock,
  resolveApiUserIdMock,
  withHomeworkItemStateMock,
} = vi.hoisted(() => ({
  getSubscribedSectionIdsMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  listSectionHomeworksWithAuditMock: vi.fn(),
  listSubscribedHomeworkAuditLogsMock: vi.fn(),
  listSubscribedHomeworksMock: vi.fn(),
  requireAuthMock: vi.fn(),
  resolveApiUserIdMock: vi.fn(),
  withHomeworkItemStateMock: vi.fn(async (homeworks: unknown) => homeworks),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  resolveApiUserId: resolveApiUserIdMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/features/home/server/subscription-read-model", () => ({
  getSubscribedSectionIds: getSubscribedSectionIdsMock,
  listSubscribedHomeworkAuditLogs: listSubscribedHomeworkAuditLogsMock,
  listSubscribedHomeworks: listSubscribedHomeworksMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", () => ({
  withHomeworkItemState: withHomeworkItemStateMock,
}));

vi.mock("@/features/homeworks/server/homework-list-read-model", () => ({
  listSectionHomeworksWithAudit: listSectionHomeworksWithAuditMock,
}));

function request(path: string) {
  return new Request(`https://example.test${path}`, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
    },
  });
}

describe("homework REST locale adapters", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("passes request locale to public homework list reads", async () => {
    resolveApiUserIdMock.mockResolvedValue("viewer-1");
    listSectionHomeworksWithAuditMock.mockResolvedValue({
      auditLogs: [],
      homeworks: [],
      viewer: { userId: "viewer-1" },
    });
    const { getHomeworksRoute } = await import(
      "@/lib/api/routes/homework-list-read-route"
    );

    const response = await getHomeworksRoute(
      request("/api/homeworks?sectionId=12"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      auditLogs: [],
      homeworks: [],
      viewer: { userId: "viewer-1" },
    });
    expect(listSectionHomeworksWithAuditMock).toHaveBeenCalledWith({
      includeDeleted: false,
      locale: "en-us",
      sectionIds: [12],
      userId: "viewer-1",
    });
  });

  it("passes request locale to subscribed homework list reads", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    getViewerContextMock.mockResolvedValue({ userId: "user-1" });
    getSubscribedSectionIdsMock.mockResolvedValue([12]);
    listSubscribedHomeworksMock.mockResolvedValue([{ id: "homework-1" }]);
    listSubscribedHomeworkAuditLogsMock.mockResolvedValue([]);
    const { getSubscribedHomeworksRoute } = await import(
      "@/lib/api/routes/homework-subscribed-read-route"
    );

    const response = await getSubscribedHomeworksRoute(
      request("/api/me/subscriptions/homeworks"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      auditLogs: [],
      homeworks: [{ id: "homework-1" }],
      sectionIds: [12],
      viewer: { userId: "user-1" },
    });
    expect(listSubscribedHomeworksMock).toHaveBeenCalledWith("user-1", {
      includeEditors: true,
      locale: "en-us",
      sectionIds: [12],
    });
  });
});
