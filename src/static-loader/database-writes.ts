import type { Prisma } from "../generated/prisma-node/client";

export type ColumnValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | Prisma.InputJsonValue;

type BulkUpsertOptions = {
  updateColumns?: string[];
};

export function chunks<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

export async function syncJoinPairs(
  tx: Prisma.TransactionClient,
  table: string,
  scopeColumn: "A" | "B",
  scopeIds: number[],
  pairs: Array<{ a: number; b: number }>,
): Promise<void> {
  for (const scopeChunk of chunks(scopeIds, 1000)) {
    const scopeSet = new Set(scopeChunk);
    const scopedPairs = pairs.filter((pair) =>
      scopeSet.has(scopeColumn === "A" ? pair.a : pair.b),
    );
    const keepClause =
      scopedPairs.length === 0
        ? ""
        : ` AND NOT EXISTS (
            SELECT 1
            FROM (VALUES ${scopedPairs
              .map((pair) => `(${pair.a},${pair.b})`)
              .join(",")}) AS desired("A","B")
            WHERE desired."A" = target."A" AND desired."B" = target."B"
          )`;
    await tx.$executeRawUnsafe(
      `DELETE FROM "${table}" AS target WHERE target."${scopeColumn}" IN (${scopeChunk.join(",")})${keepClause}`,
    );
  }

  for (const pairChunk of chunks(pairs, 1000)) {
    const values = pairChunk.map((pair) => `(${pair.a},${pair.b})`).join(",");
    await tx.$executeRawUnsafe(
      `INSERT INTO "${table}" ("A","B") VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }
}

export async function deleteMissingSnapshotRows(
  tx: Prisma.TransactionClient,
  model: "exam" | "scheduleGroup",
  sectionDbIds: number[],
  currentJwIds: number[],
) {
  if (sectionDbIds.length === 0) return;

  const keepJwIds = new Set(currentJwIds);
  for (const sectionChunk of chunks(sectionDbIds, 1000)) {
    const existing =
      model === "scheduleGroup"
        ? await tx.scheduleGroup.findMany({
            where: { sectionId: { in: sectionChunk } },
            select: { id: true, jwId: true },
          })
        : await tx.exam.findMany({
            where: { sectionId: { in: sectionChunk } },
            select: { id: true, jwId: true },
          });
    const staleIds = existing
      .filter((row) => !keepJwIds.has(row.jwId))
      .map((row) => row.id);
    for (const idChunk of chunks(staleIds, 1000)) {
      if (idChunk.length === 0) continue;
      if (model === "scheduleGroup") {
        await tx.scheduleGroup.deleteMany({ where: { id: { in: idChunk } } });
      } else {
        await tx.exam.deleteMany({ where: { id: { in: idChunk } } });
      }
    }
  }
}

export async function bulkUpsert<K extends string | number>(
  tx: Prisma.TransactionClient,
  table: string,
  uniqueColumn: string,
  uniqueColumnType: string,
  columns: string[],
  columnTypes: string[],
  records: Array<{ key: K; values: ColumnValue[] }>,
  options: BulkUpsertOptions = {},
): Promise<Map<K, number>> {
  const map = new Map<K, number>();
  if (records.length === 0) return map;

  const allColumns = [uniqueColumn, ...columns];
  const allTypes = [uniqueColumnType, ...columnTypes];
  const updateColumns = options.updateColumns ?? columns;
  if (
    updateColumns.length === 0 ||
    updateColumns.some((column) => !columns.includes(column))
  ) {
    throw new Error(`Invalid bulk upsert update columns for ${table}`);
  }

  for (const batch of chunks(records, 500)) {
    const params: ColumnValue[] = [];
    const valuePlaceholders: string[] = [];

    for (const record of batch) {
      const placeholders: string[] = [];
      const rowValues = [record.key, ...record.values];
      for (let index = 0; index < rowValues.length; index++) {
        params.push(rowValues[index] ?? null);
        placeholders.push(`$${params.length}::${allTypes[index]}`);
      }
      valuePlaceholders.push(`(${placeholders.join(",")})`);
    }

    const sql = `
      INSERT INTO "${table}" (${allColumns.map((column) => `"${column}"`).join(",")})
      VALUES ${valuePlaceholders.join(",")}
      ON CONFLICT ("${uniqueColumn}") DO UPDATE SET
        ${updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(",\n        ")}
      WHERE ROW(${updateColumns.map((column) => `"${table}"."${column}"`).join(",")})
        IS DISTINCT FROM ROW(${updateColumns.map((column) => `EXCLUDED."${column}"`).join(",")})
      RETURNING "id", "${uniqueColumn}"
    `;

    const rows = await tx.$queryRawUnsafe<
      Array<{ id: number } & Record<string, unknown>>
    >(sql, ...params);
    for (const row of rows) {
      map.set(row[uniqueColumn] as K, row.id);
    }

    const missing = batch.filter((record) => !map.has(record.key));
    if (missing.length > 0) {
      const missingRows = await tx.$queryRawUnsafe<
        Array<{ id: number } & Record<string, unknown>>
      >(
        `SELECT "id", "${uniqueColumn}" FROM "${table}" WHERE "${uniqueColumn}" IN (${missing
          .map((_, index) => `$${index + 1}::${uniqueColumnType}`)
          .join(",")})`,
        ...missing.map((record) => record.key),
      );
      for (const row of missingRows) {
        map.set(row[uniqueColumn] as K, row.id);
      }
    }
  }

  return map;
}

export async function bulkUpdate(
  tx: Prisma.TransactionClient,
  table: string,
  columns: string[],
  columnTypes: string[],
  records: Array<{ id: number; values: ColumnValue[] }>,
): Promise<void> {
  for (const batch of chunks(records, 500)) {
    const params: ColumnValue[] = [];
    const valuePlaceholders: string[] = [];

    for (const record of batch) {
      const placeholders: string[] = [];
      for (let index = 0; index < record.values.length; index++) {
        params.push(record.values[index] ?? null);
        placeholders.push(`$${params.length}::${columnTypes[index]}`);
      }
      params.push(record.id);
      placeholders.push(`$${params.length}::int`);
      valuePlaceholders.push(`(${placeholders.join(",")})`);
    }

    const sql = `
      UPDATE "${table}" AS target SET
        ${columns.map((column) => `"${column}" = data."${column}"`).join(",\n        ")}
      FROM (VALUES ${valuePlaceholders.join(",")}) AS data(${columns.map((column) => `"${column}"`).join(",")}, "id")
      WHERE target."id" = data."id"
    `;

    await tx.$executeRawUnsafe(sql, ...params);
  }
}
