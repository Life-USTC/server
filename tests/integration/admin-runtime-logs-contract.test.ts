import { expect, vi } from "vitest";
import {
  collectFeatureEvent,
  identifyObservedRequest,
} from "@/lib/db/observability-context";
import { emitLog } from "@/lib/log/app-log-emitter";
import { observabilityTest as it } from "../shared/observability-fixture";

const context = {
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "unknown",
} as const;

// This file owns one console spy scope; other cases run in isolated modules.
it("admin.platform-runtime-logs", async ({ observation }) => {
  const { db, capture } = observation;
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    await observation.runtime(async () => {
      const id = crypto.randomUUID();
      await capture(() => {
        identifyObservedRequest(id);
        emitLog(
          "[app]",
          "error",
          {
            event: "api.request.error",
            status: 503,
            requestId: id,
            route: "/private-path",
            message: "private-message",
            body: "private-body",
            search: "private-search",
            ip: "private-ip",
            cookie: "private-cookie",
            token: "private-token",
          },
          new Error("private-stack"),
        );
        emitLog("[app]", "error", { event: "bad private event" });
        emitLog("[app]", "error", { event: "observability.write-failed" });
        emitLog("[app]", "error", { event: "analytics-engine.write-failed" });
      });
      const rows = await db.runtimeIssueEvent.findMany({
        where: { requestId: id },
      });
      expect(rows).toEqual([
        expect.objectContaining({
          event: "api.request.error",
          requestId: id,
          status: 503,
          route: null,
        }),
      ]);
      expect(JSON.stringify(rows)).not.toContain("private-");
      const failId = crypto.randomUUID();
      await capture(() => {
        identifyObservedRequest(failId);
        collectFeatureEvent({
          ...context,
          id: crypto.randomUUID(),
          feature: "invalid-feature",
          outcome: "error",
          errorClass: "internal",
          durationMs: 1,
        });
      });
      expect(
        await db.runtimeIssueEvent.count({ where: { requestId: failId } }),
      ).toBe(0);
    });
  } finally {
    warn.mockRestore();
    error.mockRestore();
  }
});
