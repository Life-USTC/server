import { setImmediate as checkpoint } from "node:timers/promises";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { describe, expect, it } from "vitest";
import {
  handleCommunityEffectProbe,
  observeCommunityEffects,
} from "../../ci/fixtures/community-effect-probe";
import { createDeferred } from "../../shared/deferred";

const env = { NODE_ENV: "test", E2E_STORAGE_SECRET: "unit-effect-observer" };
type Snapshot = {
  requests: {
    outcome: string;
    value: { method: string; path: string };
    result?: number;
    error?: string;
  }[];
  backgroundErrors: string[];
  messages: unknown[];
  purges: unknown[];
};

async function withProbe(
  number: number,
  work: (probe: {
    context: ExecutionContext;
    scheduled: Promise<unknown>[];
    gate: typeof createDeferred<void>;
    track: <T>(operation: Promise<T>) => Promise<T>;
    cleanup: (dispose: () => Promise<unknown>) => void;
    fetch: (forward: () => Response | Promise<Response>) => Promise<Response>;
    snapshot: () => Promise<Snapshot>;
  }) => Promise<void>,
) {
  const id = `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
  const headers = { "x-test-storage-secret": env.E2E_STORAGE_SECRET };
  const url = `https://probe.test/__test/community-effects?id=${id}`;
  const releases: (() => void)[] = [];
  const disposers: (() => Promise<unknown>)[] = [];
  const acquisitions: Promise<Response>[] = [];
  const operations: Promise<unknown>[] = [];
  const scheduled: Promise<unknown>[] = [];
  const track = <T>(operation: Promise<T>) => {
    operations.push(operation);
    void operation.catch(() => undefined);
    return operation;
  };
  const context = {
    waitUntil: (task: Promise<unknown>) => scheduled.push(track(task)),
  } as unknown as ExecutionContext;
  const call = (method: string) =>
    handleCommunityEffectProbe(new Request(url, { method, headers }), env);
  expect((await call("POST"))?.status).toBe(201);
  const owned = observeCommunityEffects(
    new Request("https://probe.test/calendar", {
      headers: { ...headers, "x-test-community-probe": id },
    }),
    env,
    context,
  );
  try {
    await work({
      context: owned.context,
      scheduled,
      gate: () => {
        const gate = createDeferred();
        releases.push(gate.resolve);
        return gate;
      },
      track,
      cleanup: (dispose) => disposers.push(dispose),
      fetch: (forward) => {
        const acquisition = track(
          owned.fetch(forward).then((response) => {
            disposers.push(async () => {
              if (response.body && !response.body.locked)
                await response.body.cancel();
            });
            return response;
          }),
        );
        acquisitions.push(acquisition);
        return acquisition;
      },
      snapshot: () =>
        track(
          call("GET").then(async (response) => {
            expect(response?.status).toBe(200);
            return (await response?.json()) as Snapshot;
          }),
        ),
    });
  } finally {
    for (const release of releases) release();
    await Promise.allSettled(acquisitions);
    await Promise.allSettled(disposers.map((dispose) => dispose()));
    await Promise.allSettled(operations);
    expect((await call("DELETE"))?.status).toBe(204);
  }
}

async function expectPending(operation: Promise<unknown>) {
  expect(
    await Promise.race([
      operation.then(() => "settled"),
      checkpoint().then(() => "pending"),
    ]),
  ).toBe("pending");
}

describe("community effect observation owns asynchronous request completion", () => {
  it("cleans up an unread response acquired after the test callback fails", async () => {
    const failure = new Error("scenario assertion failed");
    const order: string[] = [];
    await expect(
      withProbe(7, async (probe) => {
        const handler = probe.gate();
        void probe.fetch(async () => {
          await handler.promise;
          order.push("handler-resolved");
          return new Response(
            new ReadableStream<Uint8Array>({
              cancel() {
                order.push("body-cancelled");
              },
            }),
          );
        });
        void probe.snapshot();
        order.push("callback-failed");
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(order).toEqual([
      "callback-failed",
      "handler-resolved",
      "body-cancelled",
    ]);
  });

  it("waits for a blocked handler and the background work it registers later", async () => {
    await withProbe(1, async (probe) => {
      const handler = probe.gate();
      const background = probe.gate();
      const started = createDeferred();
      const order: string[] = [];
      const response = probe.fetch(async () => {
        order.push("handler");
        started.resolve();
        await handler.promise;
        probe.context.waitUntil(
          background.promise.then(() => order.push("background")),
        );
        return new Response(null, { status: 204 });
      });
      await started.promise;
      const snapshot = probe.snapshot().then((value) => {
        order.push("snapshot");
        return value;
      });
      await expectPending(snapshot);
      handler.resolve();
      expect((await response).status).toBe(204);
      await expectPending(snapshot);
      background.resolve();
      expect(await snapshot).toEqual({
        requests: [
          {
            outcome: "fulfilled",
            value: { method: "GET", path: "/calendar" },
            result: 204,
          },
        ],
        backgroundErrors: [],
        messages: [],
        purges: [],
      });
      expect(order).toEqual(["handler", "background", "snapshot"]);
      expect(probe.scheduled).toHaveLength(1);
    });
  });

  it("preserves the response while waiting for EOF and cleanup registered there", async () => {
    await withProbe(2, async (probe) => {
      const eof = probe.gate();
      const cleanup = probe.gate();
      const readingEof = createDeferred();
      const order: string[] = [];
      let sent = false;
      const response = await probe.fetch(
        () =>
          new Response(
            new ReadableStream<Uint8Array>(
              {
                async pull(controller) {
                  if (!sent) {
                    sent = true;
                    controller.enqueue(new TextEncoder().encode("calendar"));
                    return;
                  }
                  readingEof.resolve();
                  await eof.promise;
                  order.push("eof");
                  probe.context.waitUntil(
                    cleanup.promise.then(() => order.push("cleanup")),
                  );
                  controller.close();
                },
              },
              { highWaterMark: 0 },
            ),
            { status: 201, headers: { "x-observed-response": "preserved" } },
          ),
      );
      expect(response.status).toBe(201);
      expect(response.headers.get("x-observed-response")).toBe("preserved");
      const text = probe.track(response.text());
      await readingEof.promise;
      const snapshot = probe.snapshot().then((value) => {
        order.push("snapshot");
        return value;
      });
      await expectPending(snapshot);
      eof.resolve();
      await expect(text).resolves.toBe("calendar");
      await expectPending(snapshot);
      cleanup.resolve();
      expect((await snapshot).requests).toEqual([
        {
          outcome: "fulfilled",
          value: { method: "GET", path: "/calendar" },
          result: 201,
        },
      ]);
      expect(order).toEqual(["eof", "cleanup", "snapshot"]);
      expect(probe.scheduled).toHaveLength(1);
    });
  });

  it("keeps a cancelled pending read owned until native cancellation and late work finish", async () => {
    await withProbe(3, async (probe) => {
      const nativeCancel = probe.gate();
      const background = probe.gate();
      const reading = createDeferred();
      const cancelling = createDeferred();
      const order: string[] = [];
      let reason: unknown;
      const response = await probe.fetch(
        () =>
          new Response(
            new ReadableStream<Uint8Array>(
              {
                pull() {
                  reading.resolve();
                },
                async cancel(value) {
                  reason = value;
                  order.push("cancel-start");
                  cancelling.resolve();
                  await nativeCancel.promise;
                  probe.context.waitUntil(
                    background.promise.then(() => order.push("background")),
                  );
                  order.push("cancel-end");
                },
              },
              { highWaterMark: 0 },
            ),
          ),
      );
      if (!response.body) throw new Error("Expected a response stream");
      const reader = response.body.getReader();
      probe.cleanup(() => reader.cancel());
      const read = probe.track(reader.read());
      await reading.promise;
      const snapshot = probe.snapshot().then((value) => {
        order.push("snapshot");
        return value;
      });
      await expectPending(snapshot);
      const cancelled = probe.track(reader.cancel("navigation"));
      await cancelling.promise;
      await expect(read).resolves.toEqual({ done: true, value: undefined });
      await expectPending(snapshot);
      nativeCancel.resolve();
      await cancelled;
      await expectPending(snapshot);
      background.resolve();
      expect((await snapshot).requests[0]).toEqual({
        outcome: "fulfilled",
        value: { method: "GET", path: "/calendar" },
        result: 200,
      });
      expect(reason).toBe("navigation");
      expect(order).toEqual([
        "cancel-start",
        "cancel-end",
        "background",
        "snapshot",
      ]);
      expect(probe.scheduled).toHaveLength(1);
    });
  });

  it("reports a genuine handler rejection without leaving the snapshot pending", async () => {
    await withProbe(4, async (probe) => {
      const gate = probe.gate();
      const failure = new Error("handler failed");
      const response = probe.fetch(async () => {
        await gate.promise;
        throw failure;
      });
      const snapshot = probe.snapshot();
      await expectPending(snapshot);
      gate.resolve();
      await expect(response).rejects.toBe(failure);
      expect((await snapshot).requests).toEqual([
        {
          outcome: "rejected",
          value: { method: "GET", path: "/calendar" },
          error: "handler failed",
        },
      ]);
    });
  });

  it("reports a genuine response stream failure after headers were sent", async () => {
    await withProbe(5, async (probe) => {
      const gate = probe.gate();
      const failure = new Error("stream failed");
      const response = await probe.fetch(
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              async pull(controller) {
                await gate.promise;
                controller.error(failure);
              },
            }),
          ),
      );
      const text = probe.track(response.text());
      const snapshot = probe.snapshot();
      await expectPending(snapshot);
      gate.resolve();
      await expect(text).rejects.toBe(failure);
      expect((await snapshot).requests).toEqual([
        {
          outcome: "rejected",
          value: { method: "GET", path: "/calendar" },
          result: 200,
          error: "stream failed",
        },
      ]);
    });
  });

  it("records background rejection and still drains follow-up work", async () => {
    await withProbe(6, async (probe) => {
      const first = probe.gate();
      const followup = probe.gate();
      const registered = createDeferred();
      const response = await probe.fetch(() => {
        probe.context.waitUntil(
          first.promise.then(() => {
            probe.context.waitUntil(followup.promise);
            registered.resolve();
            throw new Error("background failed");
          }),
        );
        return new Response(null, { status: 204 });
      });
      expect(response.status).toBe(204);
      const snapshot = probe.snapshot();
      await expectPending(snapshot);
      first.resolve();
      await registered.promise;
      await expectPending(snapshot);
      followup.resolve();
      const result = await snapshot;
      expect(result.backgroundErrors).toEqual(["background failed"]);
      expect(result.requests[0]?.outcome).toBe("fulfilled");
      expect(probe.scheduled).toHaveLength(2);
    });
  });

  it("forwards untagged requests, responses and failures unchanged", async () => {
    const context = {
      waitUntil: () => undefined,
    } as unknown as ExecutionContext;
    const observed = observeCommunityEffects(
      new Request("https://probe.test/calendar"),
      env,
      context,
    );
    expect(observed.env).toBe(env);
    expect(observed.context).toBe(context);
    const response = new Response("untagged", { status: 202 });
    const body = response.body;
    let calls = 0;
    expect(
      await observed.fetch(() => {
        calls++;
        return response;
      }),
    ).toBe(response);
    expect(response.body).toBe(body);
    expect(calls).toBe(1);
    await expect(response.text()).resolves.toBe("untagged");
    const failure = new Error("untagged failure");
    await expect(
      observed.fetch(() => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
