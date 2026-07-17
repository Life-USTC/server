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
