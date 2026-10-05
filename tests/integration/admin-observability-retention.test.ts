import { expect, vi } from "vitest";
import { readPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-data";
import { renderPrometheusMetrics } from "@/features/admin/server/prometheus-metrics-render";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { collectFeatureEvent } from "@/lib/db/observability-context";
import { recordFeatureOperation } from "@/lib/metrics/feature-operation";
import { observabilityTest as it } from "../shared/observability-fixture";

const context = {
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "unknown",
} as const;

// This file owns one console spy scope; other cases run in isolated modules.
it("admin.feature-experience-retention", { tags: ["@Admin/Service"] }, async ({
  observation,
}) => {
  await observation.runtime(async () => {
    const { db, capture, maintenance } = observation;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const id = crypto.randomUUID();
      const businessResult = await capture(() => {
        for (let index = 0; index < 300; index++)
          recordFeatureOperation(
            { ...context, requestId: id },
            { outcome: "success", errorClass: "none" },
            1,
          );
        return "business-success";
      });
      expect(businessResult).toBe("business-success");
      expect(
        await db.featureOperationEvent.count({ where: { requestId: id } }),
      ).toBe(256);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"limit":256'));
      const failedId = crypto.randomUUID();
      expect(
        await capture(() => {
          collectFeatureEvent({
            ...context,
            id: crypto.randomUUID(),
            requestId: failedId,
            feature: "invalid-feature",
            outcome: "success",
            errorClass: "none",
            durationMs: 1,
          });
          return "still-success";
        }),
      ).toBe("still-success");
      expect(
        await db.featureOperationEvent.count({
          where: { requestId: failedId },
        }),
      ).toBe(0);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("observability.write-failed"),
      );

      const now = new Date();
      const old = new Date(now.getTime() - 91 * 86400000);
      const retained = new Date(now.getTime() - 89 * 86400000);
      const retentionIds: string[] = [];
      for (const occurredAt of [old, old, retained]) {
        const featureId = crypto.randomUUID();
        const issueId = crypto.randomUUID();
        retentionIds.push(featureId, issueId);
        await writeObservabilityBatch({
          features: [
            {
              ...context,
              id: featureId,
              occurredAt,
              outcome: "success",
              errorClass: "none",
              durationMs: 1,
            },
          ],
          issues: [
            {
              id: issueId,
              occurredAt,
              level: "warn",
              event: "page.request.error",
            },
          ],
        });
      }
      for (let batch = 0; batch < 2; batch++) {
        const [report] = await maintenance.$queryRaw<
          Array<{ feature_rows_deleted: bigint; issue_rows_deleted: bigint }>
        >`SELECT * FROM public.maintain_observability_event_retention(${now}, ${1})`;
        expect(report).toEqual({
          feature_rows_deleted: 1n,
          issue_rows_deleted: 1n,
        });
      }
      expect(
        await db.featureOperationEvent.count({
          where: { id: { in: retentionIds } },
        }),
      ).toBe(1);
      expect(
        await db.runtimeIssueEvent.count({
          where: { id: { in: retentionIds } },
        }),
      ).toBe(1);
      const snapshot = await readPrometheusMetrics();
      const text = renderPrometheusMetrics({
        ...snapshot,
        firstFeatureRecordedAt: null,
        users: snapshot.users.map((row) => ({ ...row, activeUsers: null })),
        featureActivity: [],
      });
      expect(text).toContain("life_ustc_feature_observation_available 0");
      expect(text).not.toMatch(/^life_ustc_active_users\{/m);
    } finally {
      warn.mockRestore();
    }
  });
});
