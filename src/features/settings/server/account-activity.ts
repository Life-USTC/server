import type {
  AuditAction,
  AuditChannel,
  AuditOutcome,
} from "@/generated/prisma/client";
import type { ApiPrincipal } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/db/prisma";

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
] as const satisfies readonly AuditAction[];

export type AccountActivityCursor = {
  createdAt: Date;
  id: string;
};

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
  const rows = await prisma.auditLog.findMany({
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
  });
  const clientIds = [
    ...new Set(
      rows
        .map((row) => row.oauthClientId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const clients = clientIds.length
    ? await prisma.oAuthClient.findMany({
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
  principal: Extract<ApiPrincipal, { kind: "oauth" }>,
  options: { cursor?: AccountActivityCursor; limit?: number } = {},
): Promise<OAuthClientActivity[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      subjectUserId: principal.userId,
      oauthClientId: principal.clientId,
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
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    outcome: row.outcome,
    channel: row.channel,
    createdAt: row.createdAt.toISOString(),
    targetType: row.targetType,
  }));
}
