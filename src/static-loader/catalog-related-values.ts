import type { Prisma } from "../generated/prisma-node/client";
import type { Snapshot } from "./snapshot";
import type { SnapshotRow } from "./snapshot-values";

export type RelatedSnapshot = Pick<
  Snapshot,
  "hasTable" | "iterateAll" | "rowCount"
>;
export type RelatedMetadata = Readonly<Record<string, string>>;

export function requireCatalogValue(
  condition: unknown,
  label: string,
): asserts condition {
  if (!condition) throw new Error(`Invalid official catalog data: ${label}`);
}

export function countedTables(
  snapshot: RelatedSnapshot,
  metadata: RelatedMetadata,
  names: readonly string[],
  additional: readonly string[] = [],
): boolean {
  if (
    ![...names, ...additional].every((name) => snapshot.hasTable(name)) ||
    !names.every((name) => metadata[`${name}_count`] != null)
  )
    return false;
  for (const name of names) {
    const value = metadata[`${name}_count`];
    requireCatalogValue(
      /^\d+$/.test(value) && Number(value) === snapshot.rowCount(name),
      `${name} count does not match snapshot metadata`,
    );
  }
  return true;
}

export function unique<Row>(
  rows: Iterable<SnapshotRow>,
  map: (row: SnapshotRow) => Row,
  key: (row: Row) => string | number,
) {
  const result = new Map<string | number, Row>();
  for (const raw of rows) {
    const row = map(raw);
    const id = key(row);
    requireCatalogValue(!result.has(id), `duplicate row ${id}`);
    result.set(id, row);
  }
  return result;
}

export function text(value: unknown, label: string): string {
  requireCatalogValue(typeof value === "string", label);
  return value;
}

export function code(value: unknown, label: string): string {
  const result = text(value, label);
  requireCatalogValue(result !== "" && result.trim() === result, label);
  return result;
}

export function integer(value: unknown, label: string, min = 1): number {
  requireCatalogValue(
    typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= 2_147_483_647,
    label,
  );
  return value;
}

export function array(value: unknown, label: string): unknown[] {
  requireCatalogValue(Array.isArray(value), label);
  return value;
}

export function object(value: unknown, label: string): Record<string, unknown> {
  requireCatalogValue(
    value != null && typeof value === "object" && !Array.isArray(value),
    label,
  );
  return value as Record<string, unknown>;
}

export function json(value: unknown, label: string): unknown {
  try {
    return JSON.parse(text(value, label));
  } catch {
    throw new Error(`Invalid official catalog JSON: ${label}`);
  }
}

export function jsonDocument(
  value: Record<string, unknown> | unknown[],
): Prisma.InputJsonObject | Prisma.InputJsonArray {
  return value as Prisma.InputJsonObject | Prisma.InputJsonArray;
}
