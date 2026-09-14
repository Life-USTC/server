import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  readAdminFeatureIssues,
  readAdminFeatureTelemetry,
} from "@/features/admin/server/admin-experience-page-data";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const db = createTestPrisma(
  process.env.FUNCTION_OWNER_DATABASE_URL ?? process.env.DATABASE_URL,
);
const ids = Array.from({ length: 56 }, () => crypto.randomUUID());
const now = new Date("2030-01-08T12:00:00Z");
let adminId = "";
let userId = "";
const url = (query = "") =>
  new URL(`https://example.com/admin/analytics?days=7${query}`);
beforeAll(async () => {
  const marker = crypto.randomUUID();
  adminId = (
    await db.user.create({
      data: {
        email: `admin-metrics-${marker}@example.test`,
        isAdmin: true,
        name: "Metrics admin",
      },
    })
  ).id;
  userId = (
    await db.user.create({
      data: { email: `metrics-${marker}@example.test`, name: "Metrics user" },
    })
  ).id;
  await db.featureOperationEvent.createMany({
    data: ids.map((id, index) => ({
      id,
      occurredAt:
        index === 0
          ? new Date("2030-01-01T15:59:59.999Z")
          : index === 1
            ? new Date("2030-01-01T16:00:00Z")
            : index === 55
              ? new Date("2030-01-08T12:00:00.001Z")
              : new Date("2030-01-08T11:00:00Z"),
      feature: "catalog.course",
      operation: index < 3 ? "search" : "get",
      protocol: index < 3 ? "web" : "rest",
      surface: index < 3 ? "web" : "unknown",
      authMode: "session",
      userId,
      outcome: index < 3 ? "success" : index === 3 ? "unknown" : "error",
      errorClass: index < 4 ? "none" : "internal",
      durationMs: index,
    })),
  });
});
afterAll(async () => {
  await db.featureOperationEvent.deleteMany({ where: { id: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: [adminId, userId] } } });
  await disconnectTestPrisma(db);
});
describe.sequential("admin platform metrics query correctness", () => {
  it("counts each recorded event once across Shanghai day boundaries, current-day cutoff, and dimensions", async () => {
    const result = await readAdminFeatureTelemetry(adminId, url(), { now });
    expect(result.status.state).toBe("ready");
    expect(result.summary).toEqual({
      total: 54,
      errors: 51,
      rejected: 0,
      unknown: 1,
      activeUsers: 1,
    });
    expect(result.daily.reduce((sum, row) => sum + row.total, 0)).toBe(54);
    expect(result.rows.reduce((sum, row) => sum + row.total, 0)).toBe(54);
    expect(result.daily.find((row) => row.day === "2030-01-02")).toMatchObject({
      total: 1,
      operation: "search",
      protocol: "web",
    });
    expect(result.daily.some((row) => row.day === "2030-01-01")).toBe(false);
    const errors = result.rows.find((row) => row.outcome === "error");
    expect(errors?.p50WallMs).toBe(29);
    expect(errors?.p95WallMs).toBe(51.5);
  });
  it("filters feature x operation x method without changing the count definition", async () => {
    const result = await readAdminFeatureTelemetry(
      adminId,
      url("&feature=catalog.course&operation=search&protocol=web"),
      { now },
    );
    expect(result.summary.total).toBe(2);
    expect(result.summary.errors).toBe(0);
    expect(
      result.daily.every(
        (row) => row.operation === "search" && row.protocol === "web",
      ),
    ).toBe(true);
  });
  it("pages through equal timestamps without duplicates and excludes unclassified data envelopes from issues", async () => {
    const first = await readAdminFeatureIssues(
      adminId,
      url("&issue_days=7&issue_feature=catalog.course"),
      { now },
    );
    expect(first.errorsStatus.state).toBe("ready");
    expect(first.summary.total).toBe(51);
    expect(first.errorSamples).toHaveLength(50);
    expect(first.nextCursor).toBeTruthy();
    const second = await readAdminFeatureIssues(
      adminId,
      url(
        `&issue_days=7&issue_feature=catalog.course&issue_cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
      ),
      { now },
    );
    expect(second.errorSamples).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set(
        [...first.errorSamples, ...second.errorSamples].map((row) => row.id),
      ).size,
    ).toBe(51);
    expect(first.groups[0]).toMatchObject({
      count: 51,
      feature: "catalog.course",
      errorClass: "internal",
    });
    const all = await readAdminFeatureIssues(
      adminId,
      url(`&issue_days=7&issue_view=all&issue_actor=${userId}`),
      { now },
    );
    expect(all.summary.total).toBe(54);
  });
});
