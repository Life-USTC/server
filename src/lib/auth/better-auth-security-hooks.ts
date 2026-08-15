import type {
  BetterAuthOptions,
  GenericEndpointContext,
} from "@better-auth/core";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import type { AuditAction, AuditOutcome } from "@/generated/prisma/client";
import {
  type AuditLogParams,
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "./recent-auth-policy";

export { RECENT_AUTH_MAX_AGE_SECONDS } from "./recent-auth-policy";

const USER_AUDIT_FIELDS = new Set([
  "email",
  "emailVerified",
  "image",
  "name",
  "profilePictures",
  "username",
]);
const ACCOUNT_CREDENTIAL_FIELDS = new Set(["password"]);
const pendingUserFields = new WeakMap<object, string[]>();
const pendingAccountFields = new WeakMap<object, string[]>();

function contextPath(context: GenericEndpointContext | null) {
  return context?.path ?? "";
}

function requestMetadata(context: GenericEndpointContext | null) {
  return context?.headers
    ? getAuditRequestMetadata({ headers: context.headers })
    : {};
}

function safeChangedFields(
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
) {
  return Object.keys(input)
    .filter((field) => allowed.has(field) && input[field] !== undefined)
    .sort();
}

function stageFields(
  storage: WeakMap<object, string[]>,
  context: GenericEndpointContext | null,
  fields: string[],
) {
  if (!context || fields.length === 0) return;
  storage.set(context, fields);
}

function takeFields(
  storage: WeakMap<object, string[]>,
  context: GenericEndpointContext | null,
) {
  if (!context) return [];
  const fields = storage.get(context) ?? [];
  storage.delete(context);
  return fields;
}

function authMethodForPath(path: string) {
  if (path.includes("passkey")) return "passkey";
  if (path.includes("email")) return "password";
  if (path.includes("callback") || path.includes("social")) return "oauth";
  if (path.includes("webhook")) return "webhook";
  return "session";
}

async function safeAudit(params: AuditLogParams) {
  try {
    await fireAuditLog(params);
  } catch {
    // Authentication mutations have already committed when database after
    // hooks run. Audit availability must never turn committed work into a
    // false API failure; fireAuditLog reports the write failure separately.
  }
}

function isAccountDeletionPath(path: string) {
  return path === "/delete-user" || path === "/delete-user/callback";
}

export const betterAuthSecurityDatabaseHooks = {
  user: {
    create: {
      after: async (user, context) => {
        await safeAudit({
          action: "account_create",
          channel: "auth",
          subjectUserId: user.id,
          targetId: user.id,
          targetType: "user",
          userId: user.id,
          ...requestMetadata(context),
        });
      },
    },
    update: {
      before: async (data, context) => {
        stageFields(
          pendingUserFields,
          context,
          safeChangedFields(data, USER_AUDIT_FIELDS),
        );
      },
      after: async (user, context) => {
        const changedFields = takeFields(pendingUserFields, context);
        if (changedFields.length === 0) return;
        await safeAudit({
          action: "account_profile_update",
          channel: "auth",
          subjectUserId: user.id,
          targetId: user.id,
          targetType: "user",
          userId: user.id,
          metadata: { changedFields },
          ...requestMetadata(context),
        });
      },
    },
    delete: {
      after: async (_user, context) => {
        await safeAudit({
          action: "account_delete",
          channel: "auth",
          targetType: "user",
          metadata: { selfService: true },
          ...requestMetadata(context),
        });
      },
    },
  },
  session: {
    create: {
      after: async (session, context) => {
        const path = contextPath(context);
        if (actionForPath(path) !== "account_sign_in") return;
        await safeAudit({
          action: "account_sign_in",
          channel: "auth",
          sessionId: session.id,
          subjectUserId: session.userId,
          targetId: session.id,
          targetType: "session",
          userId: session.userId,
          metadata: { authMethod: authMethodForPath(path) },
          ...requestMetadata(context),
        });
      },
    },
    delete: {
      after: async (session, context) => {
        const path = contextPath(context);
        if (isAccountDeletionPath(path)) return;
        const action: AuditAction | null =
          path === "/sign-out"
            ? "account_sign_out"
            : path === "/revoke-session" ||
                path === "/revoke-sessions" ||
                path === "/revoke-other-sessions" ||
                path === "/change-password" ||
                path === "/set-password"
              ? "account_session_revoke"
              : null;
        if (!action) return;
        await safeAudit({
          action,
          channel: "auth",
          sessionId: session.id,
          subjectUserId: session.userId,
          targetId: session.id,
          targetType: "session",
          userId: session.userId,
          ...requestMetadata(context),
        });
      },
    },
  },
  account: {
    create: {
      after: async (account, context) => {
        // Initial provisioning already emits account_create from user.create.
        // account_link is reserved for adding a method to an authenticated user.
        if (context?.context.session?.user?.id !== account.userId) return;
        const credentialCreated = contextPath(context) === "/set-password";
        await safeAudit({
          action: credentialCreated
            ? "account_credential_update"
            : "account_link",
          channel: "auth",
          subjectUserId: account.userId,
          targetId: account.id,
          targetType: "account",
          userId: account.userId,
          metadata: credentialCreated
            ? { changedFields: ["password"] }
            : { provider: account.providerId },
          ...requestMetadata(context),
        });
      },
    },
    update: {
      before: async (data, context) => {
        stageFields(
          pendingAccountFields,
          context,
          safeChangedFields(data, ACCOUNT_CREDENTIAL_FIELDS),
        );
      },
      after: async (account, context) => {
        const changedFields = takeFields(pendingAccountFields, context);
        if (changedFields.length === 0) return;
        await safeAudit({
          action: "account_credential_update",
          channel: "auth",
          subjectUserId: account.userId,
          targetId: account.id,
          targetType: "account",
          userId: account.userId,
          metadata: { changedFields },
          ...requestMetadata(context),
        });
      },
    },
    delete: {
      after: async (account, context) => {
        if (isAccountDeletionPath(contextPath(context))) return;
        await safeAudit({
          action: "account_unlink",
          channel: "auth",
          subjectUserId: account.userId,
          targetId: account.id,
          targetType: "account",
          userId: account.userId,
          metadata: { provider: account.providerId },
          ...requestMetadata(context),
        });
      },
    },
  },
} satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

const RECENT_AUTH_PATHS = new Set([
  "/change-email",
  "/change-password",
  "/delete-user",
  "/link-social",
  "/passkey/delete-passkey",
  "/passkey/update-passkey",
  "/passkey/verify-registration",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/set-password",
  "/unlink-account",
]);

function actionForPath(path: string): AuditAction | null {
  if (path === "/passkey/verify-registration") return "account_passkey_create";
  if (path === "/passkey/update-passkey") return "account_passkey_update";
  if (path === "/passkey/delete-passkey") return "account_passkey_delete";
  if (path === "/sign-out") return "account_sign_out";
  if (path === "/link-social") return "account_link";
  if (path === "/unlink-account") return "account_unlink";
  if (isAccountDeletionPath(path)) return "account_delete";
  if (
    path === "/revoke-session" ||
    path === "/revoke-sessions" ||
    path === "/revoke-other-sessions"
  ) {
    return "account_session_revoke";
  }
  if (path === "/change-password" || path === "/set-password") {
    return "account_credential_update";
  }
  if (path === "/change-email" || path === "/update-user") {
    return "account_profile_update";
  }
  if (
    path === "/sign-in/email" ||
    path === "/sign-in/social" ||
    path.startsWith("/callback/") ||
    path === "/passkey/verify-authentication"
  ) {
    return "account_sign_in";
  }
  return null;
}

function errorOutcome(returned: unknown): AuditOutcome {
  if (!isAPIError(returned)) return "failure";
  return returned.statusCode === 401 || returned.statusCode === 403
    ? "denied"
    : "failure";
}

function safeEndpointTargetId(
  context: GenericEndpointContext,
  returned: unknown,
) {
  const path = context.path;
  if (
    (path === "/passkey/update-passkey" ||
      path === "/passkey/delete-passkey") &&
    context.body &&
    typeof context.body === "object" &&
    typeof (context.body as Record<string, unknown>).id === "string"
  ) {
    // Only the resource identifier is allowlisted. Never serialize the body.
    return (context.body as Record<string, unknown>).id as string;
  }
  if (!returned || typeof returned !== "object" || isAPIError(returned)) {
    return undefined;
  }
  const record = returned as Record<string, unknown>;
  if (path === "/passkey/verify-registration") {
    return typeof record.id === "string" ? record.id : undefined;
  }
  if (path === "/passkey/update-passkey") {
    const passkey = record.passkey;
    return passkey &&
      typeof passkey === "object" &&
      typeof (passkey as Record<string, unknown>).id === "string"
      ? ((passkey as Record<string, unknown>).id as string)
      : undefined;
  }
  return undefined;
}

function userIdFromContext(context: GenericEndpointContext) {
  const userId = context.context.session?.user?.id;
  return typeof userId === "string" ? userId : undefined;
}

async function auditEndpointResult(context: GenericEndpointContext) {
  const path = context.path;
  const action = actionForPath(path);
  if (!action) return;
  const returned = context.context.returned;
  const failed = isAPIError(returned);

  // Successful core mutations are emitted by committed database after hooks.
  // Passkey rows are plugin-owned and therefore need the final endpoint hook.
  if (!failed && !path.startsWith("/passkey/")) return;
  // Passkey authentication success is represented by the committed session
  // creation hook, after the counter update and session creation both finish.
  if (!failed && path === "/passkey/verify-authentication") return;

  const userId = userIdFromContext(context);
  await safeAudit({
    action,
    channel: "auth",
    ...(userId ? { subjectUserId: userId, userId } : {}),
    outcome: failed ? errorOutcome(returned) : "success",
    targetId: safeEndpointTargetId(context, returned),
    targetType: path.includes("passkey") ? "passkey" : "account",
    metadata: {
      ...(action === "account_sign_in"
        ? { authMethod: authMethodForPath(path) }
        : {}),
    },
    ...requestMetadata(context),
  });
}

export const betterAuthSecurityHooks = {
  before: createAuthMiddleware(async (context) =>
    enforceBetterAuthRecentSession(context),
  ),
  after: createAuthMiddleware(async (context) => {
    await auditEndpointResult(context);
  }),
} satisfies NonNullable<BetterAuthOptions["hooks"]>;

type AuthoritativeSession = Awaited<
  ReturnType<typeof getAuthoritativeSessionFromCtx>
>;

export async function enforceBetterAuthRecentSession(
  context: GenericEndpointContext,
  resolveSession: (
    context: GenericEndpointContext,
  ) => Promise<AuthoritativeSession> = getAuthoritativeSessionFromCtx,
) {
  if (!RECENT_AUTH_PATHS.has(context.path)) return;
  const session = await resolveSession(context);
  if (isAccountDeletionPath(context.path)) {
    const userId = session?.user?.id;
    await safeAudit({
      action: "account_delete",
      channel: "auth",
      ...(userId ? { subjectUserId: userId, userId } : {}),
      outcome: "denied",
      targetType: "user",
      metadata: { reason: "settings_flow_required", selfService: true },
      ...requestMetadata(context),
    });
    throw new APIError(session ? "FORBIDDEN" : "UNAUTHORIZED", {
      code: session ? "SETTINGS_FLOW_REQUIRED" : "UNAUTHORIZED",
      message: session
        ? "Account deletion is only available from account settings"
        : "Unauthorized",
    });
  }
  const createdAt = session?.session?.createdAt;
  const createdAtMs = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  const isFresh =
    session?.session &&
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs < RECENT_AUTH_MAX_AGE_SECONDS * 1000;
  if (isFresh) return { context: { session } };

  const action = actionForPath(context.path);
  const userId = session?.user?.id;
  if (action) {
    await safeAudit({
      action,
      channel: "auth",
      ...(userId ? { subjectUserId: userId, userId } : {}),
      outcome: "denied",
      targetType: context.path.includes("passkey") ? "passkey" : "account",
      metadata: { reason: session ? "session_not_fresh" : "unauthenticated" },
      ...requestMetadata(context),
    });
  }
  throw new APIError(session ? "FORBIDDEN" : "UNAUTHORIZED", {
    code: session ? "SESSION_NOT_FRESH" : "UNAUTHORIZED",
    message: session ? "Session is not fresh" : "Unauthorized",
  });
}
