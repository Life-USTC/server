import type { APIResponse, Request } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { createAccountWriteObserver } from "../../e2e/utils/account-write-observer";
import { createDeferred } from "../../shared/deferred";

const request = (action = "updateProfile") =>
  ({
    url: () => `http://example.test/profile?/${action}`,
    method: () => "POST",
  }) as Request;
const response = (status = 200) =>
  ({
    status: () => status,
    body: async () => Buffer.from("{}"),
    json: async () => ({ type: "redirect", status: 303, location: "/profile" }),
  }) as APIResponse;

it("observes save and rollback separately before releasing each response", async () => {
  const gate = createDeferred();
  let stored = "saved";
  let returned = false;
  const saved = vi.fn(async () => {
    expect(stored).toBe("saved");
    await gate.promise;
  });
  const restored = vi.fn(async () => expect(stored).toBe("original"));
  const observer = createAccountWriteObserver([
    ["/profile", 200, "updateProfile", "/profile", saved],
    ["/profile", 200, "updateProfile", "/profile", restored],
  ]);
  const first = observer.observe(response(), request()).then(() => {
    returned = true;
  });
  await vi.waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(returned).toBe(false);
  expect(() => observer.assertStateObserved()).toThrow();
  gate.resolve();
  await first;
  stored = "original";
  await observer.observe(response(), request());
  observer.assertStateObserved();
  expect(restored).toHaveBeenCalledTimes(1);
  await expect(observer.observe(response(), request())).rejects.toThrow(
    "Unplanned",
  );
  expect(saved).toHaveBeenCalledTimes(1);
});

it("rejects a success response whose intermediate save did not persist", async () => {
  const observer = createAccountWriteObserver([
    [
      "/profile",
      200,
      "updateProfile",
      "/profile",
      async () => {
        expect("original").toBe("saved");
      },
    ],
  ]);
  await expect(observer.observe(response(), request())).rejects.toThrow();
  await expect(observer.observe(response(), request())).rejects.toThrow(
    "Unplanned",
  );
});

it("still observes state after a protocol failure and retains both failures", async () => {
  const stateError = new Error("persisted state differs");
  const state = vi.fn(async () => {
    throw stateError;
  });
  const observer = createAccountWriteObserver([
    ["/profile", 200, "updateProfile", "/profile", state],
  ]);
  const failure = await observer
    .observe(response(500), request())
    .catch((error) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect(failure.errors).toHaveLength(2);
  expect(failure.errors[1]).toBe(stateError);
  expect(state).toHaveBeenCalledTimes(1);
});

it("waits for state after a custom response verifier fails", async () => {
  const error = new Error("invalid OAuth redirect");
  const state = vi.fn(async () => {});
  const observer = createAccountWriteObserver(
    [["/profile", 200, "updateProfile", undefined, state]],
    async () => {
      throw error;
    },
  );
  await expect(observer.observe(response(), request())).rejects.toBe(error);
  expect(state).toHaveBeenCalledTimes(1);
});

it("keeps concurrent plans independent even when their actions match", async () => {
  const firstState = vi.fn(async () => {});
  const secondState = vi.fn(async () => {});
  const first = createAccountWriteObserver([
    ["/profile", 200, "updateProfile", undefined, firstState],
  ]);
  const second = createAccountWriteObserver([
    ["/profile", 200, "updateProfile", undefined, secondState],
  ]);
  await Promise.all([
    second.observe(response(), request()),
    first.observe(response(), request()),
  ]);
  first.assertStateObserved();
  second.assertStateObserved();
  expect(firstState).toHaveBeenCalledTimes(1);
  expect(secondState).toHaveBeenCalledTimes(1);
});

it("rejects unplanned actions without consuming an expected observation", async () => {
  const state = vi.fn(async () => {});
  const observer = createAccountWriteObserver([
    ["/profile", 200, "updateProfile", undefined, state],
  ]);
  await expect(
    observer.observe(response(), request("deleteAccount")),
  ).rejects.toThrow("Unplanned");
  expect(state).not.toHaveBeenCalled();
  expect(() => observer.assertStateObserved()).toThrow();
  await observer.observe(response(), request());
  observer.assertStateObserved();
});
