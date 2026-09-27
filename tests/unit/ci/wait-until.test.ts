import { setImmediate } from "node:timers/promises";
import { expect, it } from "vitest";
import { createDeferred } from "../../shared/deferred";
import { createWaitUntil } from "../../shared/wait-until";

it("waits for every background task before reporting a task failure", async () => {
  const tasks = createWaitUntil();
  const pending = createDeferred();
  const error = new Error("write failed");
  tasks.waitUntil(Promise.reject(error));
  tasks.waitUntil(pending.promise);
  let drained = false;
  const result = tasks.drain().finally(() => {
    drained = true;
  });
  const assertion = expect(result).rejects.toMatchObject({ errors: [error] });
  try {
    await setImmediate();
    expect(drained).toBe(false);
  } finally {
    pending.resolve();
  }
  await assertion;
  expect(drained).toBe(true);
});

it("drains tasks scheduled while earlier background tasks settle", async () => {
  const tasks = createWaitUntil();
  const nested = createDeferred();
  tasks.waitUntil(
    Promise.resolve().then(() => tasks.waitUntil(nested.promise)),
  );
  let drained = false;
  const result = tasks.drain().then(() => {
    drained = true;
  });
  try {
    await setImmediate();
    expect(drained).toBe(false);
  } finally {
    nested.resolve();
  }
  await result;
  expect(drained).toBe(true);
});

it("retains a rejected task until drain starts in a later event-loop turn", async () => {
  const tasks = createWaitUntil();
  const error = new Error("background write failed before teardown");
  tasks.waitUntil(Promise.reject(error));
  await setImmediate();
  await expect(tasks.drain()).rejects.toMatchObject({ errors: [error] });
});
