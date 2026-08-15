import type {
  AuditAction,
  AuditChannel,
  AuditOutcome,
  Prisma,
} from "@/generated/prisma/client";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma } from "@/lib/db/prisma";
import { optionalValue } from "@/lib/load-data-utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { requireAdminPage } from "./admin-page-auth";

export const ADMIN_AUDIT_PAGE_SIZE = 50;

export const ADMIN_AUDIT_ACTIONS = [
  "comment_create",
  "comment_edit",
  "comment_delete",
  "comment_react",
  "description_edit",
  "upload_delete",
  "admin_user_suspend",
  "admin_user_unsuspend",
  "admin_user_role_update",
  "admin_user_profile_update",
  "admin_comment_moderate",
  "admin_description_moderate",
  "admin_oauth_client_create",
  "admin_oauth_client_delete",
  "admin_bus_version_activate",
  "admin_bus_version_delete",
  "admin_bus_import",
  "homework_create",
  "homework_update",
  "homework_delete",
  "section_retire",
  "section_reactivate",
  "webhook_login",
  "account_create",
  "account_sign_in",
  "account_sign_out",
  "account_profile_update",
  "account_credential_update",
  "account_link",
  "account_unlink",
  "account_delete",
  "account_passkey_create",
  "account_passkey_update",
  "account_passkey_delete",
  "account_session_revoke",
  "account_calendar_token_create",
  "account_calendar_token_rotate",
  "oauth_authorization_grant",
  "oauth_authorization_update",
  "oauth_authorization_revoke",
] as const satisfies readonly AuditAction[];

export const ADMIN_AUDIT_CHANNELS = [
  "web",
  "rest",
  "graphql",
  "mcp",
  "auth",
  "webhook",
  "system",
] as const satisfies readonly AuditChannel[];

export const ADMIN_AUDIT_OUTCOMES = [
  "success",
  "denied",
  "failure",
] as const satisfies readonly AuditOutcome[];

function enumFilter<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
) {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}

function dateFilter(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+08:00`,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function safeAuditMetadata(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const metadata = value as Record<string, Prisma.JsonValue>;
  const safe: Record<string, Prisma.JsonValue> = {};
  for (const key of [
    "changedFields",
    "authMethod",
    "campuses",
    "jwId",
    "observedAt",
    "previousRetiredAt",
    "provider",
    "reason",
    "reasonProvided",
    "resourceCount",
    "revokedAccessTokenCount",
    "revokedDeviceCodeCount",
    "revokedRefreshTokenCount",
    "routes",
    "scopeCount",
    "sectionId",
    "selfService",
    "size",
    "snapshotSha256",
    "source",
    "status",
    "suspensionId",
    "trips",
  ]) {
    if (metadata[key] !== undefined) safe[key] = metadata[key];
  }
  return Object.keys(safe).length > 0 ? safe : null;
}

const HIDDEN_ADMIN_AUDIT_TARGET_ID_TYPES = new Set([
  "account",
  "oauth_consent",
  "passkey",
  "session",
]);

export function safeAdminAuditTargetId(
  targetType: string | null,
  targetId: string | null,
) {
  return targetType && HIDDEN_ADMIN_AUDIT_TARGET_ID_TYPES.has(targetType)
    ? null
    : targetId;
}

type AdminAuditCursor = { createdAt: Date; id: string };

function auditCursorChecksum(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function encodeAdminAuditCursor(cursor: AdminAuditCursor) {
  const payload = `${cursor.createdAt.toISOString()}\n${cursor.id}`;
  return btoa(`${payload}\n${auditCursorChecksum(payload)}`)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeAdminAuditCursor(
  value: string | undefined,
): AdminAuditCursor | null {
  if (!value || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  try {
    const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
    const decoded = atob(padded);
    const firstSeparator = decoded.indexOf("\n");
    const lastSeparator = decoded.lastIndexOf("\n");
    if (firstSeparator < 1 || lastSeparator <= firstSeparator) return null;
    const payload = decoded.slice(0, lastSeparator);
    if (auditCursorChecksum(payload) !== decoded.slice(lastSeparator + 1)) {
      return null;
    }
    const createdAt = new Date(decoded.slice(0, firstSeparator));
    const id = decoded.slice(firstSeparator + 1, lastSeparator);
    if (
      Number.isNaN(createdAt.getTime()) ||
      id.length < 1 ||
      id.length > 128 ||
      Array.from(id).some((character) => character.charCodeAt(0) < 32)
    ) {
      return null;
    }
    const parsed = { createdAt, id };
    return encodeAdminAuditCursor(parsed) === value ? parsed : null;
  } catch {
    return null;
  }
}

export function adminAuditCursorWhere(cursor: AdminAuditCursor) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  } satisfies Prisma.AuditLogWhereInput;
}

export async function getAdminAuditPage(request: Request, url: URL) {
  await requireAdminPage(request);
  const cursor = decodeAdminAuditCursor(
    optionalValue(url.searchParams.get("cursor")),
  );
  const filters = {
    action: enumFilter(
      optionalValue(url.searchParams.get("action")),
      ADMIN_AUDIT_ACTIONS,
    ),
    actor: optionalValue(url.searchParams.get("actor")),
    channel: enumFilter(
      optionalValue(url.searchParams.get("channel")),
      ADMIN_AUDIT_CHANNELS,
    ),
    client: optionalValue(url.searchParams.get("client")),
    from: optionalValue(url.searchParams.get("from")),
    outcome: enumFilter(
      optionalValue(url.searchParams.get("outcome")),
      ADMIN_AUDIT_OUTCOMES,
    ),
    subject: optionalValue(url.searchParams.get("subject")),
    targetId: optionalValue(url.searchParams.get("targetId")),
    targetType: optionalValue(url.searchParams.get("targetType")),
    to: optionalValue(url.searchParams.get("to")),
  };
  const filterWhere: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actor ? { userId: filters.actor } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(filters.client ? { oauthClientId: filters.client } : {}),
    ...(filters.outcome ? { outcome: filters.outcome } : {}),
    ...(filters.subject ? { subjectUserId: filters.subject } : {}),
    ...(filters.targetId ? { targetId: filters.targetId } : {}),
    ...(filters.targetType ? { targetType: filters.targetType } : {}),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(dateFilter(filters.from) ? { gte: dateFilter(filters.from) } : {}),
        ...(dateFilter(filters.to, true)
          ? { lte: dateFilter(filters.to, true) }
          : {}),
      },
    }),
  };
  const where: Prisma.AuditLogWhereInput = cursor
    ? { AND: [filterWhere, adminAuditCursorWhere(cursor)] }
    : filterWhere;
  const [rawRows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        action: true,
        channel: true,
        createdAt: true,
        id: true,
        metadata: true,
        oauthClientId: true,
        outcome: true,
        subjectUser: { select: { id: true, name: true, username: true } },
        targetId: true,
        targetType: true,
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ADMIN_AUDIT_PAGE_SIZE + 1,
    }),
    prisma.auditLog.count({ where: filterWhere }),
  ]);
  const hasMore = rawRows.length > ADMIN_AUDIT_PAGE_SIZE;
  const rows = rawRows.slice(0, ADMIN_AUDIT_PAGE_SIZE);
  const clientIds = [
    ...new Set(rows.flatMap((row) => row.oauthClientId ?? [])),
  ];
  const clients = clientIds.length
    ? await authPrisma.oAuthClient.findMany({
        where: { clientId: { in: clientIds } },
        select: { clientId: true, name: true },
      })
    : [];
  const clientNames = new Map(
    clients.map((client) => [client.clientId, client.name]),
  );
  const lastRow = rows.at(-1);

  return {
    actions: ADMIN_AUDIT_ACTIONS,
    channels: ADMIN_AUDIT_CHANNELS,
    filters,
    outcomes: ADMIN_AUDIT_OUTCOMES,
    pagination: {
      nextCursor:
        hasMore && lastRow
          ? encodeAdminAuditCursor({
              createdAt: lastRow.createdAt,
              id: lastRow.id,
            })
          : null,
      pageSize: ADMIN_AUDIT_PAGE_SIZE,
      total,
    },
    rows: rows.map((row) => ({
      ...row,
      clientName: row.oauthClientId
        ? (clientNames.get(row.oauthClientId) ?? null)
        : null,
      createdAt: row.createdAt.toISOString(),
      metadata: safeAuditMetadata(row.metadata),
      targetId: safeAdminAuditTargetId(row.targetType, row.targetId),
    })),
  };
}

function analyticsFeature(action: AuditAction, targetType: string | null) {
  if (targetType) return targetType;
  if (action.startsWith("admin_")) return "admin";
  if (action.startsWith("account_")) return "account";
  if (action.startsWith("oauth_")) return "oauth";
  if (action.startsWith("section_")) return "section";
  return action.split("_")[0] ?? "unknown";
}

export async function getAdminAnalyticsPage(request: Request, url: URL) {
  await requireAdminPage(request);
  const requestedDays = Number(url.searchParams.get("days"));
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fromDay = new Date(
    `${shanghaiDayjs()
      .subtract(days - 1, "day")
      .format("YYYY-MM-DD")}T00:00:00.000Z`,
  );
  const [grouped, oauthUsage] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ["action", "channel", "outcome", "oauthClientId", "targetType"],
      where: {
        createdAt: { gte: from },
        // REST/GraphQL/MCP OAuth calls are represented by the content-free
        // usage aggregate below. Excluding their per-mutation audit rows keeps
        // external-client writes from being counted twice.
        OR: [
          { oauthClientId: null },
          { channel: { notIn: ["rest", "graphql", "mcp"] } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.oAuthGrantUsageDaily.groupBy({
      by: ["channel", "clientId", "feature"],
      where: { day: { gte: fromDay } },
      _sum: { errorCount: true, readCount: true, writeCount: true },
    }),
  ]);
  const clientIds = [
    ...new Set([
      ...grouped.flatMap((row) => row.oauthClientId ?? []),
      ...oauthUsage.map((row) => row.clientId),
    ]),
  ];
  const clients = clientIds.length
    ? await authPrisma.oAuthClient.findMany({
        where: { clientId: { in: clientIds } },
        select: { clientId: true, name: true },
      })
    : [];
  const clientNames = new Map(
    clients.map((client) => [client.clientId, client.name]),
  );
  const aggregated = new Map<
    string,
    {
      channel: AuditChannel;
      client: string;
      count: number;
      feature: string;
      outcome: AuditOutcome;
    }
  >();
  function addRow(input: {
    channel: AuditChannel;
    clientId: string | null;
    count: number;
    feature: string;
    outcome: AuditOutcome;
  }) {
    if (input.count <= 0) return;
    const client = input.clientId
      ? clientNames.get(input.clientId)?.trim() || input.clientId
      : "first-party";
    const clientKey = input.clientId ?? "first-party";
    const key = `${input.feature}\u0000${input.channel}\u0000${input.outcome}\u0000${clientKey}`;
    const existing = aggregated.get(key);
    if (existing) existing.count += input.count;
    else {
      aggregated.set(key, {
        channel: input.channel,
        client,
        count: input.count,
        feature: input.feature,
        outcome: input.outcome,
      });
    }
  }
  for (const row of grouped) {
    addRow({
      channel: row.channel,
      clientId: row.oauthClientId,
      count: row._count._all,
      feature: analyticsFeature(row.action, row.targetType),
      outcome: row.outcome,
    });
  }
  for (const row of oauthUsage) {
    const total = (row._sum.readCount ?? 0) + (row._sum.writeCount ?? 0);
    const failures = Math.min(total, row._sum.errorCount ?? 0);
    addRow({
      channel: row.channel,
      clientId: row.clientId,
      count: total - failures,
      feature: row.feature,
      outcome: "success",
    });
    addRow({
      channel: row.channel,
      clientId: row.clientId,
      count: failures,
      feature: row.feature,
      outcome: "failure",
    });
  }
  const rows = [...aggregated.values()].sort(
    (left, right) => right.count - left.count,
  );
  return {
    days,
    rows,
    total: rows.reduce((sum, row) => sum + row.count, 0),
  };
}
