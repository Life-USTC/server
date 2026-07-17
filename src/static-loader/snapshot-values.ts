export type SnapshotRow = Record<string, unknown>;

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
