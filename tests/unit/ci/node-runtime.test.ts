import { setImmediate } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import {
  getCloudflareRuntimeTaskScheduler,
  registerCloudflareRuntimeCleanup,
} from "@/lib/adapters/cloudflare-runtime";
import { createDeferred } from "../../shared/deferred";
import { createNodeRuntime } from "../../shared/node-runtime";

it("preserves native business errors and includes simultaneous background failures", async () => {
  const runtime = createNodeRuntime({});
  const business = { status: 403, message: "Forbidden" };
  const background = new Error("background failed");
  try {
    expect(await runtime.run(() => 42)).toBe(42);
    await expect(
      runtime.run(() => {
        throw business;
      }),
    ).rejects.toBe(business);
    await expect(
      runtime.run(async () => {
        getCloudflareRuntimeTaskScheduler()?.(Promise.reject(background));
        throw business;
      }),
    ).rejects.toMatchObject({ errors: [business, { errors: [background] }] });
  } finally {
    await runtime.close();
  }
});

it("returns an unread response and cancels only its runtime wrapper once", async () => {
  const runtime = createNodeRuntime({});
  const cancel = vi.fn();
  const cleanup = vi.fn();
  const response = await runtime.run(() => {
    registerCloudflareRuntimeCleanup(cleanup);
    return new Response(new ReadableStream({ cancel }), {
      status: 202,
      headers: { "x-case": "owned" },
    });
  });
  expect(response.status).toBe(202);
  expect(response.headers.get("x-case")).toBe("owned");
  expect(response.bodyUsed).toBe(false);
  expect(cleanup).not.toHaveBeenCalled();
  const closing = runtime.close();
  expect(runtime.close()).toBe(closing);
  await closing;
  expect(cancel).toHaveBeenCalledOnce();
  expect(cleanup).toHaveBeenCalledOnce();
});

it("owns the wrapped response when background failure prevents returning it to the caller", async () => {
  const runtime = createNodeRuntime({});
  const cancel = vi.fn();
  const failure = new Error("background failed after Response");
  await expect(
    runtime.run(() => {
      getCloudflareRuntimeTaskScheduler()?.(Promise.reject(failure));
      return new Response(new ReadableStream({ cancel }));
    }),
  ).rejects.toMatchObject({ errors: [failure] });
  await runtime.close();
  expect(cancel).toHaveBeenCalledOnce();
});

it("waits for requests before closing their returned responses and rejects later work", async () => {
  const runtime = createNodeRuntime({});
  const gate = createDeferred();
  const cancel = vi.fn();
  const request = runtime.run(async () => {
    await gate.promise;
    return new Response(new ReadableStream({ cancel }));
  });
  let finished = false;
  const closing = runtime.close().finally(() => {
    finished = true;
  });
  try {
    await expect(runtime.run(() => null)).rejects.toThrow(
      "Node runtime is closing",
    );
    await setImmediate();
    expect(finished).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
  } finally {
    gate.resolve();
  }
  await request;
  await closing;
  expect(cancel).toHaveBeenCalledOnce();
});

it("drains tasks created by response cancellation even if another cancellation fails", async () => {
  const runtime = createNodeRuntime({});
  const gate = createDeferred();
  const cancelFailure = new Error("cancel failed");
  const taskFailure = new Error("late task failed");
  const cleanup = vi.fn();
  const successfulCancel = vi.fn();
  await runtime.run(() => {
    const schedule = getCloudflareRuntimeTaskScheduler();
    // Construct continuations inside the actual runtime's async context.
    const late = gate.promise.then(() => {
      schedule?.(
        Promise.resolve().then(() => {
          registerCloudflareRuntimeCleanup(cleanup);
          throw taskFailure;
        }),
      );
    });
    return new Response(
      new ReadableStream({
        cancel() {
          schedule?.(late);
          throw cancelFailure;
        },
      }),
    );
  });
  await runtime.run(
    () => new Response(new ReadableStream({ cancel: successfulCancel })),
  );
  let finished = false;
  const closing = runtime.close().finally(() => {
    finished = true;
  });
  const failure = expect(closing).rejects.toMatchObject({
    errors: [cancelFailure, { errors: [taskFailure] }],
  });
  try {
    await setImmediate();
    expect(finished).toBe(false);
    expect(successfulCancel).toHaveBeenCalledOnce();
    expect(cleanup).not.toHaveBeenCalled();
  } finally {
    gate.resolve();
  }
  await failure;
  expect(cleanup).toHaveBeenCalledOnce();
});

it("drains cleanup scheduled at EOF without cancelling a consumed response again", async () => {
  const runtime = createNodeRuntime({});
  const gate = createDeferred();
  const cleanup = vi.fn();
  const cancel = vi.fn();
  const response = await runtime.run(() => {
    const schedule = getCloudflareRuntimeTaskScheduler();
    const late = gate.promise.then(() =>
      registerCloudflareRuntimeCleanup(cleanup),
    );
    return new Response(
      new ReadableStream(
        {
          pull(controller) {
            schedule?.(late);
            controller.close();
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
    );
  });
  await response.text();
  let finished = false;
  const closing = runtime.close().finally(() => {
    finished = true;
  });
  try {
    await setImmediate();
    expect(finished).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
  } finally {
    gate.resolve();
  }
  await closing;
  expect(cleanup).toHaveBeenCalledOnce();
  expect(cancel).not.toHaveBeenCalled();
});
