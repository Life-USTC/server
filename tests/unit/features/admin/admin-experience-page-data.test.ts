import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminExperienceAggregateQuery,
  buildAdminExperienceErrorQuery,
  buildAdminExperienceWindow,
  getAdminExperiencePage,
  parseAdminExperienceAggregateRows,
  parseAdminExperienceErrorRows,
  parseAdminExperienceFilters,
} from "@/features/admin/server/admin-experience-page-data";
import type { CloudflareAnalyticsReadPort } from "@/lib/ports/analytics";

const requireAdminPageMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/admin/server/admin-page-auth", () => ({
  requireAdminPage: requireAdminPageMock,
}));

function requestUrl(query = "") {
  return new URL(`https://life.example/admin/experience${query}`);
}

describe("admin feature experience read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminPageMock.mockResolvedValue({ id: "admin-1" });
  });

  it("uses completed Shanghai days and converts their boundaries to UTC SQL time", () => {
    const window = buildAdminExperienceWindow(
      7,
      new Date("2026-09-14T15:30:00.000Z"),
    );

    expect(window).toEqual({
      days: 7,
      fromDay: "2026-09-07",
      toDay: "2026-09-14",
      fromTimestamp: "2026-09-06 16:00:00",
      toTimestamp: "2026-09-13 16:00:00",
      nowTimestamp: "2026-09-14 15:30:00",
    });
  });

  it("builds one grouped query with weighted counts and weighted percentiles", () => {
    const window = buildAdminExperienceWindow(
      30,
      new Date("2026-09-14T02:00:00.000Z"),
    );
    const query = buildAdminExperienceAggregateQuery(
      {
        feature: "catalog.search",
        operation: "query",
        protocol: "rest",
        surface: "web",
      },
      window,
    );

    expect(query).toContain("FROM life_ustc_runtime");
    expect(query).toContain("blob1 = 'feature_operation_v1'");
    expect(query).toContain("sum(_sample_interval) AS total");
    expect(query).toContain(
      "quantileExactWeighted(0.50)(double1, _sample_interval)",
    );
    expect(query).toContain(
      "quantileExactWeighted(0.95)(double1, _sample_interval)",
    );
    expect(query).toContain(
      "GROUP BY blob2, blob3, blob4, blob5, blob6, blob7",
    );
    expect(query).toContain("LIMIT 501");
    expect(query).not.toContain("COUNT(");
  });

  it("rejects an operation filter that could alter SQL", () => {
    const filters = parseAdminExperienceFilters(
      requestUrl(
        "?operation=query%27%20OR%201%3D1%20--&feature=catalog.search",
      ),
    );
    const query = buildAdminExperienceAggregateQuery(
      filters,
      buildAdminExperienceWindow(7, new Date("2026-09-14T00:00:00+08:00")),
    );

    expect(filters.operation).toBeUndefined();
    expect(query).not.toContain("OR 1=1");
    expect(query).toContain("blob2 = 'catalog.search'");
  });

  it("strictly accepts finite weighted metrics and rejects unbounded values", () => {
    const rows = parseAdminExperienceAggregateRows([
      {
        auth_mode: "session",
        error_count: "4",
        feature: "catalog.search",
        operation: "query",
        outcome: "error",
        p50_wall_ms: "12.5",
        p95_wall_ms: 42,
        protocol: "web",
        rejected_count: 0,
        surface: "web",
        total: 4,
        unknown_count: 0,
      },
    ]);

    expect(rows[0]).toMatchObject({ total: 4, errorCount: 4, p50WallMs: 12.5 });
    expect(() =>
      parseAdminExperienceAggregateRows([
        {
          auth_mode: "session",
          error_count: 0,
          feature: "catalog.search",
          operation: "query",
          outcome: "success",
          p50_wall_ms: null,
          p95_wall_ms: null,
          protocol: "web",
          rejected_count: 0,
          surface: "web",
          total: Number.POSITIVE_INFINITY,
          unknown_count: 0,
        },
      ]),
    ).toThrow();
  });

  it("rejects an aggregate response that reaches the bounded query sentinel", () => {
    const row = {
      auth_mode: "session",
      error_count: 0,
      feature: "catalog.search",
      operation: "query",
      outcome: "success",
      p50_wall_ms: null,
      p95_wall_ms: null,
      protocol: "web",
      rejected_count: 0,
      surface: "web",
      total: 1,
      unknown_count: 0,
    };
    expect(() =>
      parseAdminExperienceAggregateRows(Array.from({ length: 501 }, () => row)),
    ).toThrow(/too many aggregate rows/i);
  });

  it("authenticates before reading, distinguishes empty telemetry, and only drills into errors explicitly", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const port: CloudflareAnalyticsReadPort = { query };

    const empty = await getAdminExperiencePage(
      new Request("https://life.example/admin/experience"),
      requestUrl(),
      { now: new Date("2026-09-14T00:00:00+08:00"), readPort: port },
    );

    expect(requireAdminPageMock).toHaveBeenCalledTimes(1);
    expect(empty.status).toEqual({ state: "empty" });
    expect(query).toHaveBeenCalledTimes(1);

    query.mockResolvedValueOnce([
      {
        auth_mode: "anonymous",
        error_count: 0,
        feature: "catalog.search",
        operation: "query",
        outcome: "success",
        p50_wall_ms: 4,
        p95_wall_ms: 8,
        protocol: "web",
        rejected_count: 0,
        surface: "web",
        total: 1,
        unknown_count: 0,
      },
    ]);
    query.mockResolvedValueOnce([
      {
        auth_mode: "anonymous",
        error_class: "internal",
        feature: "catalog.search",
        occurred_at: "2026-09-13T16:00:00.000Z",
        operation: "query",
        outcome: "error",
        protocol: "web",
        request_id: "req_123",
        surface: "web",
      },
    ]);

    const withErrors = await getAdminExperiencePage(
      new Request("https://life.example/admin/experience"),
      requestUrl("?errors=1"),
      { now: new Date("2026-09-14T00:00:00+08:00"), readPort: port },
    );
    expect(withErrors.showErrors).toBe(true);
    expect(withErrors.errorSamples[0]?.requestId).toBe("req_123");
    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[2]?.[0])).toContain("LIMIT 21");
  });

  it("queries current issue samples even when completed-day usage is empty", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          auth_mode: "unknown",
          error_class: "unknown",
          feature: "workspace.overview",
          occurred_at: "2026-09-14T00:05:00.000Z",
          operation: "load",
          outcome: "unknown",
          protocol: "mcp",
          request_id: "req_unknown",
          surface: "unknown",
        },
      ]);
    const result = await getAdminExperiencePage(
      new Request("https://life.example/admin/experience"),
      requestUrl("?errors=1"),
      { now: new Date("2026-09-14T00:10:00.000Z"), readPort: { query } },
    );

    expect(result.status).toEqual({ state: "empty" });
    expect(result.errorsStatus).toEqual({ state: "ready" });
    expect(result.errorSamples[0]).toMatchObject({
      outcome: "unknown",
      requestId: "req_unknown",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("marks malformed rows unavailable instead of presenting unsupported values", async () => {
    const port: CloudflareAnalyticsReadPort = {
      query: vi.fn().mockResolvedValue([
        {
          auth_mode: "session",
          error_count: 0,
          feature: "catalog.search",
          operation: "query",
          outcome: "success",
          p50_wall_ms: null,
          p95_wall_ms: null,
          protocol: "web",
          rejected_count: 0,
          surface: "not-a-surface",
          total: 1,
          unknown_count: 0,
        },
      ]),
    };
    const result = await getAdminExperiencePage(
      new Request("https://life.example/admin/experience"),
      requestUrl(),
      { readPort: port },
    );
    expect(result.status).toEqual({
      state: "unavailable",
      reason: "query_failed",
    });
    expect(result.rows).toEqual([]);
  });

  it("keeps the recent error query bounded and scoped to safe fields", () => {
    const query = buildAdminExperienceErrorQuery(
      { feature: "catalog.search", outcome: "error" },
      buildAdminExperienceWindow(7, new Date("2026-09-14T23:30:00+08:00")),
    );
    expect(query).toContain("blob7 IN ('rejected', 'error', 'unknown')");
    expect(query).toContain("blob9 != ''");
    expect(query).toContain("LIMIT 21");
    expect(query).toContain("blob8 != 'none'");
    expect(query).toContain("timestamp < toDateTime('2026-09-14 15:30:00')");
    expect(query).not.toContain("exception");
    expect(query).not.toContain("stack");
  });
});

it.each([null, undefined, true, false, "", " ", "NaN", -1, 1.5])(
  "never turns invalid weighted counts into zero (%s)",
  (total) => {
    expect(() =>
      parseAdminExperienceAggregateRows([
        {
          auth_mode: "anonymous",
          feature: "catalog.course",
          operation: "list",
          protocol: "rest",
          surface: "unknown",
          outcome: "success",
          total,
          error_count: 0,
          rejected_count: 0,
          unknown_count: 0,
          p50_wall_ms: 1,
          p95_wall_ms: 2,
        },
      ]),
    ).toThrow();
  },
);

it("interprets SQL issue timestamps as UTC", () => {
  const row = {
    auth_mode: "anonymous",
    feature: "catalog.course",
    operation: "list",
    protocol: "rest",
    surface: "unknown",
    outcome: "error",
    error_class: "internal",
    request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    occurred_at: "2026-09-14 01:23:45",
  };
  expect(parseAdminExperienceErrorRows([row])[0].occurredAt).toBe(
    "2026-09-14T01:23:45.000Z",
  );
});

it("rejects inconsistent counts and inverted percentiles", () => {
  const row = {
    auth_mode: "anonymous",
    feature: "catalog.course",
    operation: "list",
    protocol: "rest",
    surface: "unknown",
    outcome: "error",
    total: 4,
    error_count: 2,
    rejected_count: 0,
    unknown_count: 0,
    p50_wall_ms: 1,
    p95_wall_ms: 2,
  };
  expect(() => parseAdminExperienceAggregateRows([row])).toThrow(
    /inconsistent/,
  );
  expect(() =>
    parseAdminExperienceAggregateRows([
      { ...row, error_count: 4, p50_wall_ms: 10 },
    ]),
  ).toThrow(/inconsistent/);
});

it("flags capped issue samples while retaining the most recent twenty", async () => {
  requireAdminPageMock.mockResolvedValue({ id: "admin" });
  const row = {
    auth_mode: "anonymous",
    feature: "catalog.course",
    operation: "list",
    protocol: "rest",
    surface: "unknown",
    outcome: "error",
    error_class: "internal",
    request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    occurred_at: "2026-09-14 01:23:45",
  };
  const query = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(Array.from({ length: 21 }, () => row));
  const result = await getAdminExperiencePage(
    new Request(requestUrl("?errors=1")),
    requestUrl("?errors=1"),
    { readPort: { query } },
  );
  expect(result.errorSamples).toHaveLength(20);
  expect(result.errorsTruncated).toBe(true);
  expect(result.errorsStatus.state).toBe("ready");
});
