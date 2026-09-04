import { describe, expect, it } from "vitest";
import {
  mapTodoBatchWithConcurrency,
  TODO_BATCH_CONCURRENCY,
} from "@/features/todos/lib/todo-batch-concurrency";

describe("todo batch concurrency", () => {
  it("preserves 100-item ordering without exceeding the connection budget", async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const operation = async (value: number) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active -= 1;
      return value * 2;
    };

    const pending = mapTodoBatchWithConcurrency(
      Array.from({ length: 100 }, (_, index) => index),
      operation,
    );
    while (releases.length < TODO_BATCH_CONCURRENCY) await Promise.resolve();
    expect(active).toBe(TODO_BATCH_CONCURRENCY);
    expect(releases).toHaveLength(TODO_BATCH_CONCURRENCY);

    for (let index = 0; index < 100; index += 1) {
      while (!releases[index]) await Promise.resolve();
      releases[index]?.();
    }

    await expect(pending).resolves.toEqual(
      Array.from({ length: 100 }, (_, index) => index * 2),
    );
    expect(maxActive).toBe(TODO_BATCH_CONCURRENCY);
  });
});
