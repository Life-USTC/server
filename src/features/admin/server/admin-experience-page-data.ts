import { Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import {
  decodeAdminAuditCursor,
  encodeAdminAuditCursor,
} from "./admin-audit-page-data";

export const ADMIN_EXPERIENCE_DAYS = [7, 30, 90] as const;
export const ADMIN_EXPERIENCE_MAX_ROWS = 500;
export const ADMIN_EXPERIENCE_QUERY_LIMIT = ADMIN_EXPERIENCE_MAX_ROWS + 1;
export const ADMIN_EXPERIENCE_ERROR_LIMIT = 50;
export const ADMIN_EXPERIENCE_FEATURES = [
  "catalog.search",
  "catalog.course",
  "catalog.section",
  "catalog.teacher",
  "workspace.overview",
  "workspace.subscription",
  "workspace.homework",
  "community.section-homework",
] as const;
export const ADMIN_EXPERIENCE_PROTOCOLS = [
  "web",
  "rest",
  "graphql",
  "mcp",
] as const;
export const ADMIN_EXPERIENCE_SURFACES = ["web", "mcp", "unknown"] as const;
export const ADMIN_EXPERIENCE_AUTH_MODES = [
  "anonymous",
  "session",
  "oauth",
  "unknown",
] as const;
export const ADMIN_EXPERIENCE_OUTCOMES = [
  "success",
  "rejected",
  "error",
  "unknown",
] as const;
export const ADMIN_EXPERIENCE_ERROR_CLASSES = [
  "none",
  "invalid_input",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "dependency",
  "internal",
  "unknown",
] as const;

export const ADMIN_EXPERIENCE_OPERATIONS = [
  "view",
  "list",
  "get",
  "search",
  "match",
  "create",
  "update",
  "delete",
  "set_completion",
  "import",
  "batch",
] as const;
type Outcome = (typeof ADMIN_EXPERIENCE_OUTCOMES)[number];
type Protocol = (typeof ADMIN_EXPERIENCE_PROTOCOLS)[number];
type Surface = (typeof ADMIN_EXPERIENCE_SURFACES)[number];
type ErrorClass = (typeof ADMIN_EXPERIENCE_ERROR_CLASSES)[number];
export type AdminExperienceFilters = {
  authMode?: string;
  feature?: string;
  operation?: string;
  outcome?: Outcome;
  protocol?: Protocol;
  surface?: Surface;
  actor?: string;
};
export type AdminExperienceAggregateRow = {
  authMode: string;
  feature: string;
  operation: string;
  outcome: Outcome;
  protocol: Protocol;
  surface: Surface;
  total: number;
  errorCount: number;
  rejectedCount: number;
  unknownCount: number;
  p50WallMs: number | null;
  p95WallMs: number | null;
};
export type AdminExperienceDailyRow = {
  day: string;
  feature: string;
  operation: string;
  protocol: Protocol;
  total: number;
  errorCount: number;
  rejectedCount: number;
  unknownCount: number;
};
export type AdminExperienceErrorSample = {
  id: string;
  occurredAt: string;
  feature: string;
  operation: string;
  protocol: Protocol;
  surface: Surface;
  authMode: string;
  outcome: Outcome;
  errorClass: ErrorClass;
  requestId: string | null;
  userId: string | null;
  durationMs: number;
};
type ReadState =
  | { state: "ready" }
  | { state: "empty" }
  | { state: "unavailable"; reason: "query_failed" };

function parseDays(value: string | null): 7 | 30 | 90 {
  const days = Number(value);
  return days === 7 || days === 90 ? days : 30;
}
function enumFilter<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
export function parseAdminExperienceFilters(url: URL): AdminExperienceFilters {
  return {
    authMode: enumFilter(
      url.searchParams.get("authMode"),
      ADMIN_EXPERIENCE_AUTH_MODES,
    ),
    feature: enumFilter(
      url.searchParams.get("feature"),
      ADMIN_EXPERIENCE_FEATURES,
    ),
    operation: enumFilter(
      url.searchParams.get("operation"),
      ADMIN_EXPERIENCE_OPERATIONS,
    ),
    outcome: enumFilter(
      url.searchParams.get("outcome"),
      ADMIN_EXPERIENCE_OUTCOMES,
    ),
    protocol: enumFilter(
      url.searchParams.get("protocol"),
      ADMIN_EXPERIENCE_PROTOCOLS,
    ),
    surface: enumFilter(
      url.searchParams.get("surface"),
      ADMIN_EXPERIENCE_SURFACES,
    ),
  };
}
export function buildAdminExperienceWindow(
  days: 7 | 30 | 90,
  now = new Date(),
) {
  const today = shanghaiDayjs(now).startOf("day");
  const from = today.subtract(days - 1, "day");
  return {
    days,
    fromDay: from.format("YYYY-MM-DD"),
    toDay: today.add(1, "day").format("YYYY-MM-DD"),
    fromTimestamp: from.toDate().toISOString(),
    toTimestamp: now.toISOString(),
    nowTimestamp: now.toISOString(),
  };
}
type Window = ReturnType<typeof buildAdminExperienceWindow>;
function catalog() {
  return {
    features: ADMIN_EXPERIENCE_FEATURES,
    protocols: ADMIN_EXPERIENCE_PROTOCOLS,
    surfaces: ADMIN_EXPERIENCE_SURFACES,
    authModes: ADMIN_EXPERIENCE_AUTH_MODES,
    outcomes: ADMIN_EXPERIENCE_OUTCOMES,
    errorClasses: ADMIN_EXPERIENCE_ERROR_CLASSES,
    operations: ADMIN_EXPERIENCE_OPERATIONS,
  };
}
function coverage(window: Window, firstRecordedAt: string | null) {
  return {
    fromDay: window.fromDay,
    endDayExclusive: window.toDay,
    includesToday: true as const,
    sampling: "recorded" as const,
    timezone: "Asia/Shanghai" as const,
    firstRecordedAt,
  };
}
export function featureEventWhere(
  filters: AdminExperienceFilters,
  window: Window,
) {
  const parts = [
    Prisma.sql`"occurredAt" >= ${new Date(window.fromTimestamp)}`,
    Prisma.sql`"occurredAt" <= ${new Date(window.toTimestamp)}`,
  ];
  if (filters.feature) parts.push(Prisma.sql`"feature" = ${filters.feature}`);
  if (filters.operation)
    parts.push(Prisma.sql`"operation" = ${filters.operation}`);
  if (filters.protocol)
    parts.push(Prisma.sql`"protocol" = ${filters.protocol}`);
  if (filters.surface) parts.push(Prisma.sql`"surface" = ${filters.surface}`);
  if (filters.authMode)
    parts.push(Prisma.sql`"authMode" = ${filters.authMode}`);
  if (filters.outcome) parts.push(Prisma.sql`"outcome" = ${filters.outcome}`);
  if (filters.actor) parts.push(Prisma.sql`"userId" = ${filters.actor}`);
  return Prisma.join(parts, " AND ");
}
const daySql = Prisma.sql`to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`;
const countsSql = Prisma.sql`count(*)::int AS "total", count(*) FILTER (WHERE outcome = 'error')::int AS "errorCount", count(*) FILTER (WHERE outcome = 'rejected')::int AS "rejectedCount", count(*) FILTER (WHERE outcome = 'unknown')::int AS "unknownCount"`;
const issueSql = Prisma.sql`outcome IN ('error', 'rejected', 'unknown') AND "errorClass" <> 'none'`;
const zeroSummary = {
  total: 0,
  errors: 0,
  rejected: 0,
  unknown: 0,
  activeUsers: 0,
};
async function firstRecorded(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<Array<{ first: Date | null }>>(
    Prisma.sql`SELECT min("occurredAt") AS first FROM public."FeatureOperationEvent"`,
  );
  return row?.first?.toISOString() ?? null;
}

export async function readAdminFeatureTelemetry(
  adminId: string,
  url: URL,
  options: { now?: Date } = {},
) {
  const days = parseDays(url.searchParams.get("days"));
  const filters = parseAdminExperienceFilters(url);
  const window = buildAdminExperienceWindow(days, options.now);
  const where = featureEventWhere(filters, window);
  const base = { catalog: catalog(), days, filters, window };
  try {
    const result = await withUserDbContext(adminId, async (tx) => {
      const [rows, daily, totals, first] = await Promise.all([
        tx.$queryRaw<AdminExperienceAggregateRow[]>(
          Prisma.sql`SELECT feature,operation,protocol,surface,"authMode",outcome, ${countsSql}, percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") AS "p50WallMs", percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS "p95WallMs" FROM public."FeatureOperationEvent" WHERE ${where} GROUP BY feature,operation,protocol,surface,"authMode",outcome ORDER BY total DESC,feature,operation,protocol,surface,"authMode",outcome LIMIT ${ADMIN_EXPERIENCE_QUERY_LIMIT}`,
        ),
        tx.$queryRaw<AdminExperienceDailyRow[]>(
          Prisma.sql`SELECT ${daySql} AS day,feature,operation,protocol,${countsSql} FROM public."FeatureOperationEvent" WHERE ${where} GROUP BY day,feature,operation,protocol ORDER BY day,feature,operation,protocol`,
        ),
        tx.$queryRaw<Array<typeof zeroSummary>>(
          Prisma.sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE outcome='error')::int AS errors, count(*) FILTER (WHERE outcome='rejected')::int AS rejected, count(*) FILTER (WHERE outcome='unknown')::int AS unknown,count(DISTINCT "userId")::int AS "activeUsers" FROM public."FeatureOperationEvent" WHERE ${where}`,
        ),
        firstRecorded(tx),
      ]);
      return {
        rows: rows.slice(0, ADMIN_EXPERIENCE_MAX_ROWS),
        rowsTruncated: rows.length > ADMIN_EXPERIENCE_MAX_ROWS,
        daily,
        summary: totals[0] ?? zeroSummary,
        coverage: coverage(window, first),
      };
    });
    return {
      ...base,
      ...result,
      status: { state: result.summary.total ? "ready" : "empty" } as ReadState,
    };
  } catch {
    return {
      ...base,
      coverage: coverage(window, null),
      rows: [] as AdminExperienceAggregateRow[],
      rowsTruncated: false,
      daily: [] as AdminExperienceDailyRow[],
      summary: zeroSummary,
      status: { state: "unavailable", reason: "query_failed" } as ReadState,
    };
  }
}

type IssueGroup = {
  feature: string;
  operation: string;
  protocol: Protocol;
  errorClass: ErrorClass;
  outcome: Outcome;
  count: number;
  lastSeen: string;
};
type IssueDaily = {
  day: string;
  total: number;
  errorCount: number;
  rejectedCount: number;
  unknownCount: number;
};
type RuntimeIssue = {
  id: string;
  occurredAt: string;
  level: string;
  event: string;
  route: string | null;
  status: number | null;
  requestId: string | null;
};
export async function readAdminFeatureIssues(
  adminId: string,
  url: URL,
  options: { now?: Date } = {},
) {
  const days = parseDays(url.searchParams.get("issue_days"));
  const filterUrl = new URL(url);
  filterUrl.search = "";
  for (const key of ["feature", "protocol", "operation", "outcome"]) {
    const value = url.searchParams.get(`issue_${key}`);
    if (value) filterUrl.searchParams.set(key, value);
  }
  const filters = parseAdminExperienceFilters(filterUrl);
  const actor = url.searchParams.get("issue_actor");
  if (actor && actor.length <= 128 && !/[\x00-\x1f]/.test(actor))
    filters.actor = actor;
  const view = url.searchParams.get("issue_view") === "all" ? "all" : "issues";
  const cursor = decodeAdminAuditCursor(
    url.searchParams.get("issue_cursor") ?? undefined,
  );
  const window = buildAdminExperienceWindow(days, options.now);
  const where = Prisma.sql`${featureEventWhere(filters, window)} ${view === "issues" ? Prisma.sql`AND ${issueSql}` : Prisma.empty}`;
  // UUID event IDs give deterministic ordering for events with equal timestamps.
  const validCursor =
    cursor && /^[0-9a-f-]{36}$/i.test(cursor.id) ? cursor : null;
  const cursorWhere = validCursor
    ? Prisma.sql`AND ("occurredAt",id) < (${validCursor.createdAt}, ${validCursor.id})`
    : Prisma.empty;
  const base = { catalog: catalog(), days, filters, window, view };
  try {
    const result = await withUserDbContext(adminId, async (tx) => {
      const [events, groups, daily, totals, runtime, first] = await Promise.all(
        [
          tx.$queryRaw<
            Array<
              Omit<AdminExperienceErrorSample, "occurredAt"> & {
                occurredAt: Date;
              }
            >
          >(
            Prisma.sql`SELECT id,"occurredAt",feature,operation,protocol,surface,"authMode",outcome,"errorClass","requestId","userId","durationMs" FROM public."FeatureOperationEvent" WHERE ${where} ${cursorWhere} ORDER BY "occurredAt" DESC,id DESC LIMIT ${ADMIN_EXPERIENCE_ERROR_LIMIT + 1}`,
          ),
          tx.$queryRaw<
            Array<Omit<IssueGroup, "lastSeen"> & { lastSeen: Date }>
          >(
            Prisma.sql`SELECT feature,operation,protocol,"errorClass",outcome,count(*)::int AS count,max("occurredAt") AS "lastSeen" FROM public."FeatureOperationEvent" WHERE ${where} AND ${issueSql} GROUP BY feature,operation,protocol,"errorClass",outcome ORDER BY count DESC,feature,operation,protocol,"errorClass",outcome LIMIT 12`,
          ),
          tx.$queryRaw<IssueDaily[]>(
            Prisma.sql`SELECT ${daySql} AS day,${countsSql} FROM public."FeatureOperationEvent" WHERE ${where} GROUP BY day ORDER BY day`,
          ),
          tx.$queryRaw<Array<typeof zeroSummary>>(
            Prisma.sql`SELECT count(*)::int AS total,count(*) FILTER (WHERE outcome='error')::int AS errors,count(*) FILTER (WHERE outcome='rejected')::int AS rejected,count(*) FILTER (WHERE outcome='unknown')::int AS unknown FROM public."FeatureOperationEvent" WHERE ${where}`,
          ),
          tx.$queryRaw<
            Array<Omit<RuntimeIssue, "occurredAt"> & { occurredAt: Date }>
          >(
            Prisma.sql`SELECT id,"occurredAt",level,event,route,status,"requestId" FROM public."RuntimeIssueEvent" WHERE "occurredAt">=${new Date(window.fromTimestamp)} AND "occurredAt"<=${new Date(window.toTimestamp)} ORDER BY "occurredAt" DESC,id DESC LIMIT 20`,
          ),
          firstRecorded(tx),
        ],
      );
      const errorSamples = events
        .slice(0, ADMIN_EXPERIENCE_ERROR_LIMIT)
        .map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() }));
      const last = events[ADMIN_EXPERIENCE_ERROR_LIMIT - 1];
      return {
        errorSamples,
        errorsTruncated: events.length > ADMIN_EXPERIENCE_ERROR_LIMIT,
        nextCursor:
          events.length > ADMIN_EXPERIENCE_ERROR_LIMIT && last
            ? encodeAdminAuditCursor({
                createdAt: last.occurredAt,
                id: last.id,
              })
            : null,
        groups: groups.map((row) => ({
          ...row,
          lastSeen: row.lastSeen.toISOString(),
        })),
        daily,
        summary: totals[0] ?? zeroSummary,
        runtimeIssues: runtime.map((row) => ({
          ...row,
          occurredAt: row.occurredAt.toISOString(),
        })),
        coverage: coverage(window, first),
      };
    });
    return {
      ...base,
      ...result,
      errorsStatus: {
        state:
          result.summary.total || result.runtimeIssues.length
            ? "ready"
            : "empty",
      } as ReadState,
    };
  } catch {
    return {
      ...base,
      coverage: coverage(window, null),
      errorSamples: [] as AdminExperienceErrorSample[],
      errorsTruncated: false,
      nextCursor: null,
      groups: [] as IssueGroup[],
      daily: [] as IssueDaily[],
      summary: zeroSummary,
      runtimeIssues: [] as RuntimeIssue[],
      errorsStatus: {
        state: "unavailable",
        reason: "query_failed",
      } as ReadState,
    };
  }
}
