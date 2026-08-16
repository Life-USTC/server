import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCompactOverviewMock,
  getUserCalendarSubscriptionMock,
  listSubscribedHomeworkPageMock,
  requireAuthMock,
  runCloudflareTraceSpanMock,
} = vi.hoisted(() => ({
  getCompactOverviewMock: vi.fn(),
  getUserCalendarSubscriptionMock: vi.fn(),
  listSubscribedHomeworkPageMock: vi.fn(),
  requireAuthMock: vi.fn(),
  runCloudflareTraceSpanMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/adapters/cloudflare-runtime")>();
  return {
    ...actual,
    runCloudflareTraceSpan: runCloudflareTraceSpanMock,
  };
});

vi.mock("@/lib/metrics/analytics-engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/metrics/analytics-engine")>();
  return {
    ...actual,
    writeWorkspaceRouteStageAnalytics: vi.fn(),
  };
});

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  getUserCalendarSubscription: getUserCalendarSubscriptionMock,
  listSubscribedHomeworkPage: listSubscribedHomeworkPageMock,
}));

vi.mock("@/features/dashboard/server/compact-overview-read-model", () => ({
  getCompactOverview: getCompactOverviewMock,
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
    listSubscribedHomeworkPageMock.mockResolvedValue({
      data: [{ id: "homework-1" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    const { getSubscribedHomeworksRoute } = await import(
      "@/lib/api/routes/homework-subscribed-read-route"
    );

    const response = await getSubscribedHomeworksRoute(
      new Request("https://example.test/api/workspace/homeworks"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "homework-1" }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["workspace.homeworks.auth", {}],
      ["workspace.homeworks.read", {}],
      ["response.serialize", { "response.format": "json" }],
    ]);
  });

  it("separates current-subscription auth from its read", async () => {
    const subscription = {
      userId: "user-1",
      sections: [],
      note: "Subscribe to this URL in a calendar client.",
    };
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
      ["response.serialize", { "response.format": "json" }],
    ]);
  });

  it("separates overview auth from its read without trace attributes", async () => {
    const overview = { user: { userId: "user-1" } };
    getCompactOverviewMock.mockResolvedValue(overview);
    const { getMyCompactOverviewRoute } = await import(
      "@/lib/api/routes/me-overview-route"
    );

    const response = await getMyCompactOverviewRoute(
      new Request("https://example.test/api/workspace/overview"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(overview);
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["workspace.overview.auth", {}],
      ["workspace.overview.read", {}],
      ["response.serialize", { "response.format": "json" }],
    ]);
  });
});
