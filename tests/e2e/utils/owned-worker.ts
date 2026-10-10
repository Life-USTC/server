import { test as workerTest } from "./isolated-worker";

type Run = <T>(work: () => Promise<T>) => Promise<T>;

/** Keep admitted Node preparation/observations alive until their Worker can close. */
export const test = workerTest.extend<{ run: Run }>({
  run: async ({ isolatedWorker: _isolatedWorker, request: _request }, use) => {
    const operations: Promise<unknown>[] = [];
    let closing = false;
    const run: Run = (work) => {
      if (closing)
        return Promise.reject(new Error("Worker operations are closing"));
      const operation = Promise.resolve().then(work);
      operations.push(
        operation.then(
          () => undefined,
          () => undefined,
        ),
      );
      return operation;
    };
    try {
      await use(run);
    } finally {
      closing = true;
      await Promise.all(operations);
    }
  },
});
