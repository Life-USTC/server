import type {
  AuditAction,
  AuditChannel,
  AuditOutcome,
} from "@/generated/prisma/client";
import { authPrisma } from "@/lib/db/auth-prisma";
import { withUserDbContext } from "@/lib/db/prisma";

const ACCOUNT_SECURITY_ACTIONS = [
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
  "admin_user_suspend",
  "admin_user_unsuspend",
  "admin_user_role_update",
  "admin_user_profile_update",
] as const satisfies readonly AuditAction[];

export type AccountActivityCursor = {
  createdAt: Date;
  id: string;
};

export type OAuthClientIdentity = {
  userId: string;
  clientId: string;
  grantId: string;
};

export type AccountActivityPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export class InvalidAccountActivityCursorError extends Error {
  constructor() {
    super("Invalid account activity cursor");
    this.name = "InvalidAccountActivityCursorError";
  }
}

export type OwnAccountSecurityActivity = {
  id: string;
  action: AuditAction;
  outcome: AuditOutcome;
  channel: AuditChannel;
  createdAt: string;
  client: { id: string; name: string | null } | null;
  network: string | null;
  device: string | null;
};

export type OAuthClientActivity = {
  id: string;
  action: AuditAction;
  outcome: AuditOutcome;
  channel: AuditChannel;
  createdAt: string;
  targetType: string | null;
};

function clampLimit(limit: number | undefined) {
  return Math.min(Math.max(Math.trunc(limit ?? 30), 1), 100);
}

export function encodeAccountActivityCursor(cursor: AccountActivityCursor) {
  return `${cursor.createdAt.toISOString()}|${cursor.id}`;
}

export function decodeAccountActivityCursor(
  value: string | null | undefined,
): AccountActivityCursor | undefined {
  if (!value) return undefined;
  const separator = value.indexOf("|");
  if (separator <= 0 || separator === value.length - 1) {
    throw new InvalidAccountActivityCursorError();
  }
  const createdAt = new Date(value.slice(0, separator));
  const id = value.slice(separator + 1);
  if (Number.isNaN(createdAt.getTime()) || !/^[A-Za-z0-9_-]{8,}$/.test(id)) {
    throw new InvalidAccountActivityCursorError();
  }
  return { createdAt, id };
}

function beforeCursor(cursor: AccountActivityCursor | undefined) {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function maskAuditIpAddress(value: string | null): string | null {
  if (!value) return null;
  const ipv4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.*`;
  if (value.includes(":")) {
    const prefix = value.split(":").filter(Boolean).slice(0, 3).join(":");
    return prefix ? `${prefix}::/48` : "IPv6 /48";
  }
  return null;
}

export function summarizeAuditUserAgent(value: string | null): string | null {
  if (!value) return null;
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /Firefox\//.test(value)
      ? "Firefox"
      : /Chrome\//.test(value)
        ? "Chrome"
        : /Safari\//.test(value)
          ? "Safari"
          : "Other browser";
  const os = /Android/.test(value)
    ? "Android"
    : /iPhone|iPad/.test(value)
      ? "iOS"
      : /Windows/.test(value)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(value)
          ? "macOS"
          : /Linux/.test(value)
            ? "Linux"
            : "Unknown OS";
  return `${browser} · ${os}`;
}

export async function listOwnAccountSecurityActivity(
  userId: string,
  options: { cursor?: AccountActivityCursor; limit?: number } = {},
): Promise<OwnAccountSecurityActivity[]> {
  const rows = await withUserDbContext(userId, (tx) =>
    tx.auditLog.findMany({
      where: {
        subjectUserId: userId,
        action: { in: [...ACCOUNT_SECURITY_ACTIONS] },
        ...beforeCursor(options.cursor),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: clampLimit(options.limit),
      select: {
        id: true,
        action: true,
        outcome: true,
        channel: true,
        createdAt: true,
        oauthClientId: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
  );
  const clientIds = [
    ...new Set(
      rows
        .map((row) => row.oauthClientId)
        .filter((value): value is string => Boolean(value)),
    ),
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

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    outcome: row.outcome,
    channel: row.channel,
    createdAt: row.createdAt.toISOString(),
    client: row.oauthClientId
      ? {
          id: row.oauthClientId,
          name: clientNames.get(row.oauthClientId) ?? null,
        }
      : null,
    network: maskAuditIpAddress(row.ipAddress),
    device: summarizeAuditUserAgent(row.userAgent),
  }));
}

export async function listOAuthClientActivity(
  principal: OAuthClientIdentity,
  options: { cursor?: AccountActivityCursor; limit?: number } = {},
): Promise<OAuthClientActivity[]> {
  const rows = await withUserDbContext(principal.userId, (tx) =>
    tx.auditLog.findMany({
      where: {
        subjectUserId: principal.userId,
        oauthClientId: principal.clientId,
        oauthGrantId: principal.grantId,
        ...beforeCursor(options.cursor),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: clampLimit(options.limit),
      select: {
        id: true,
        action: true,
        outcome: true,
        channel: true,
        createdAt: true,
        targetType: true,
      },
    }),
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    outcome: row.outcome,
    channel: row.channel,
    createdAt: row.createdAt.toISOString(),
    targetType: row.targetType,
  }));
}

function pageFromRows<T extends { createdAt: string; id: string }>(
  rows: T[],
  limit: number,
): AccountActivityPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeAccountActivityCursor({
            createdAt: new Date(last.createdAt),
            id: last.id,
          })
        : null,
  };
}

export async function listOwnAccountSecurityActivityPage(
  userId: string,
  options: { cursor?: string | null; limit?: number } = {},
) {
  const limit = Math.min(clampLimit(options.limit), 50);
  const rows = await listOwnAccountSecurityActivity(userId, {
    cursor: decodeAccountActivityCursor(options.cursor),
    limit: limit + 1,
  });
  return { ...pageFromRows(rows, limit), hasCursor: Boolean(options.cursor) };
}

export async function listOAuthClientActivityPage(
  principal: OAuthClientIdentity,
  options: { cursor?: string | null; limit?: number } = {},
) {
  const limit = Math.min(clampLimit(options.limit), 50);
  const rows = await listOAuthClientActivity(principal, {
    cursor: decodeAccountActivityCursor(options.cursor),
    limit: limit + 1,
  });
  return pageFromRows(rows, limit);
}
