export const TODO_BATCH_CONCURRENCY = 5;

export async function mapTodoBatchWithConcurrency<Input, Output>(
  items: readonly Input[],
  operation: (item: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(TODO_BATCH_CONCURRENCY, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await operation(items[index] as Input, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
