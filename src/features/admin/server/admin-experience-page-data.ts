import {
  CLOUDFLARE_ANALYTICS_DATASET,
  type CloudflareAnalyticsReadPort,
  CloudflareAnalyticsReadUnavailableError,
  getCloudflareAnalyticsReadPort,
} from "@/lib/ports/analytics";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { requireAdminPage } from "./admin-page-auth";

export const ADMIN_EXPERIENCE_DAYS = [7, 30, 90] as const;
export const ADMIN_EXPERIENCE_MAX_ROWS = 500;
export const ADMIN_EXPERIENCE_QUERY_LIMIT = ADMIN_EXPERIENCE_MAX_ROWS + 1;
export const ADMIN_EXPERIENCE_ERROR_LIMIT = 20;
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

type ValueOf<T extends readonly string[]> = T[number];

export type AdminExperienceFilters = {
  authMode?: ValueOf<typeof ADMIN_EXPERIENCE_AUTH_MODES>;
  feature?: ValueOf<typeof ADMIN_EXPERIENCE_FEATURES>;
  operation?: string;
  outcome?: ValueOf<typeof ADMIN_EXPERIENCE_OUTCOMES>;
  protocol?: ValueOf<typeof ADMIN_EXPERIENCE_PROTOCOLS>;
  surface?: ValueOf<typeof ADMIN_EXPERIENCE_SURFACES>;
};

export type AdminExperienceAggregateRow = {
  authMode: string;
  errorCount: number;
  feature: string;
  operation: string;
  outcome: ValueOf<typeof ADMIN_EXPERIENCE_OUTCOMES>;
  p50WallMs: number | null;
  p95WallMs: number | null;
  protocol: ValueOf<typeof ADMIN_EXPERIENCE_PROTOCOLS>;
  rejectedCount: number;
  surface: ValueOf<typeof ADMIN_EXPERIENCE_SURFACES>;
  total: number;
  unknownCount: number;
};

export type AdminExperienceErrorSample = {
  authMode: string;
  errorClass: ValueOf<typeof ADMIN_EXPERIENCE_ERROR_CLASSES>;
  feature: string;
  occurredAt: string;
  operation: string;
  outcome: "rejected" | "error" | "unknown";
  protocol: ValueOf<typeof ADMIN_EXPERIENCE_PROTOCOLS>;
  requestId: string;
  surface: ValueOf<typeof ADMIN_EXPERIENCE_SURFACES>;
};

export type AdminExperienceWindow = {
  days: (typeof ADMIN_EXPERIENCE_DAYS)[number];
  fromDay: string;
  toDay: string;
  fromTimestamp: string;
  toTimestamp: string;
  nowTimestamp: string;
};

type ReadState =
  | { state: "empty" }
  | {
      reason: "invalid_config" | "not_configured" | "query_failed";
      state: "unavailable";
    }
  | { state: "ready" };

const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_FINITE_VALUE = 1_000_000_000_000_000;

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlTimestamp(value: string) {
  return `toDateTime(${sqlString(value)})`;
}

function utcSqlTimestamp(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

export function buildAdminExperienceWindow(
  days: (typeof ADMIN_EXPERIENCE_DAYS)[number],
  now: Date = new Date(),
): AdminExperienceWindow {
  const today = shanghaiDayjs(now).startOf("day");
  const from = today.subtract(days, "day");
  return {
    days,
    fromDay: from.format("YYYY-MM-DD"),
    toDay: today.format("YYYY-MM-DD"),
    fromTimestamp: utcSqlTimestamp(from.toDate()),
    toTimestamp: utcSqlTimestamp(today.toDate()),
    nowTimestamp: utcSqlTimestamp(now),
  };
}

function whereClause(
  filters: AdminExperienceFilters,
  window: AdminExperienceWindow,
  extra: string[] = [],
) {
  const clauses = [
    `blob1 = ${sqlString("feature_operation_v1")}`,
    `timestamp >= ${sqlTimestamp(window.fromTimestamp)}`,
    `timestamp < ${sqlTimestamp(window.toTimestamp)}`,
    ...extra,
  ];
  if (filters.feature) clauses.push(`blob2 = ${sqlString(filters.feature)}`);
  if (filters.operation)
    clauses.push(`blob3 = ${sqlString(filters.operation)}`);
  if (filters.protocol) clauses.push(`blob4 = ${sqlString(filters.protocol)}`);
  if (filters.surface) clauses.push(`blob5 = ${sqlString(filters.surface)}`);
  if (filters.authMode) clauses.push(`blob6 = ${sqlString(filters.authMode)}`);
  if (filters.outcome) clauses.push(`blob7 = ${sqlString(filters.outcome)}`);
  return clauses.join("\n      AND ");
}

export function buildAdminExperienceAggregateQuery(
  filters: AdminExperienceFilters,
  window: AdminExperienceWindow,
) {
  return `SELECT
        blob2 AS feature,
        blob3 AS operation,
        blob4 AS protocol,
        blob5 AS surface,
        blob6 AS auth_mode,
        blob7 AS outcome,
        sum(_sample_interval) AS total,
        sumIf(_sample_interval, blob7 = 'rejected') AS rejected_count,
        sumIf(_sample_interval, blob7 = 'error') AS error_count,
        sumIf(_sample_interval, blob7 = 'unknown') AS unknown_count,
        quantileExactWeighted(0.50)(double1, _sample_interval) AS p50_wall_ms,
        quantileExactWeighted(0.95)(double1, _sample_interval) AS p95_wall_ms
      FROM ${CLOUDFLARE_ANALYTICS_DATASET}
      WHERE ${whereClause(filters, window)}
      GROUP BY blob2, blob3, blob4, blob5, blob6, blob7
      ORDER BY total DESC
      LIMIT ${ADMIN_EXPERIENCE_QUERY_LIMIT}
      FORMAT JSON`;
}

export function buildAdminExperienceErrorQuery(
  filters: AdminExperienceFilters,
  window: AdminExperienceWindow,
) {
  return `SELECT
        timestamp AS occurred_at,
        blob2 AS feature,
        blob3 AS operation,
        blob4 AS protocol,
        blob5 AS surface,
        blob6 AS auth_mode,
        blob7 AS outcome,
        blob8 AS error_class,
        blob9 AS request_id
      FROM ${CLOUDFLARE_ANALYTICS_DATASET}
      WHERE ${whereClause(
        filters,
        {
          ...window,
          // Error triage includes the current Shanghai day through the read
          // time; the aggregate window intentionally contains completed days.
          toTimestamp: window.nowTimestamp,
        },
        [
          // Unknown outcomes are included as explicitly unclassified issue
          // samples. They must not be presented as confirmed failures.
          "blob7 IN ('rejected', 'error', 'unknown')",
          "blob8 != 'none'",
          "blob9 != ''",
        ],
      )}
      ORDER BY timestamp DESC
      LIMIT ${ADMIN_EXPERIENCE_ERROR_LIMIT + 1}
      FORMAT JSON`;
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Analytics Engine returned a non-object row");
  }
  return value as Record<string, unknown>;
}

function readToken(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) {
    throw new Error(`Analytics Engine returned invalid ${key}`);
  }
  return value;
}

function readDimension<T extends readonly string[]>(
  row: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = row[key];
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Analytics Engine returned invalid ${key}`);
  }
  return value as T[number];
}

function readCount(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || value.trim() === "")
  )
    throw new Error(`Analytics Engine returned invalid ${key}`);
  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > MAX_FINITE_VALUE ||
    !Number.isInteger(parsed)
  ) {
    throw new Error(`Analytics Engine returned invalid ${key}`);
  }
  return parsed;
}

function readDuration(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value === null) return null;
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || value.trim() === "")
  )
    throw new Error(`Analytics Engine returned invalid ${key}`);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_FINITE_VALUE) {
    throw new Error(`Analytics Engine returned invalid ${key}`);
  }
  return parsed;
}

export function parseAdminExperienceAggregateRows(
  input: readonly unknown[],
): AdminExperienceAggregateRow[] {
  if (input.length > ADMIN_EXPERIENCE_MAX_ROWS) {
    throw new Error("Analytics Engine returned too many aggregate rows");
  }
  return input.map((value) => {
    const row = readObject(value);
    const parsed = {
      authMode: readDimension(row, "auth_mode", ADMIN_EXPERIENCE_AUTH_MODES),
      errorCount: readCount(row, "error_count"),
      feature: readToken(row, "feature"),
      operation: readToken(row, "operation"),
      outcome: readDimension(row, "outcome", ADMIN_EXPERIENCE_OUTCOMES),
      p50WallMs: readDuration(row, "p50_wall_ms"),
      p95WallMs: readDuration(row, "p95_wall_ms"),
      protocol: readDimension(row, "protocol", ADMIN_EXPERIENCE_PROTOCOLS),
      rejectedCount: readCount(row, "rejected_count"),
      surface: readDimension(row, "surface", ADMIN_EXPERIENCE_SURFACES),
      total: readCount(row, "total"),
      unknownCount: readCount(row, "unknown_count"),
    };
    if (
      parsed.total === 0 ||
      parsed.errorCount !== (parsed.outcome === "error" ? parsed.total : 0) ||
      parsed.rejectedCount !==
        (parsed.outcome === "rejected" ? parsed.total : 0) ||
      parsed.unknownCount !==
        (parsed.outcome === "unknown" ? parsed.total : 0) ||
      (parsed.p50WallMs !== null &&
        parsed.p95WallMs !== null &&
        parsed.p50WallMs > parsed.p95WallMs)
    ) {
      throw new Error(
        "Analytics Engine returned inconsistent aggregate metrics",
      );
    }
    return parsed;
  });
}

function readTimestamp(row: Record<string, unknown>) {
  const value = row.occurred_at;
  if (typeof value !== "string")
    throw new Error("Analytics Engine returned invalid occurred_at");
  // SQL DateTime values without an offset are UTC, regardless of the host TZ.
  const timestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(
    value,
  )
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Analytics Engine returned invalid occurred_at");
  }
  return date.toISOString();
}

export function parseAdminExperienceErrorRows(
  input: readonly unknown[],
): AdminExperienceErrorSample[] {
  if (input.length > ADMIN_EXPERIENCE_ERROR_LIMIT + 1) {
    throw new Error("Analytics Engine returned too many error rows");
  }
  return input.slice(0, ADMIN_EXPERIENCE_ERROR_LIMIT).map((value) => {
    const row = readObject(value);
    const requestId = row.request_id;
    if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
      throw new Error("Analytics Engine returned invalid request_id");
    }
    return {
      authMode: readDimension(row, "auth_mode", ADMIN_EXPERIENCE_AUTH_MODES),
      errorClass: readDimension(
        row,
        "error_class",
        ADMIN_EXPERIENCE_ERROR_CLASSES,
      ),
      feature: readToken(row, "feature"),
      occurredAt: readTimestamp(row),
      operation: readToken(row, "operation"),
      outcome: readDimension(row, "outcome", [
        "rejected",
        "error",
        "unknown",
      ] as const),
      protocol: readDimension(row, "protocol", ADMIN_EXPERIENCE_PROTOCOLS),
      requestId,
      surface: readDimension(row, "surface", ADMIN_EXPERIENCE_SURFACES),
    };
  });
}

function parseDays(value: string | null) {
  const days = Number(value);
  return ADMIN_EXPERIENCE_DAYS.includes(
    days as (typeof ADMIN_EXPERIENCE_DAYS)[number],
  )
    ? (days as (typeof ADMIN_EXPERIENCE_DAYS)[number])
    : 30;
}

function parseTokenFilter<T extends readonly string[]>(
  value: string | null,
  allowed: T,
): T[number] | undefined {
  return value && allowed.includes(value) ? (value as T[number]) : undefined;
}

function parseOperationFilter(value: string | null) {
  return value && TOKEN_PATTERN.test(value) ? value : undefined;
}

export function parseAdminExperienceFilters(url: URL) {
  return {
    authMode: parseTokenFilter(
      url.searchParams.get("authMode"),
      ADMIN_EXPERIENCE_AUTH_MODES,
    ),
    feature: parseTokenFilter(
      url.searchParams.get("feature"),
      ADMIN_EXPERIENCE_FEATURES,
    ),
    operation: parseOperationFilter(url.searchParams.get("operation")),
    outcome: parseTokenFilter(
      url.searchParams.get("outcome"),
      ADMIN_EXPERIENCE_OUTCOMES,
    ),
    protocol: parseTokenFilter(
      url.searchParams.get("protocol"),
      ADMIN_EXPERIENCE_PROTOCOLS,
    ),
    surface: parseTokenFilter(
      url.searchParams.get("surface"),
      ADMIN_EXPERIENCE_SURFACES,
    ),
  } satisfies AdminExperienceFilters;
}

function unavailableState(error: unknown): ReadState {
  if (error instanceof CloudflareAnalyticsReadUnavailableError) {
    return { reason: error.reason, state: "unavailable" };
  }
  return { reason: "query_failed", state: "unavailable" };
}

async function readAggregateRows(
  port: CloudflareAnalyticsReadPort,
  filters: AdminExperienceFilters,
  window: AdminExperienceWindow,
) {
  try {
    const rows = parseAdminExperienceAggregateRows(
      await port.query(buildAdminExperienceAggregateQuery(filters, window)),
    );
    return {
      rows,
      status:
        rows.length > 0
          ? ({ state: "ready" } as const)
          : ({ state: "empty" } as const),
    };
  } catch (error) {
    return { rows: [], status: unavailableState(error) };
  }
}

export async function getAdminExperiencePage(
  request: Request,
  url: URL,
  options: { now?: Date; readPort?: CloudflareAnalyticsReadPort } = {},
) {
  await requireAdminPage(request);
  const days = parseDays(url.searchParams.get("days"));
  const filters = parseAdminExperienceFilters(url);
  const window = buildAdminExperienceWindow(days, options.now);
  const port = options.readPort ?? getCloudflareAnalyticsReadPort();
  const aggregate = await readAggregateRows(port, filters, window);
  const showErrors = url.searchParams.get("errors") === "1";
  let errorSamples: AdminExperienceErrorSample[] = [];
  let errorsTruncated = false;
  let errorsStatus: ReadState = { state: "empty" };

  if (showErrors) {
    if (
      aggregate.status.state === "unavailable" &&
      aggregate.status.reason !== "query_failed"
    ) {
      errorsStatus = aggregate.status;
    } else {
      try {
        const issueRows = await port.query(
          buildAdminExperienceErrorQuery(filters, window),
        );
        errorSamples = parseAdminExperienceErrorRows(issueRows);
        errorsTruncated = issueRows.length > ADMIN_EXPERIENCE_ERROR_LIMIT;
        errorsStatus =
          errorSamples.length > 0 ? { state: "ready" } : { state: "empty" };
      } catch (error) {
        errorsStatus = unavailableState(error);
      }
    }
  }

  return {
    catalog: {
      authModes: ADMIN_EXPERIENCE_AUTH_MODES,
      errorClasses: ADMIN_EXPERIENCE_ERROR_CLASSES,
      features: ADMIN_EXPERIENCE_FEATURES,
      outcomes: ADMIN_EXPERIENCE_OUTCOMES,
      protocols: ADMIN_EXPERIENCE_PROTOCOLS,
      surfaces: ADMIN_EXPERIENCE_SURFACES,
    },
    coverage: {
      endDayExclusive: window.toDay,
      fromDay: window.fromDay,
      includesToday: false,
      sampling: "weighted_estimate" as const,
      timezone: "Asia/Shanghai" as const,
    },
    days,
    errorSamples,
    errorsStatus,
    errorsTruncated,
    filters,
    rows: aggregate.rows,
    showErrors,
    status: aggregate.status,
    window,
  };
}
