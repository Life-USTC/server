import { expect } from "vitest";
import { writeObservabilityBatch } from "@/lib/db/feature-event-store";
import { identifyObservedUser } from "@/lib/db/observability-context";
import { recordFeatureOperation } from "@/lib/metrics/feature-operation";
import { observabilityTest as it } from "../shared/observability-fixture";

const context = {
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "unknown",
} as const;

it("admin.feature-experience-telemetry", { tags: ["@Admin/Service"] }, async ({
  observation,
}) => {
  const { db, capture, userId } = observation;
  await observation.runtime(async () => {
    const id = crypto.randomUUID();
    await capture(() => {
      identifyObservedUser(userId, "oauth");
      for (let index = 0; index < 20; index++)
        recordFeatureOperation(
          { ...context, requestId: id },
          { outcome: "success", errorClass: "none" },
          index + 0.25,
        );
    });
    const rows = await db.featureOperationEvent.findMany({
      where: { requestId: id },
      orderBy: { durationMs: "asc" },
    });
    expect(rows).toHaveLength(20);
    for (const [index, row] of rows.entries())
      expect(row).toMatchObject({
        ...context,
        authMode: "oauth",
        userId,
        requestId: id,
        outcome: "success",
        errorClass: "none",
        durationMs: index + 0.25,
      });
    const valid = {
      id: crypto.randomUUID(),
      feature: "catalog.course",
      operation: "get",
      protocol: "rest",
      surface: "unknown",
      authMode: "anonymous",
      outcome: "success",
      errorClass: "none",
      durationMs: 1,
    };
    for (const field of [
      "feature",
      "operation",
      "protocol",
      "surface",
      "authMode",
      "outcome",
      "errorClass",
    ])
      await expect(
        writeObservabilityBatch({
          features: [{ ...valid, [field]: "unbounded-private-dimension" }],
        }),
      ).rejects.toThrow();
    for (const durationMs of [-1, Number.NaN, Number.POSITIVE_INFINITY])
      await expect(
        writeObservabilityBatch({ features: [{ ...valid, durationMs }] }),
      ).rejects.toThrow();
    expect(
      await db.featureOperationEvent.count({ where: { id: valid.id } }),
    ).toBe(0);
  });
});
