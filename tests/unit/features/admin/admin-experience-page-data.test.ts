import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, withContext } = vi.hoisted(() => ({
  query: vi.fn(),
  withContext: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ withUserDbContext: withContext }));
vi.mock("@/lib/db/auth-prisma", () => ({ authPrisma: {} }));

import { encodeAdminAuditCursor } from "@/features/admin/server/admin-audit-page-data";
import {
  buildAdminExperienceWindow,
  featureEventWhere,
  parseAdminExperienceFilters,
  readAdminFeatureIssues,
  readAdminFeatureTelemetry,
} from "@/features/admin/server/admin-experience-page-data";

const now = new Date("2026-09-14T15:30:00Z");
const url = (query = "") =>
  new URL(`https://example.com/admin/analytics${query}`);
beforeEach(() => {
  vi.clearAllMocks();
  withContext.mockImplementation((_id, fn) => fn({ $queryRaw: query }));
  query.mockResolvedValue([]);
});
describe("platform feature metrics", () => {
  it("uses 7 Shanghai days including partial today and a bounded read time", () => {
    expect(buildAdminExperienceWindow(7, now)).toEqual({
      days: 7,
      fromDay: "2026-09-08",
      toDay: "2026-09-15",
      fromTimestamp: "2026-09-07T16:00:00.000Z",
      toTimestamp: now.toISOString(),
      nowTimestamp: now.toISOString(),
    });
  });
  it("rejects unknown dimension values and binds accepted filters as SQL parameters", () => {
    const filters = parseAdminExperienceFilters(
      url(
        "?feature=catalog.course&operation=search&protocol=rest&outcome=oops&surface=cli&authMode=sql%27",
      ),
    );
    expect(filters).toEqual({
      feature: "catalog.course",
      operation: "search",
      protocol: "rest",
      outcome: undefined,
      surface: undefined,
      authMode: undefined,
    });
    const where = featureEventWhere(
      filters,
      buildAdminExperienceWindow(7, now),
    );
    expect(where.text).not.toContain("catalog.course");
    expect(where.values).toContain("catalog.course");
  });
  it("queries under the verified admin context without any external analytics credentials", async () => {
    const result = await readAdminFeatureTelemetry("admin", url(), { now });
    expect(withContext).toHaveBeenCalledWith("admin", expect.any(Function));
    expect(result.status.state).toBe("empty");
    expect(result.coverage.sampling).toBe("recorded");
    expect(result.coverage.firstRecordedAt).toBeNull();
    const text = query.mock.calls.map(([sql]) => sql.text).join("\n");
    expect(text).toContain('public."FeatureOperationEvent"');
    expect(text).toContain('count(DISTINCT "userId")');
    expect(text).toContain("percentile_cont");
    expect(text).not.toContain("_sample_interval");
  });
  it("does not replace a database failure with a false zero", async () => {
    query.mockRejectedValue(new Error("private db detail"));
    const result = await readAdminFeatureTelemetry("admin", url(), { now });
    expect(result.status).toEqual({
      state: "unavailable",
      reason: "query_failed",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });
  it("keeps audit filters separate and paginates operation events deterministically", async () => {
    const cursor = encodeAdminAuditCursor({
      createdAt: now,
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    const result = await readAdminFeatureIssues(
      "admin",
      url(
        `?outcome=denied&actor=unrelated&issue_outcome=error&issue_feature=catalog.course&issue_view=all&issue_actor=known-user&issue_cursor=${cursor}`,
      ),
      { now },
    );
    expect(result.filters).toMatchObject({
      outcome: "error",
      actor: "known-user",
      feature: "catalog.course",
    });
    expect(result.view).toBe("all");
    const first = query.mock.calls[0][0];
    expect(first.text).toContain('("occurredAt",id) <');
    expect(first.text).toContain('ORDER BY "occurredAt" DESC,id DESC');
    expect(first.values).toContain("known-user");
    expect(first.values).not.toContain("denied");
  });
  it("keeps unknown page envelopes out of the default issues view", async () => {
    await readAdminFeatureIssues("admin", url(), { now });
    expect(query.mock.calls[0][0].text).toContain("\"errorClass\" <> 'none'");
  });
});
