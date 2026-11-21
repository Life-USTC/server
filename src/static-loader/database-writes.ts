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
  ignoreConflicts?: boolean;
  updateWhenTrue?: string;
};

export function chunks<T>(array: T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Chunk size must be a positive integer");
  }
  const result: T[][] = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
}

function assertSqlIdentifier(value: string, description: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${description}: ${value}`);
  }
}

function validateColumns(
  table: string,
  columns: string[],
  columnTypes: string[],
): void {
  assertSqlIdentifier(table, "table name");
  if (columns.length === 0 || columns.length !== columnTypes.length) {
    throw new Error(`Column definitions do not match for ${table}`);
  }
  for (const column of columns) assertSqlIdentifier(column, "column name");
  for (const type of columnTypes) assertSqlIdentifier(type, "column type");
}

export async function syncJoinPairs(
  tx: Prisma.TransactionClient,
  table: string,
  scopeColumn: "A" | "B",
  scopeIds: number[],
  pairs: Array<{ a: number; b: number }>,
): Promise<void> {
  assertSqlIdentifier(table, "join table name");
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

  validateColumns(table, columns, columnTypes);
  assertSqlIdentifier(uniqueColumn, "unique column name");
  assertSqlIdentifier(uniqueColumnType, "unique column type");
  if (records.some((record) => record.values.length !== columns.length)) {
    throw new Error(`Record values do not match columns for ${table}`);
  }

  const allColumns = [uniqueColumn, ...columns];
  const allTypes = [uniqueColumnType, ...columnTypes];
  const updateColumns = options.updateColumns ?? columns;
  if (
    updateColumns.length === 0 ||
    updateColumns.some((column) => !columns.includes(column))
  ) {
    throw new Error(`Invalid bulk upsert update columns for ${table}`);
  }

  const updateCondition = options.updateWhenTrue;
  if (updateCondition != null) {
    assertSqlIdentifier(updateCondition, "bulk upsert condition column");
  }
  const updateGuard =
    updateCondition == null
      ? ""
      : ` AND "${table}"."${updateCondition}" IS TRUE`;
  const onConflict = options.ignoreConflicts
    ? "DO NOTHING"
    : `DO UPDATE SET
        ${updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(",\n        ")}
      WHERE ROW(${updateColumns.map((column) => `"${table}"."${column}"`).join(",")})
        IS DISTINCT FROM ROW(${updateColumns.map((column) => `EXCLUDED."${column}"`).join(",")})${updateGuard}`;

  for (const batch of chunks(records, 500)) {
    const { params, values } = bindRows(
      batch.map((record) => [record.key, ...record.values]),
      allTypes,
    );

    const sql = `
      INSERT INTO "${table}" (${allColumns.map((column) => `"${column}"`).join(",")})
      VALUES ${values}
      ON CONFLICT ("${uniqueColumn}") ${onConflict}
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
  validateColumns(table, columns, columnTypes);
  if (records.some((record) => record.values.length !== columns.length)) {
    throw new Error(`Record values do not match columns for ${table}`);
  }
  for (const batch of chunks(records, 500)) {
    const { params, values } = bindRows(
      batch.map((record) => [...record.values, record.id]),
      [...columnTypes, "int"],
    );

    const sql = `
      UPDATE "${table}" AS target SET
        ${columns.map((column) => `"${column}" = data."${column}"`).join(",\n        ")}
      FROM (VALUES ${values}) AS data(${columns.map((column) => `"${column}"`).join(",")}, "id")
      WHERE target."id" = data."id"
    `;

    await tx.$executeRawUnsafe(sql, ...params);
  }
}

/** Bind row-major parameters once for both INSERT and UPDATE statements. */
function bindRows(rows: ColumnValue[][], types: string[]) {
  const params: ColumnValue[] = [];
  const values = rows
    .map(
      (row) =>
        `(${row
          .map((value, index) => {
            params.push(value ?? null);
            return `$${params.length}::${types[index]}`;
          })
          .join(",")})`,
    )
    .join(",");
  return { params, values };
}
