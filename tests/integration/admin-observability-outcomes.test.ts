import { expect, vi } from "vitest";
import { observeHttpFeature } from "@/lib/metrics/feature-http-operation";
import { observabilityTest as it } from "../shared/observability-fixture";

// This file owns one console spy scope; other cases run in isolated modules.
it("admin.feature-experience-outcomes", async ({ observation }) => {
  const { db, capture } = observation;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    await observation.runtime(async () => {
      const id = crypto.randomUUID();
      const response = new Response(
        '{"type":"data","nodes":[{"type":"error","error":{"message":"private"}}]}',
        { headers: { "content-type": "application/json" } },
      );
      const result = await capture(() =>
        observeHttpFeature(
          new Request("http://localhost:3000/catalog/courses/123/__data.json"),
          id,
          () => response,
        ),
      );
      expect(result).toBe(response);
      expect(response.bodyUsed).toBe(false);
      expect(
        await db.featureOperationEvent.findMany({ where: { requestId: id } }),
      ).toEqual([
        expect.objectContaining({ outcome: "unknown", errorClass: "none" }),
      ]);
      expect(
        await db.runtimeIssueEvent.count({ where: { requestId: id } }),
      ).toBe(0);
      expect(warn).not.toHaveBeenCalled();
    });
  } finally {
    warn.mockRestore();
  }
});
