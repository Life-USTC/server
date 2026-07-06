import { Database } from "bun:sqlite";

export type SnapshotRow = Record<string, unknown>;

export class Snapshot {
  private readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { readonly: true });
  }

  close(): void {
    this.db.close();
  }

  metadata(): Record<string, string> {
    const rows = this.db
      .query("SELECT key, value FROM metadata")
      .all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  queryAll(tableName: string): SnapshotRow[] {
    return this.db.query(`SELECT * FROM "${tableName}"`).all() as SnapshotRow[];
  }

  groupByParent(
    rows: SnapshotRow[],
    parentColumn = "parent_store_id",
  ): Map<number, SnapshotRow[]> {
    const map = new Map<number, SnapshotRow[]>();
    for (const row of rows) {
      const parentId = asInt(row[parentColumn]);
      if (parentId == null) continue;
      const list = map.get(parentId) ?? [];
      list.push(row);
      map.set(parentId, list);
    }
    return map;
  }

  queryGrouped(
    tableName: string,
    parentColumn = "parent_store_id",
  ): Map<number, SnapshotRow[]> {
    return this.groupByParent(this.queryAll(tableName), parentColumn);
  }
}

export function asInt(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number")
    return Number.isFinite(value) ? Math.trunc(value) : undefined;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }
  return undefined;
}

export function asFloat(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  return str === "" ? undefined : str;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "1" || lower === "true") return true;
    if (lower === "0" || lower === "false") return false;
  }
  return undefined;
}

export function asDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  if (str === "") return undefined;
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
