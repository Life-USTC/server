import { cachedCatalogRuntimeData } from "@/features/catalog/server/catalog-runtime-cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isRecord } from "@/lib/is-record";
import {
  buildPaginatedResponse,
  normalizePagination,
  type PaginatedResponse,
  type PaginationInput,
} from "@/lib/pagination";
import { getCanonicalOrigin } from "@/lib/site-url";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";
import {
  readYoungCalendarFacts,
  readYoungSyncedAt,
} from "./young-calendar-query";
import { renderYoungEventHtml } from "./young-event-html";
import { youngEventImageUrl } from "./young-event-image-service";
import { buildYoungEventListQuery } from "./young-event-query";

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

/** Public calendar facts shared by the grid, agenda, and personal conflict overlay. */
export type YoungCalendarEvent = Pick<
  YoungEventSummary,
  | "youngId"
  | "name"
  | "startAt"
  | "endAt"
  | "applyStartAt"
  | "applyEndAt"
  | "location"
  | "sourceMissing"
>;

export type YoungEventDetail = YoungEventSummary & {
  /** Sanitized upstream HTML with inline images pointed at our own proxy. */
  description: string | null;
  participationNotes: string | null;
  rawJson: Prisma.JsonValue;
};

export type YoungEventListInput = PaginationInput & {
  /** Validated Web table presentation filters; public API inputs stay unchanged. */
  tableFilters?: Record<string, string>;
  tableStatusLabels?: { statusOpen: string; statusClosed: string };
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
    imageUrl: record.imageUrl ? youngEventImageUrl(record.imageUrl) : null,
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

export async function getYoungSourceFreshness(): Promise<YoungSourceFreshness> {
  const syncedAt = await cachedCatalogRuntimeData(
    "catalog:young-source",
    "global",
    getCanonicalOrigin(),
    readYoungSyncedAt,
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
  const { where, unknownWhere, dateOrderBy, hasRange } =
    buildYoungEventListQuery(input);

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
          hasRange
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

type YoungCalendarInput = Pick<
  YoungEventListInput,
  | "active"
  | "category"
  | "module"
  | "activityLevel"
  | "search"
  | "organizerId"
  | "timeBasis"
> & {
  dateFrom: Date | string;
  dateTo: Date | string;
};

/** Read the complete visible range without repeating aggregates for each list page. */
export async function listYoungCalendarEvents(
  input: YoungCalendarInput,
): Promise<{
  data: YoungCalendarEvent[];
  unknownDateCount: number;
  source: YoungSourceFreshness;
}> {
  const query = buildYoungEventListQuery(input);
  const { where, unknownWhere, dateOrderBy } = query;
  const [result, source] = await Promise.all([
    cachedCatalogRuntimeData(
      "catalog:young-events-list",
      JSON.stringify({
        shape: "calendar-v1",
        where,
        unknownWhere,
        dateOrderBy,
      }),
      getCanonicalOrigin(),
      () => readYoungCalendarFacts(query),
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
