import { expect, it, vi } from "vitest";
import { createSubscriptionConfirmationAction } from "@/features/subscriptions/lib/subscription-confirmation-action";

function input() {
  return {
    action: new URL("https://example.test/?/unsubscribe"),
    cancel: vi.fn(),
    controller: new AbortController(),
    formData: new FormData(),
    formElement: {} as HTMLFormElement,
    submitter: null,
  };
}
it("settles confirmation when enhancement is cancelled", async () => {
  const action = createSubscriptionConfirmationAction(() => ({ cancel }) => {
    cancel();
  });
  const pending = action.confirm({ requestSubmit: vi.fn() });
  const values = input();
  await action.submit(values);
  await expect(pending).resolves.toBe(false);
  expect(values.cancel).toHaveBeenCalledOnce();
});
it("preserves thrown pre-submit and result failures while settling pending state", async () => {
  const error = new Error("callback failed");
  for (const after of [false, true]) {
    const action = createSubscriptionConfirmationAction(() => () => {
      if (!after) throw error;
      return async () => {
        throw error;
      };
    });
    const pending = action.confirm({ requestSubmit: vi.fn() });
    if (after) {
      const callback = await action.submit(input());
      if (!callback) throw new Error("Missing action result callback");
      await expect(
        callback({
          ...input(),
          result: {
            type: "failure",
            status: 503,
            data: {},
            location: "/catalog/sections/1",
          },
          update: vi.fn(),
        }),
      ).rejects.toBe(error);
    } else await expect(action.submit(input())).rejects.toBe(error);
    await expect(pending).resolves.toBe(false);
  }
});
it("settles pending confirmation on abort or disposal without repeating submission", async () => {
  for (const dispose of [false, true]) {
    const action = createSubscriptionConfirmationAction(() => () => undefined);
    const requestSubmit = vi.fn();
    const pending = action.confirm({ requestSubmit });
    const values = input();
    await action.submit(values);
    if (dispose) action.dispose();
    else values.controller.abort();
    await expect(pending).resolves.toBe(false);
    expect(requestSubmit).toHaveBeenCalledOnce();
  }
});
it("does not swallow synchronous native requestSubmit failures", async () => {
  const action = createSubscriptionConfirmationAction(() => () => undefined);
  const error = new Error("detached form");
  await expect(
    action.confirm({
      requestSubmit() {
        throw error;
      },
    }),
  ).rejects.toBe(error);
});

it("an aborted attempt cannot settle the next confirmation", async () => {
  const action = createSubscriptionConfirmationAction(() => () => undefined);
  const first = action.confirm({ requestSubmit: vi.fn() });
  const firstInput = input();
  const oldCallback = await action.submit(firstInput);
  firstInput.controller.abort();
  await expect(first).resolves.toBe(false);
  const next = action.confirm({ requestSubmit: vi.fn() });
  const nextInput = input();
  await action.submit(nextInput);
  let settled = false;
  void next.then(() => {
    settled = true;
  });
  if (!oldCallback) throw new Error("Missing old callback");
  await oldCallback({
    ...input(),
    result: {
      type: "success",
      status: 200,
      data: {},
      location: "/catalog/sections/1",
    },
    update: vi.fn(),
  });
  expect(settled).toBe(false);
  action.dispose();
  expect(nextInput.controller.signal.aborted).toBe(true);
  await expect(next).resolves.toBe(false);
  const submitAgain = vi.fn();
  await expect(action.confirm({ requestSubmit: submitAgain })).resolves.toBe(
    false,
  );
  expect(submitAgain).not.toHaveBeenCalled();
});
it("a definitive redirect succeeds even if application update disposes the component", async () => {
  const action = createSubscriptionConfirmationAction(() => () => async () => {
    action.dispose();
  });
  const pending = action.confirm({ requestSubmit: vi.fn() });
  const callback = await action.submit(input());
  if (!callback) throw new Error("Missing callback");
  await callback({
    ...input(),
    result: { type: "redirect", status: 303, location: "/catalog/sections/1" },
    update: vi.fn(),
  });
  await expect(pending).resolves.toBe(true);
});
