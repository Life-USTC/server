import type { Prisma } from "@/generated/prisma/client";
import { cachedCatalogRuntimeData } from "@/lib/catalog-runtime-cache";
import { prisma } from "@/lib/db/prisma";
import { isRecord } from "@/lib/is-record";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponse,
  type PaginationInput,
} from "@/lib/pagination";
import { getCanonicalOrigin } from "@/lib/site-url";
import { parseDateInput } from "@/lib/time/parse-date-input";
import {
  endOfShanghaiDay,
  formatShanghaiTimestamp,
  startOfShanghaiDay,
} from "@/lib/time/shanghai-format";
import { renderYoungEventHtml } from "./young-event-html";

export type YoungEventTimeBasis = "activity" | "registration";

export type YoungSourceFreshness = {
  status: "fresh" | "stale" | "unknown";
  lastSyncedAt: string | null;
};

/** One scheduled venue slot as recorded upstream (times are raw local text). */
export type YoungEventPlace = {
  placeInfo: string | null;
  placeSt: string | null;
  placeEt: string | null;
};

export type YoungEventSummary = {
  youngId: string;
  name: string;
  category: string | null;
  department: string | null;
  organizer: string | null;
  organizerId: string | null;
  status: string | null;
  activityStatusCode: string | null;
  signupStatusCode: string | null;
  requiresSignup: boolean | null;
  categoryCode: string | null;
  moduleCode: string | null;
  formCode: string | null;
  activityLevelCode: string | null;
  departmentId: string | null;
  upstreamOrganizerIds: string[];
  upstreamSponsorIds: string[];
  tagIds: string[];
  signupScopeCode: string | null;
  signupDepartmentIds: string[];
  requiresSignupInfo: boolean | null;
  allowedAttachmentTypes: string[];
  isOnline: boolean | null;
  onlineMeetingInfo: string | null;
  externalSponsor: string | null;
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
  activityLevel: string | null;
  module: string | null;
  form: string | null;
  grades: string | null;
  sponsor: string | null;
  contactName: string | null;
  contactTel: string | null;
  duration: number | null;
  serviceHour: number | null;
  sumHours: number | null;
  sumPersons: number | null;
  partakeNum: number | null;
  favCount: number | null;
  limitNum: number | null;
  createdAtUpstream: string | null;
  auditedAt: string | null;
  updatedAtUpstream: string | null;
  places: YoungEventPlace[] | null;
};

export type YoungEventDetail = YoungEventSummary & {
  /** Sanitized upstream HTML with inline images pointed at our own proxy. */
  description: string | null;
  participationNotes: string | null;
  rawJson: Prisma.JsonValue;
};

export type YoungEventListInput = PaginationInput & {
  active?: boolean | null;
  dateUnknown?: boolean | null;
  category?: string | null;
  module?: string | null;
  activityLevel?: string | null;
  search?: string | null;
  organizerId?: string | null;
  dateFrom?: Date | string | null;
  dateTo?: Date | string | null;
  timeBasis?: YoungEventTimeBasis | null;
};

export type YoungEventPage = PaginatedResponse<YoungEventSummary> & {
  /** Missing starts are discoverable through the paginated dateUnknown filter. */
  unknownDateCount: number;
  source: YoungSourceFreshness;
};

export type {
  YoungOrganizerListInput,
  YoungOrganizerSummary,
} from "./young-organizer-service";
export {
  getYoungOrganizer,
  listYoungOrganizers,
} from "./young-organizer-service";

export const YOUNG_EVENT_SELECT = {
  youngId: true,
  name: true,
  category: true,
  department: true,
  organizer: true,
  organizerId: true,
  status: true,
  activityStatusCode: true,
  signupStatusCode: true,
  requiresSignup: true,
  categoryCode: true,
  moduleCode: true,
  formCode: true,
  activityLevelCode: true,
  departmentId: true,
  upstreamOrganizerIds: true,
  upstreamSponsorIds: true,
  tagIds: true,
  signupScopeCode: true,
  signupDepartmentIds: true,
  requiresSignupInfo: true,
  allowedAttachmentTypes: true,
  isOnline: true,
  onlineMeetingInfo: true,
  externalSponsor: true,
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
  activityLevel: true,
  module: true,
  form: true,
  grades: true,
  sponsor: true,
  contactName: true,
  contactTel: true,
  duration: true,
  serviceHour: true,
  sumHours: true,
  sumPersons: true,
  partakeNum: true,
  favCount: true,
  limitNum: true,
  createdAtUpstream: true,
  auditedAt: true,
  updatedAtUpstream: true,
  places: true,
} satisfies Prisma.YoungEventSelect;

type YoungEventRecord = Prisma.YoungEventGetPayload<{
  select: typeof YOUNG_EVENT_SELECT;
}>;

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

/** The places column is upstream-shaped JSON, so narrow it before exposing it. */
function toYoungEventPlaces(
  value: Prisma.JsonValue | null,
): YoungEventPlace[] | null {
  if (!Array.isArray(value)) return null;
  const places: YoungEventPlace[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const place = {
      placeInfo: typeof item.placeInfo === "string" ? item.placeInfo : null,
      placeSt: typeof item.placeSt === "string" ? item.placeSt : null,
      placeEt: typeof item.placeEt === "string" ? item.placeEt : null,
    };
    if (place.placeInfo == null && place.placeSt == null) continue;
    places.push(place);
  }
  return places.length > 0 ? places : null;
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
    activityStatusCode: record.activityStatusCode,
    signupStatusCode: record.signupStatusCode,
    requiresSignup: record.requiresSignup,
    categoryCode: record.categoryCode,
    moduleCode: record.moduleCode,
    formCode: record.formCode,
    activityLevelCode: record.activityLevelCode,
    departmentId: record.departmentId,
    upstreamOrganizerIds: record.upstreamOrganizerIds,
    upstreamSponsorIds: record.upstreamSponsorIds,
    tagIds: record.tagIds,
    signupScopeCode: record.signupScopeCode,
    signupDepartmentIds: record.signupDepartmentIds,
    requiresSignupInfo: record.requiresSignupInfo,
    allowedAttachmentTypes: record.allowedAttachmentTypes,
    isOnline: record.isOnline,
    onlineMeetingInfo: record.onlineMeetingInfo,
    externalSponsor: record.externalSponsor,
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
    activityLevel: record.activityLevel,
    module: record.module,
    form: record.form,
    grades: record.grades,
    sponsor: record.sponsor,
    contactName: record.contactName,
    contactTel: record.contactTel,
    duration: record.duration,
    serviceHour: record.serviceHour,
    sumHours: record.sumHours,
    sumPersons: record.sumPersons,
    partakeNum: record.partakeNum,
    favCount: record.favCount,
    limitNum: record.limitNum,
    createdAtUpstream: toShanghaiIso(record.createdAtUpstream),
    auditedAt: toShanghaiIso(record.auditedAt),
    updatedAtUpstream: toShanghaiIso(record.updatedAtUpstream),
    places: toYoungEventPlaces(record.places),
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
    known: { AND: [{ [fields.start]: startFilter }, lower] },
    unknown: { [fields.start]: null },
    hasRange: from != null || to != null,
    timeBasis,
  };
}

function buildEventWhere(input: YoungEventListInput) {
  const where: Prisma.YoungEventWhereInput = {};
  if (input.active != null) where.isActive = input.active;
  const category = input.category?.trim();
  if (category) where.category = category;
  const moduleFilter = input.module?.trim();
  if (moduleFilter) where.module = moduleFilter;
  const activityLevel = input.activityLevel?.trim();
  if (activityLevel) where.activityLevel = activityLevel;
  const search = input.search?.trim();
  if (search) where.name = { contains: search, mode: "insensitive" };
  const organizerId = input.organizerId?.trim();
  if (organizerId) where.organizerId = organizerId;
  return where;
}

export async function getYoungSourceFreshness(): Promise<YoungSourceFreshness> {
  const syncedAt = await cachedCatalogRuntimeData(
    "catalog:young-source",
    "global",
    getCanonicalOrigin(),
    async () => {
      const row = await prisma.staticImportState.findUnique({
        where: { id: "global" },
        select: { youngSyncedAt: true },
      });
      return row?.youngSyncedAt?.getTime() ?? null;
    },
  );
  if (syncedAt == null) return { status: "unknown", lastSyncedAt: null };
  const lastSyncedAt = toShanghaiIso(new Date(syncedAt));
  return {
    status:
      Date.now() - syncedAt <= YOUNG_SOURCE_STALE_AFTER_MS ? "fresh" : "stale",
    lastSyncedAt,
  };
}

export async function listYoungEvents(
  input: YoungEventListInput = {},
): Promise<YoungEventPage> {
  const { page, pageSize, skip } = normalizePagination(input);
  const baseWhere = buildEventWhere(input);
  const dateRange = buildDateRangeWhere(input);
  const where: Prisma.YoungEventWhereInput = input.dateUnknown
    ? { AND: [baseWhere, dateRange.unknown] }
    : dateRange.hasRange
      ? { AND: [baseWhere, dateRange.known] }
      : input.dateUnknown === false
        ? { AND: [baseWhere, { NOT: dateRange.unknown }] }
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

  const [result, source] = await Promise.all([
    cachedCatalogRuntimeData(
      "catalog:young-events-list",
      JSON.stringify({ where, unknownWhere, dateOrderBy, page, pageSize }),
      getCanonicalOrigin(),
      async () => {
        const [total, records, unknownDateCount] = await Promise.all([
          prisma.youngEvent.count({ where }),
          prisma.youngEvent.findMany({
            where,
            select: YOUNG_EVENT_SELECT,
            orderBy: dateOrderBy,
            skip,
            take: pageSize,
          }),
          dateRange.hasRange
            ? prisma.youngEvent.count({ where: unknownWhere })
            : Promise.resolve(0),
        ]);
        return {
          ...buildPaginatedResponse(
            records.map(toYoungEventSummary),
            page,
            pageSize,
            total,
          ),
          unknownDateCount,
        };
      },
    ),
    getYoungSourceFreshness(),
  ]);
  return { ...result, source };
}

export async function getYoungEvent(
  youngId: string,
): Promise<YoungEventDetail | null> {
  return cachedCatalogRuntimeData(
    "catalog:young-event-detail",
    youngId,
    getCanonicalOrigin(),
    async () => {
      const record = await prisma.youngEvent.findUnique({
        where: { youngId },
        select: {
          ...YOUNG_EVENT_SELECT,
          rawJson: true,
          description: true,
          participationNotes: true,
        },
      });
      if (record == null) return null;
      const { rawJson, description, participationNotes, ...summaryRecord } =
        record;
      return {
        ...toYoungEventSummary(summaryRecord),
        // The column holds the upstream HTML verbatim; sanitizing and image
        // rewriting belong here, at the edge every interface shares.
        description:
          description == null ? null : renderYoungEventHtml(description),
        participationNotes:
          participationNotes == null
            ? null
            : renderYoungEventHtml(participationNotes),
        rawJson,
      };
    },
    { shouldCacheResult: (result) => result != null },
  );
}

export async function listYoungEventCategories(): Promise<string[]> {
  return cachedCatalogRuntimeData(
    "catalog:young-event-categories",
    "all",
    getCanonicalOrigin(),
    async () => {
      const rows = await prisma.youngEvent.findMany({
        where: { category: { not: null } },
        select: { category: true },
        distinct: ["category"],
        orderBy: { category: "asc" },
      });
      return rows
        .map((row) => row.category)
        .filter((category): category is string => category != null);
    },
  );
}
