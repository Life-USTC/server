import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponse,
  type PaginationInput,
} from "@/lib/pagination";
import { parseDateInput } from "@/lib/time/parse-date-input";
import {
  endOfShanghaiDay,
  formatShanghaiTimestamp,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";

export type YoungEventTimeBasis = "activity" | "registration";

export type YoungSourceFreshness = {
  status: "fresh" | "stale" | "unknown";
  lastSyncedAt: string | null;
};

export type YoungEventSummary = {
  youngId: string;
  name: string;
  category: string | null;
  department: string | null;
  organizer: string | null;
  organizerId: string | null;
  status: string | null;
  registrationStatus: string | null;
  location: string | null;
  imageUrl: string | null;
  hours: number | null;
  capacity: number | null;
  appliedCount: number | null;
  startAt: string | null;
  endAt: string | null;
  applyStartAt: string | null;
  applyEndAt: string | null;
  isActive: boolean;
  sourceMissing: boolean;
  lastSeenAt: string | null;
  createdAt: string | null;
};

export type YoungEventDetail = YoungEventSummary & {
  rawJson: Prisma.JsonValue;
};

export type YoungEventListInput = PaginationInput & {
  active?: boolean | null;
  category?: string | null;
  search?: string | null;
  organizerId?: string | null;
  dateFrom?: Date | string | null;
  dateTo?: Date | string | null;
  timeBasis?: YoungEventTimeBasis | null;
};

export type YoungEventPage = PaginatedResponse<YoungEventSummary> & {
  /** Events without both endpoints for the selected time basis. */
  unknownDates: YoungEventSummary[];
  source: YoungSourceFreshness;
};

export type YoungOrganizerSummary = {
  id: string;
  name: string;
  normalizedName: string;
  activeEvents: YoungEventSummary[];
  upcomingEvents: YoungEventSummary[];
  historyEvents: YoungEventSummary[];
  activeCount: number;
  upcomingCount: number;
  historyCount: number;
};

export type YoungOrganizerListInput = PaginationInput & {
  search?: string | null;
};

export const YOUNG_EVENT_SELECT = {
  youngId: true,
  name: true,
  category: true,
  department: true,
  organizer: true,
  organizerId: true,
  status: true,
  registrationStatus: true,
  location: true,
  imageUrl: true,
  hours: true,
  capacity: true,
  appliedCount: true,
  startAt: true,
  endAt: true,
  applyStartAt: true,
  applyEndAt: true,
  isActive: true,
  sourceMissing: true,
  lastSeenAt: true,
  createdAt: true,
} satisfies Prisma.YoungEventSelect;

type YoungEventRecord = Prisma.YoungEventGetPayload<{
  select: typeof YOUNG_EVENT_SELECT;
}>;

type YoungOrganizerRecord = {
  id: string;
  name: string;
  normalizedName: string;
};

const YOUNG_SOURCE_STALE_AFTER_MS = 36 * 60 * 60 * 1_000;

function toShanghaiIso(date: Date | null | undefined): string | null {
  return date == null ? null : formatShanghaiTimestamp(date);
}

/**
 * Local cache-aside proxy for the upstream poster image. The database stores
 * the raw young.ustc.edu.cn `pic` path; the public field points at our own
 * origin so clients never resolve the relative path against us directly.
 */
export function youngEventImageUrl(youngId: string) {
  return `/api/catalog/young-events/${youngId}/image`;
}

export function toYoungEventSummary(
  record: YoungEventRecord,
): YoungEventSummary {
  return {
    youngId: record.youngId,
    name: record.name,
    category: record.category,
    department: record.department,
    organizer: record.organizer,
    organizerId: record.organizerId,
    status: record.status,
    registrationStatus: record.registrationStatus,
    location: record.location,
    imageUrl: record.imageUrl ? youngEventImageUrl(record.youngId) : null,
    hours: record.hours,
    capacity: record.capacity,
    appliedCount: record.appliedCount,
    startAt: toShanghaiIso(record.startAt),
    endAt: toShanghaiIso(record.endAt),
    applyStartAt: toShanghaiIso(record.applyStartAt),
    applyEndAt: toShanghaiIso(record.applyEndAt),
    isActive: record.isActive,
    sourceMissing: record.sourceMissing,
    lastSeenAt: toShanghaiIso(record.lastSeenAt),
    createdAt: toShanghaiIso(record.createdAt),
  };
}

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
} {
  const timeBasis = input.timeBasis ?? "activity";
  const fields = eventDateField(timeBasis);
  const from = parseYoungDateBoundary(input.dateFrom, "from");
  const to = parseYoungDateBoundary(input.dateTo, "to");
  if (from && to && from.getTime() > to.getTime()) {
    throw new RangeError("dateFrom must be before or equal to dateTo");
  }

  const hasRange = from != null || to != null;
  const startFilter: Prisma.DateTimeNullableFilter = { not: null };
  const endFilter: Prisma.DateTimeNullableFilter = { not: null };
  if (to != null) startFilter.lte = to;
  if (from != null) endFilter.gte = from;

  return {
    known: {
      [fields.start]: startFilter,
      [fields.end]: endFilter,
    },
    unknown: {
      OR: [{ [fields.start]: null }, { [fields.end]: null }],
    },
    hasRange,
    timeBasis,
  };
}

function buildEventWhere(input: YoungEventListInput) {
  const where: Prisma.YoungEventWhereInput = {};
  if (input.active != null) where.isActive = input.active;
  const category = input.category?.trim();
  if (category) where.category = category;
  const search = input.search?.trim();
  if (search) where.name = { contains: search, mode: "insensitive" };
  const organizerId = input.organizerId?.trim();
  if (organizerId) where.organizerId = organizerId;
  return where;
}

export async function getYoungSourceFreshness(): Promise<YoungSourceFreshness> {
  const row = await prisma.staticImportState.findUnique({
    where: { id: "global" },
    select: { snapshotGeneratedAt: true },
  });
  if (!row) return { status: "unknown", lastSyncedAt: null };
  const lastSyncedAt = toShanghaiIso(row.snapshotGeneratedAt);
  return {
    status:
      Date.now() - row.snapshotGeneratedAt.getTime() <=
      YOUNG_SOURCE_STALE_AFTER_MS
        ? "fresh"
        : "stale",
    lastSyncedAt,
  };
}

export async function listYoungEvents(
  input: YoungEventListInput = {},
): Promise<YoungEventPage> {
  const { page, pageSize, skip } = normalizePagination(input);
  const baseWhere = buildEventWhere(input);
  const dateRange = buildDateRangeWhere(input);
  const where: Prisma.YoungEventWhereInput = dateRange.hasRange
    ? { AND: [baseWhere, dateRange.known] }
    : baseWhere;
  const unknownWhere: Prisma.YoungEventWhereInput = {
    AND: [baseWhere, dateRange.unknown],
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

  const [total, records, unknownRecords, source] = await Promise.all([
    prisma.youngEvent.count({ where }),
    prisma.youngEvent.findMany({
      where,
      select: YOUNG_EVENT_SELECT,
      orderBy: dateOrderBy,
      skip,
      take: pageSize,
    }),
    dateRange.hasRange
      ? prisma.youngEvent.findMany({
          where: unknownWhere,
          select: YOUNG_EVENT_SELECT,
          orderBy: [{ youngId: "asc" }],
        })
      : Promise.resolve([] as YoungEventRecord[]),
    getYoungSourceFreshness(),
  ]);

  return {
    ...buildPaginatedResponse(
      records.map(toYoungEventSummary),
      page,
      pageSize,
      total,
    ),
    unknownDates: unknownRecords.map(toYoungEventSummary),
    source,
  };
}

export async function getYoungEvent(
  youngId: string,
): Promise<YoungEventDetail | null> {
  const record = await prisma.youngEvent.findUnique({
    where: { youngId },
    select: { ...YOUNG_EVENT_SELECT, rawJson: true },
  });
  if (record == null) return null;
  const { rawJson, ...summaryRecord } = record;
  return { ...toYoungEventSummary(summaryRecord), rawJson };
}

export async function listYoungEventCategories(): Promise<string[]> {
  const rows = await prisma.youngEvent.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows
    .map((row) => row.category)
    .filter((category): category is string => category != null);
}

function classifyOrganizerEvents(
  events: YoungEventSummary[],
  now = new Date(),
) {
  const activeEvents: YoungEventSummary[] = [];
  const upcomingEvents: YoungEventSummary[] = [];
  const historyEvents: YoungEventSummary[] = [];

  for (const event of events) {
    if (event.isActive) {
      activeEvents.push(event);
      continue;
    }
    const start = event.startAt ? new Date(event.startAt).getTime() : null;
    const end = event.endAt ? new Date(event.endAt).getTime() : null;
    if (end != null && end < now.getTime()) {
      historyEvents.push(event);
    } else if (start != null && start >= now.getTime()) {
      upcomingEvents.push(event);
    } else if (start != null || end != null) {
      // An event with a known partial interval is still discoverable in the
      // forward-facing organizer view; its date remains visible as supplied.
      upcomingEvents.push(event);
    } else {
      historyEvents.push(event);
    }
  }

  const byStart = (left: YoungEventSummary, right: YoungEventSummary) =>
    (left.startAt ?? "").localeCompare(right.startAt ?? "") ||
    left.youngId.localeCompare(right.youngId);
  upcomingEvents.sort(byStart);
  activeEvents.sort(byStart);
  historyEvents.sort((left, right) => byStart(right, left));
  return { activeEvents, upcomingEvents, historyEvents };
}

function toYoungOrganizerSummary(
  organizer: YoungOrganizerRecord,
  events: YoungEventSummary[],
): YoungOrganizerSummary {
  const classified = classifyOrganizerEvents(events);
  return {
    ...organizer,
    ...classified,
    activeCount: classified.activeEvents.length,
    upcomingCount: classified.upcomingEvents.length,
    historyCount: classified.historyEvents.length,
  };
}

async function loadOrganizerEvents(organizerIds: string[]) {
  if (organizerIds.length === 0) return new Map<string, YoungEventSummary[]>();
  const rows = await prisma.youngEvent.findMany({
    where: { organizerId: { in: organizerIds } },
    select: YOUNG_EVENT_SELECT,
    orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { youngId: "asc" }],
  });
  const grouped = new Map<string, YoungEventSummary[]>();
  for (const row of rows) {
    if (!row.organizerId) continue;
    const events = grouped.get(row.organizerId) ?? [];
    events.push(toYoungEventSummary(row));
    grouped.set(row.organizerId, events);
  }
  return grouped;
}

export async function listYoungOrganizers(
  input: YoungOrganizerListInput = {},
): Promise<PaginatedResponse<YoungOrganizerSummary>> {
  const { page, pageSize, skip } = normalizePagination(input);
  const search = input.search?.trim();
  const where = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};
  const [total, organizers] = await Promise.all([
    prisma.youngOrganizer.count({ where }),
    prisma.youngOrganizer.findMany({
      where,
      select: { id: true, name: true, normalizedName: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);
  const events = await loadOrganizerEvents(organizers.map(({ id }) => id));
  return buildPaginatedResponse(
    organizers.map((organizer) =>
      toYoungOrganizerSummary(organizer, events.get(organizer.id) ?? []),
    ),
    page,
    pageSize,
    total,
  );
}

export async function getYoungOrganizer(
  organizerId: string,
): Promise<YoungOrganizerSummary | null> {
  const organizer = await prisma.youngOrganizer.findUnique({
    where: { id: organizerId },
    select: { id: true, name: true, normalizedName: true },
  });
  if (!organizer) return null;
  const events = await loadOrganizerEvents([organizer.id]);
  return toYoungOrganizerSummary(organizer, events.get(organizer.id) ?? []);
}
