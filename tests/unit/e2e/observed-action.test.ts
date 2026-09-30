import { describe, expect, it } from "vitest";
import { observeAction } from "../../e2e/utils/observed-action";
import { createDeferred } from "../../shared/deferred";

describe("observeAction", () => {
  it("registers observation before the action and returns the observed value", async () => {
    const observation = createDeferred<{ status: number }>();
    const order: string[] = [];
    const response = { status: 200 };
    const operation = observeAction(
      () => {
        order.push("observe");
        return observation.promise;
      },
      async () => {
        order.push("act");
        observation.resolve(response);
      },
    );
    await expect(operation).resolves.toBe(response);
    expect(order).toEqual(["observe", "act"]);
  });

  it("retains both original errors when the observation and action fail", async () => {
    const observationError = new Error("response failed");
    const actionError = new Error("click failed");
    const operation = observeAction(
      () => Promise.reject(observationError),
      async () => {
        throw actionError;
      },
    );
    const error = await operation.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(AggregateError);
    if (!(error instanceof AggregateError))
      throw new Error("Expected both failures");
    expect(error.errors).toHaveLength(2);
    expect(error.errors[0]).toBe(observationError);
    expect(error.errors[1]).toBe(actionError);
  });

  it("keeps a rejected action pending until its observation settles", async () => {
    const observation = createDeferred<string>();
    const action = createDeferred();
    const actionError = new Error("click failed before response");
    let settled = false;
    const operation = observeAction(
      () => observation.promise,
      () => action.promise,
    );
    const result = operation.then(
      (value) => {
        settled = true;
        return { value };
      },
      (error: unknown) => {
        settled = true;
        return { error };
      },
    );
    try {
      action.reject(actionError);
      await expect(action.promise).rejects.toBe(actionError);
      expect(settled).toBe(false);
    } finally {
      observation.resolve("late response");
      await result;
    }
    await expect(result).resolves.toMatchObject({
      error: { errors: [actionError] },
    });
    expect(settled).toBe(true);
  });
});
