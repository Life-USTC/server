import { beforeEach, expect, it, vi } from "vitest";

const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch: write,
}));

import {
  collectFeatureEvent,
  identifyObservedRequest,
  identifyObservedUser,
  runWithObservability,
} from "@/lib/db/observability-context";
import { emitLog } from "@/lib/log/app-log-emitter";

const event = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  occurredAt: new Date(),
  feature: "catalog.course",
  operation: "get",
  protocol: "rest",
  surface: "unknown",
  authMode: "unknown",
  outcome: "success",
  errorClass: "none",
  durationMs: 1,
  requestId: null,
  userId: null,
} as const;
beforeEach(() => {
  vi.clearAllMocks();
  write.mockResolvedValue(undefined);
});
it("batches nested observations once, reuses known identity, and returns without waiting on database", async () => {
  let finish!: () => void;
  write.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const tasks: Promise<unknown>[] = [];
  const response = new Response("untouched");
  const result = await runWithObservability(
    async () => {
      identifyObservedUser("user", "oauth");
      collectFeatureEvent(event);
      await runWithObservability(() =>
        collectFeatureEvent({ ...event, id: crypto.randomUUID() }),
      );
      return response;
    },
    (task) => tasks.push(task),
  );
  expect(result).toBe(response);
  expect(response.bodyUsed).toBe(false);
  expect(tasks).toHaveLength(1);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0].features).toHaveLength(2);
  expect(write.mock.calls[0][0].features[0]).toMatchObject({
    userId: "user",
    authMode: "oauth",
  });
  finish();
  await tasks[0];
});
it("is portable without a host scheduler and isolates simultaneous requests", async () => {
  await Promise.all(
    ["first", "second"].map((user) =>
      runWithObservability(async () => {
        identifyObservedUser(user, "session");
        await Promise.resolve();
        collectFeatureEvent(event);
      }),
    ),
  );
  expect(
    write.mock.calls.map(([batch]) => batch.features[0].userId).sort(),
  ).toEqual(["first", "second"]);
});
it("caps memory and reports dropped coverage while preserving business errors", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const error = new Error("business");
  await expect(
    runWithObservability(() => {
      for (let i = 0; i < 300; i++) collectFeatureEvent(event);
      throw error;
    }),
  ).rejects.toBe(error);
  expect(write.mock.calls[0][0].features).toHaveLength(256);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('"limit":256'));
  warn.mockRestore();
});
it("persists only bounded structured runtime error fields, never messages or raw errors", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  await runWithObservability(() => {
    emitLog(
      "[app]",
      "error",
      {
        event: "api.request.error",
        requestId: event.id,
        status: 503,
        message: "secret",
        route: "/secret/token",
      },
      new Error("private"),
    );
    emitLog("[app]", "error", { event: "bad secret event" });
  });
  const issues = write.mock.calls[0][0].issues;
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    event: "api.request.error",
    status: 503,
    route: null,
  });
  expect(JSON.stringify(issues)).not.toMatch(/secret|private/);
  error.mockRestore();
});
it("handles failed writes without changing the original result or recursively logging", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  write.mockRejectedValue(new Error("private db"));
  const tasks: Promise<unknown>[] = [];
  expect(
    await runWithObservability(
      () => {
        collectFeatureEvent(event);
        return 42;
      },
      (t) => tasks.push(t),
    ),
  ).toBe(42);
  await tasks[0];
  expect(write).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining("observability.write-failed"),
  );
  expect(JSON.stringify(warn.mock.calls)).not.toContain("private");
  warn.mockRestore();
});

it("persists a streamed operation completed after response headers without replaying earlier events", async () => {
  let release!: () => void;
  let late!: Promise<void>;
  const tasks: Promise<unknown>[] = [];
  await runWithObservability(
    () => {
      collectFeatureEvent(event);
      late = new Promise<void>((resolve) => {
        release = resolve;
      }).then(() =>
        collectFeatureEvent({
          ...event,
          id: "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee",
        }),
      );
      return new Response("stream");
    },
    (task) => tasks.push(task),
  );
  await Promise.all(tasks);
  expect(write).toHaveBeenCalledTimes(1);
  release();
  await late;
  await Promise.all(tasks);
  expect(write).toHaveBeenCalledTimes(2);
  expect(
    write.mock.calls.map(([batch]) =>
      batch.features.map((row: { id: string }) => row.id),
    ),
  ).toEqual([[event.id], ["bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"]]);
});

it("does not recursively persist connection errors raised by the event writer", async () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  write.mockImplementation(async () => {
    emitLog("[app]", "error", { event: "postgres.connection-error" });
    throw new Error("down");
  });
  const tasks: Promise<unknown>[] = [];
  await runWithObservability(
    () => collectFeatureEvent(event),
    (task) => tasks.push(task),
  );
  await Promise.all(tasks);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0].issues).toEqual([]);
  output.mockRestore();
  warn.mockRestore();
});

it("does not add an unhandled duplicate when a structured runtime error already exists", async () => {
  const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tasks: Promise<unknown>[] = [];
  const failure = new Error("business");
  await expect(
    runWithObservability(
      () => {
        emitLog("[app]", "error", { event: "request.error" });
        throw failure;
      },
      (task) => tasks.push(task),
    ),
  ).rejects.toBe(failure);
  await Promise.all(tasks);
  expect(
    write.mock.calls[0][0].issues.map(
      (issue: { event: string }) => issue.event,
    ),
  ).toEqual(["request.error"]);
  output.mockRestore();
});

it("correlates failures on requests without a classified feature", async () => {
  const requestId = crypto.randomUUID();
  const failure = new Error("private message");
  await expect(
    runWithObservability(() => {
      identifyObservedRequest(requestId);
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(write.mock.calls[0][0].issues).toEqual([
    expect.objectContaining({ requestId, event: "request.unhandled" }),
  ]);
  write.mockClear();
  await runWithObservability(() => {
    identifyObservedRequest(requestId);
    emitLog("[test]", "error", { event: "application.failed" });
  });
  expect(write.mock.calls[0][0].issues).toEqual([
    expect.objectContaining({ requestId, event: "application.failed" }),
  ]);
});
