import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSubscribedSectionIdsMock,
  getUserCalendarSubscriptionMock,
  getViewerContextMock,
  listSubscribedHomeworkAuditLogsMock,
  listSubscribedHomeworksMock,
  requireAuthMock,
  runCloudflareTraceSpanMock,
  withHomeworkItemStateMock,
} = vi.hoisted(() => ({
  getSubscribedSectionIdsMock: vi.fn(),
  getUserCalendarSubscriptionMock: vi.fn(),
  getViewerContextMock: vi.fn(),
  listSubscribedHomeworkAuditLogsMock: vi.fn(),
  listSubscribedHomeworksMock: vi.fn(),
  requireAuthMock: vi.fn(),
  runCloudflareTraceSpanMock: vi.fn(),
  withHomeworkItemStateMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", () => ({
  runCloudflareTraceSpan: runCloudflareTraceSpanMock,
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerContext: getViewerContextMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  getSubscribedSectionIds: getSubscribedSectionIdsMock,
  getUserCalendarSubscription: getUserCalendarSubscriptionMock,
  listSubscribedHomeworkAuditLogs: listSubscribedHomeworkAuditLogsMock,
  listSubscribedHomeworks: listSubscribedHomeworksMock,
}));

vi.mock("@/features/homeworks/server/homework-item-state", () => ({
  withHomeworkItemState: withHomeworkItemStateMock,
}));

describe("workspace route tracing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
  });

  it("separates subscribed-homework reads without trace attributes", async () => {
    getViewerContextMock.mockResolvedValue({ userId: "user-1" });
    getSubscribedSectionIdsMock.mockResolvedValue([12]);
    listSubscribedHomeworksMock.mockResolvedValue([{ id: "homework-1" }]);
    listSubscribedHomeworkAuditLogsMock.mockResolvedValue([]);
    withHomeworkItemStateMock.mockResolvedValue([{ id: "homework-1" }]);
    const { getSubscribedHomeworksRoute } = await import(
      "@/lib/api/routes/homework-subscribed-read-route"
    );

    const response = await getSubscribedHomeworksRoute(
      new Request("https://example.test/api/workspace/homeworks"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      auditLogs: [],
      homeworks: [{ id: "homework-1" }],
      sectionIds: [12],
      viewer: { userId: "user-1" },
    });
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["workspace.homeworks.auth", {}],
      ["workspace.homeworks.viewer", {}],
      ["workspace.homeworks.section_ids", {}],
      ["workspace.homeworks.read", {}],
      ["workspace.homeworks.audit", {}],
      ["workspace.homeworks.item_state", {}],
    ]);
  });

  it("separates current-subscription auth from its read", async () => {
    const subscription = { id: "subscription-1" };
    getUserCalendarSubscriptionMock.mockResolvedValue(subscription);
    const { getCurrentCalendarSubscriptionRoute } = await import(
      "@/lib/api/routes/calendar-subscriptions"
    );

    const response = await getCurrentCalendarSubscriptionRoute(
      new Request("https://example.test/api/workspace/subscriptions/current"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ subscription });
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["workspace.subscriptions.current.auth", {}],
      ["workspace.subscriptions.current.read", {}],
    ]);
  });
});
