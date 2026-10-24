import type { Prisma } from "@/generated/prisma/client";
import { parseDateInput } from "@/lib/time/parse-date-input";
import {
  endOfShanghaiDay,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";
import type {
  YoungEventListInput,
  YoungEventTimeBasis,
} from "./young-event-service";
import { buildYoungTableWhere } from "./young-table-filter-query";

export function normalizeYoungEventFilters(input: YoungEventListInput) {
  return {
    active: input.active ?? undefined,
    category: input.category?.trim() || undefined,
    module: input.module?.trim() || undefined,
    activityLevel: input.activityLevel?.trim() || undefined,
    search: input.search?.trim() || undefined,
    organizerId: input.organizerId?.trim() || undefined,
  };
}

export type NormalizedYoungEventFilters = ReturnType<
  typeof normalizeYoungEventFilters
>;

function eventDateField(timeBasis: YoungEventTimeBasis) {
  return timeBasis === "registration"
    ? { start: "applyStartAt" as const, end: "applyEndAt" as const }
    : { start: "startAt" as const, end: "endAt" as const };
}

function parseYoungDateBoundary(
  value: Date | string | null | undefined,
  boundary: "from" | "to",
): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new RangeError("Invalid date");
    return value;
  }

  // A date-only query is a Shanghai calendar boundary. Passing the date
  // through parseDateInput first would interpret it as UTC midnight, which
  // would shift the requested day by eight hours.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const parsed = parseDateInput(`${value.trim()}T00:00:00`);
    if (!(parsed instanceof Date)) throw new RangeError("Invalid date");
    if (boundary === "from") return startOfShanghaiDay(parsed);
    const end = endOfShanghaiDay(parsed);
    end.setSeconds(59, 999);
    return end;
  }

  const parsed = parseDateInput(value);
  if (!(parsed instanceof Date)) throw new RangeError("Invalid date");
  return parsed;
}

function buildDateRangeWhere(input: YoungEventListInput): {
  known: Prisma.YoungEventWhereInput;
  unknown: Prisma.YoungEventWhereInput;
  hasRange: boolean;
  timeBasis: YoungEventTimeBasis;
  from: Date | null;
  to: Date | null;
} {
  const timeBasis = input.timeBasis ?? "activity";
  const fields = eventDateField(timeBasis);
  const from = parseYoungDateBoundary(input.dateFrom, "from");
  const to = parseYoungDateBoundary(input.dateTo, "to");
  if (from && to && from.getTime() > to.getTime()) {
    throw new RangeError("dateFrom must be before or equal to dateTo");
  }

  if (from && to && to.getTime() - from.getTime() > 366 * 86400000) {
    throw new RangeError("Date range must be at most 366 days");
  }
  if (input.dateUnknown && (from || to))
    throw new RangeError(
      "Unknown-date filtering cannot be combined with date bounds",
    );
  const startFilter: Prisma.DateTimeNullableFilter = { not: null };
  if (to) startFilter.lte = to;
  const lower: Prisma.YoungEventWhereInput = from
    ? {
        OR: [{ [fields.end]: { gt: from } }, { [fields.start]: { gte: from } }],
      }
    : {};
  return {
    from,
    to,
    known: { AND: [{ [fields.start]: startFilter }, lower] },
    unknown: { [fields.start]: null },
    hasRange: from != null || to != null,
    timeBasis,
  };
}

function buildEventWhere(input: NormalizedYoungEventFilters) {
  const where: Prisma.YoungEventWhereInput = {};
  if (input.active != null) where.isActive = input.active;
  const category = input.category;
  if (category) where.category = category;
  const moduleFilter = input.module;
  if (moduleFilter) where.module = moduleFilter;
  const activityLevel = input.activityLevel;
  if (activityLevel) where.activityLevel = activityLevel;
  const search = input.search;
  if (search) where.name = { contains: search, mode: "insensitive" };
  const organizerId = input.organizerId;
  if (organizerId) where.organizerId = organizerId;
  return where;
}

export function buildYoungEventListQuery(input: YoungEventListInput) {
  const filters = normalizeYoungEventFilters(input);
  const baseWhere = input.tableFilters
    ? buildYoungTableWhere(input.tableFilters, input.tableStatusLabels)
    : buildEventWhere(filters);
  const dateRange = buildDateRangeWhere(input);
  const bothTimeBases =
    input.tableFilters != null &&
    (!input.tableFilters.timeBasis ||
      input.tableFilters.timeBasis.includes(","));
  const unknown: Prisma.YoungEventWhereInput = bothTimeBases
    ? { OR: [{ startAt: null }, { applyStartAt: null }] }
    : dateRange.unknown;
  const known: Prisma.YoungEventWhereInput = bothTimeBases
    ? { OR: [{ startAt: { not: null } }, { applyStartAt: { not: null } }] }
    : { NOT: dateRange.unknown };
  const where: Prisma.YoungEventWhereInput = input.dateUnknown
    ? { AND: [baseWhere, unknown] }
    : dateRange.hasRange
      ? { AND: [baseWhere, dateRange.known] }
      : input.dateUnknown === false
        ? { AND: [baseWhere, known] }
        : baseWhere;
  const unknownWhere: Prisma.YoungEventWhereInput = {
    AND: [baseWhere, unknown],
  };
  const dateOrderBy: Prisma.YoungEventOrderByWithRelationInput[] =
    dateRange.hasRange
      ? [
          {
            [dateRange.timeBasis === "registration"
              ? "applyStartAt"
              : "startAt"]: "asc" as const,
          },
          { youngId: "asc" as const },
        ]
      : [
          { isActive: "desc" as const },
          { startAt: { sort: "desc" as const, nulls: "last" as const } },
          { youngId: "asc" as const },
        ];

  return {
    where,
    unknownWhere,
    dateOrderBy,
    hasRange: dateRange.hasRange,
    filters,
    dateRange,
  };
}
