/** Own the lifetime of Worker background tasks in tests, including failures. */
export function createWaitUntil() {
  const tasks: Promise<PromiseSettledResult<unknown>>[] = [];
  return {
    waitUntil(task: Promise<unknown>) {
      // Register rejection handling immediately; drain may run in a later turn.
      tasks.push(
        task.then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
      );
    },
    async drain() {
      const failures: unknown[] = [];
      while (tasks.length) {
        const results = await Promise.all(tasks.splice(0));
        for (const result of results) {
          if (result.status === "rejected") failures.push(result.reason);
        }
      }
      if (failures.length) {
        throw new AggregateError(failures, "Worker background tasks failed");
      }
    },
  };
}
