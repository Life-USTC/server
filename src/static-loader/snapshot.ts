import { Database } from "bun:sqlite";
import { asInt, type SnapshotRow } from "./snapshot-values";

export {
  asBoolean,
  asDate,
  asFloat,
  asInt,
  asString,
  type SnapshotRow,
} from "./snapshot-values";

export class Snapshot {
  private readonly db: Database;
  private readonly rowsByTable = new Map<string, SnapshotRow[]>();
  private readonly rowsByParent = new Map<string, Map<number, SnapshotRow[]>>();

  constructor(path: string) {
    this.db = new Database(path, { readonly: true });
  }

  close(): void {
    this.clearCachedRows();
    this.db.close();
  }

  clearCachedRows(tableNames?: readonly string[]): void {
    if (tableNames == null) {
      this.rowsByTable.clear();
      this.rowsByParent.clear();
      return;
    }
    const tables = new Set(tableNames);
    for (const tableName of tables) this.rowsByTable.delete(tableName);
    for (const key of this.rowsByParent.keys()) {
      if (tables.has(key.slice(0, key.indexOf(":")))) {
        this.rowsByParent.delete(key);
      }
    }
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
    assertIdentifier(tableName, "table");
    const cached = this.rowsByTable.get(tableName);
    if (cached != null) return cached;
    const rows = this.db
      .query(`SELECT * FROM "${tableName}"`)
      .all() as SnapshotRow[];
    this.rowsByTable.set(tableName, rows);
    return rows;
  }

  hasTable(tableName: string): boolean {
    assertIdentifier(tableName, "table");
    const row = this.db
      .query(
        `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
      )
      .get(tableName);
    return row != null;
  }

  groupByParent(
    rows: SnapshotRow[],
    parentColumn = "parent_store_id",
  ): Map<number, SnapshotRow[]> {
    assertIdentifier(parentColumn, "parent column");
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
    const key = `${tableName}:${parentColumn}`;
    const cached = this.rowsByParent.get(key);
    if (cached != null) return cached;
    const rows = this.groupByParent(this.queryAll(tableName), parentColumn);
    this.rowsByParent.set(key, rows);
    return rows;
  }
}

function assertIdentifier(value: string, description: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid snapshot ${description}: ${value}`);
  }
}
