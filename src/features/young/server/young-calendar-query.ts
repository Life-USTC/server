import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";
import type { buildYoungEventListQuery } from "./young-event-query";
import type { YoungCalendarEvent } from "./young-event-service";

type EventQuery = ReturnType<typeof buildYoungEventListQuery>;
type CalendarRow = [
  string,
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  boolean,
];

function timestamp(value: string): Date {
  // PrismaPg converts both PostgreSQL timestamp types to UTC strings.
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid Young event timestamp");
  return date;
}

function calendarDate(value: string | null): string | null {
  return value == null ? null : formatShanghaiTimestamp(timestamp(value));
}

/** Public snapshot facts only; private calendar data retains its RLS use-cases. */
export function readYoungCalendarFacts({ filters, dateRange }: EventQuery) {
  // Column names and operators are fixed here. Every input value is bound.
  const args: (string | boolean)[] = [];
  const argTypes: { scalarType: "string" | "boolean"; arity: "scalar" }[] = [];
  function bind(value: string | boolean) {
    args.push(value);
    argTypes.push({
      scalarType: typeof value === "boolean" ? "boolean" : "string",
      arity: "scalar",
    });
    return `$${args.length}`;
  }
  const base: string[] = [];
  if (filters.active != null) base.push(`"isActive" = ${bind(filters.active)}`);
  for (const field of [
    "category",
    "module",
    "activityLevel",
    "organizerId",
  ] as const) {
    const value = filters[field];
    if (value) base.push(`"${field}" = ${bind(value)}`);
  }
  // Match Prisma's insensitive contains semantics, including SQL wildcards.
  if (filters.search) base.push(`"name" ILIKE ${bind(`%${filters.search}%`)}`);
  const start =
    dateRange.timeBasis === "registration" ? '"applyStartAt"' : '"startAt"';
  const end =
    dateRange.timeBasis === "registration" ? '"applyEndAt"' : '"endAt"';
  const unknown = {
    sql: `SELECT COUNT(*) FROM "YoungEvent" WHERE ${[...base, `${start} IS NULL`].join(" AND ")}`,
    args: [...args],
    argTypes: [...argTypes],
  };
  const known = [...base];
  if (dateRange.hasRange) known.push(`${start} IS NOT NULL`);
  if (dateRange.to)
    known.push(`${start} <= ${bind(dateRange.to.toISOString())}::timestamp`);
  if (dateRange.from) {
    const from = `${bind(dateRange.from.toISOString())}::timestamp`;
    known.push(`(${end} > ${from} OR ${start} >= ${from})`);
  }
  const order = dateRange.hasRange
    ? `${start} ASC, "youngId" ASC`
    : '"isActive" DESC, "startAt" DESC NULLS LAST, "youngId" ASC';
  const events = {
    sql: `SELECT "youngId", "name", "startAt", "endAt", "applyStartAt", "applyEndAt", "location", "sourceMissing" FROM "YoungEvent"${known.length ? ` WHERE ${known.join(" AND ")}` : ""} ORDER BY ${order}`,
    args,
    argTypes,
  };
  return withRuntimeDatabaseAdapter("app", async (adapter) => {
    const [records, count] = await Promise.all([
      adapter.queryRaw(events),
      adapter.queryRaw(unknown),
    ]);
    const unknownDateCount = Number(count.rows[0]?.[0]);
    if (!Number.isSafeInteger(unknownDateCount) || unknownDateCount < 0)
      throw new Error("Invalid Young unknown-date count");
    const data: YoungCalendarEvent[] = (records.rows as CalendarRow[]).map(
      ([
        youngId,
        name,
        startAt,
        endAt,
        applyStartAt,
        applyEndAt,
        location,
        sourceMissing,
      ]) => ({
        youngId,
        name,
        startAt: calendarDate(startAt),
        endAt: calendarDate(endAt),
        applyStartAt: calendarDate(applyStartAt),
        applyEndAt: calendarDate(applyEndAt),
        location,
        sourceMissing,
      }),
    );
    return { data, unknownDateCount };
  });
}

/** Keep the source timestamp cached separately from its moving freshness state. */
export function readYoungSyncedAt(): Promise<number | null> {
  return withRuntimeDatabaseAdapter("app", async (adapter) => {
    const result = await adapter.queryRaw({
      sql: 'SELECT "youngSyncedAt" FROM "StaticImportState" WHERE "id" = $1',
      args: ["global"],
      argTypes: [{ scalarType: "string", arity: "scalar" }],
    });
    const value = result.rows[0]?.[0] as string | null | undefined;
    return value == null ? null : timestamp(value).getTime();
  });
}
