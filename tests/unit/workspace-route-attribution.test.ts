import { afterEach, describe, expect, it, vi } from "vitest";
import { setApiRequestObservabilityContext } from "@/lib/log/api-observability";

const {
  logAppEventMock,
  runCloudflareTraceSpanMock,
  writeWorkspaceRouteStageAnalyticsMock,
} = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
  runCloudflareTraceSpanMock: vi.fn(),
  writeWorkspaceRouteStageAnalyticsMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/adapters/cloudflare-runtime")>();
  return {
    ...actual,
    runCloudflareTraceSpan: runCloudflareTraceSpanMock,
  };
});

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

vi.mock("@/lib/metrics/analytics-engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/metrics/analytics-engine")>();
  return {
    ...actual,
    writeWorkspaceRouteStageAnalytics: writeWorkspaceRouteStageAnalyticsMock,
  };
});

describe("workspace route attribution", () => {
  beforeEach(() => {
    writeWorkspaceRouteStageAnalyticsMock.mockClear();
    logAppEventMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("writes unsampled Analytics Engine datapoints for each stage", async () => {
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
    const { runWorkspaceRouteStage } = await import(
      "@/lib/log/workspace-route-attribution"
    );

    await runWorkspaceRouteStage("homeworks", "auth", {}, async () => "ok");

    expect(writeWorkspaceRouteStageAnalyticsMock).toHaveBeenCalledWith({
      ioObservedDurationMs: expect.any(Number),
      route: "homeworks",
      stage: "auth",
      status: "success",
    });
    expect(runCloudflareTraceSpanMock).toHaveBeenCalledWith(
      "workspace.homeworks.auth",
      {},
      expect.any(Function),
    );
  });

  it("uses subscriptions route trace names", async () => {
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
    const { runWorkspaceRouteStage } = await import(
      "@/lib/log/workspace-route-attribution"
    );

    await runWorkspaceRouteStage(
      "subscriptions_current",
      "read",
      {},
      async () => null,
    );

    expect(runCloudflareTraceSpanMock).toHaveBeenCalledWith(
      "workspace.subscriptions.current.read",
      {},
      expect.any(Function),
    );
    expect(writeWorkspaceRouteStageAnalyticsMock).toHaveBeenCalledWith({
      ioObservedDurationMs: expect.any(Number),
      route: "subscriptions_current",
      stage: "read",
      status: "success",
    });
  });

  it("samples successful stage logs at 25% in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
    const { runWorkspaceRouteStage } = await import(
      "@/lib/log/workspace-route-attribution"
    );

    let expectedLogCount = 0;
    for (let index = 0; index < 8; index += 1) {
      const requestId = `request-${index}`;
      let hash = 0;
      for (let charIndex = 0; charIndex < requestId.length; charIndex += 1) {
        hash = (hash * 31 + requestId.charCodeAt(charIndex)) >>> 0;
      }
      if (hash % 4 === 0) expectedLogCount += 1;

      const request = new Request(
        "https://example.test/api/workspace/homeworks",
      );
      setApiRequestObservabilityContext(request, {
        requestId,
        startMs: Date.now(),
      });
      await runWorkspaceRouteStage(
        "homeworks",
        "viewer",
        { request },
        async () => "ok",
      );
    }

    expect(
      logAppEventMock.mock.calls.filter(
        ([, message]) => message === "workspace.route.stage",
      ),
    ).toHaveLength(expectedLogCount);
    expect(writeWorkspaceRouteStageAnalyticsMock).toHaveBeenCalledTimes(8);
  });

  it("always logs slow stages in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) => {
        vi.advanceTimersByTime(1_200);
        return callback();
      },
    );
    const request = new Request(
      "https://example.test/api/workspace/subscriptions/current",
    );
    setApiRequestObservabilityContext(request, {
      requestId: "slow-request",
      startMs: Date.now(),
    });
    const { runWorkspaceRouteStage } = await import(
      "@/lib/log/workspace-route-attribution"
    );

    await runWorkspaceRouteStage(
      "subscriptions_current",
      "auth",
      { request },
      async () => "ok",
    );

    expect(logAppEventMock).toHaveBeenCalledWith(
      "info",
      "workspace.route.stage",
      expect.objectContaining({
        ioObservedDurationMs: 1_200,
        requestId: "slow-request",
        route: "subscriptions_current",
        stage: "auth",
        status: "success",
      }),
    );
  });

  it("records db_context only while route attribution is active", async () => {
    writeWorkspaceRouteStageAnalyticsMock.mockClear();
    const { recordWorkspaceRouteDbContext, runWithWorkspaceRouteAttribution } =
      await import("@/lib/log/workspace-route-attribution");

    recordWorkspaceRouteDbContext(42);
    expect(writeWorkspaceRouteStageAnalyticsMock).not.toHaveBeenCalled();

    const request = new Request("https://example.test/api/workspace/homeworks");
    setApiRequestObservabilityContext(request, {
      requestId: "db-context-request",
      startMs: Date.now(),
    });
    await runWithWorkspaceRouteAttribution("homeworks", request, async () => {
      recordWorkspaceRouteDbContext(42);
    });

    expect(writeWorkspaceRouteStageAnalyticsMock).toHaveBeenCalledWith({
      ioObservedDurationMs: 42,
      route: "homeworks",
      stage: "db_context",
      status: "success",
    });
  });
});
