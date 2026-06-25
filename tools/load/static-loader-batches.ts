export const SQLITE_READ_BATCH_SIZE = 5_000;
export const DB_WRITE_BATCH_SIZE = 1_000;
export const JOIN_WRITE_BATCH_SIZE = 5_000;

export function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function forEachChunk<T>(
  items: T[],
  size: number,
  fn: (chunk: T[]) => Promise<void>,
) {
  for (const chunk of chunkArray(items, size)) {
    await fn(chunk);
  }
}
