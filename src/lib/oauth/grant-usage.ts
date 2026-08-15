import { type AuditChannel, Prisma } from "@/generated/prisma/client";
import { getCloudflareRuntimeTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { authPrisma } from "@/lib/db/auth-prisma";
import { logAppEvent } from "@/lib/log/app-logger";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type OAuthGrantUsageInput = {
  userId: string;
  clientId: string;
  grantId?: string;
  channel: Extract<AuditChannel, "rest" | "graphql" | "mcp">;
  feature: string;
  action: "read" | "write";
  outcome?: "success" | "error";
  count?: number;
  usedAt?: Date;
};

const USAGE_BATCH_DELAY_MS = 100;
const pendingUsage = new Map<string, OAuthGrantUsageInput>();
let pendingFlush: Promise<void> | undefined;

type OAuthGrantUsageClient = Pick<Prisma.TransactionClient, "$executeRaw">;

function shanghaiDatabaseDay(value: Date) {
  return new Date(`${shanghaiDayjs(value).format("YYYY-MM-DD")}T00:00:00.000Z`);
}

export function oauthGrantUsageKey(grantId?: string) {
  return grantId ? `grant:${grantId}` : "none";
}

export async function recordOAuthGrantUsage(
  input: OAuthGrantUsageInput,
  client: OAuthGrantUsageClient = authPrisma,
) {
  const usedAt = input.usedAt ?? new Date();
  const count = Math.max(1, Math.trunc(input.count ?? 1));
  const readCount = input.action === "read" ? count : 0;
  const writeCount = input.action === "write" ? count : 0;
  const errorCount = input.outcome === "error" ? count : 0;

  // Keep the counters and timestamp in one PostgreSQL statement. In
  // particular, GREATEST prevents a delayed request from moving lastUsedAt
  // backwards after a newer request has already committed in another isolate.
  await client.$executeRaw(Prisma.sql`
    INSERT INTO "OAuthGrantUsageDaily" (
      "id",
      "userId",
      "clientId",
      "grantId",
      "grantKey",
      "day",
      "feature",
      "channel",
      "readCount",
      "writeCount",
      "errorCount",
      "lastUsedAt",
      "updatedAt"
    ) VALUES (
      ${crypto.randomUUID()},
      ${input.userId},
      ${input.clientId},
      ${input.grantId ?? null},
      ${oauthGrantUsageKey(input.grantId)},
      ${shanghaiDatabaseDay(usedAt)},
      ${input.feature},
      ${input.channel}::"AuditChannel",
      ${readCount},
      ${writeCount},
      ${errorCount},
      ${usedAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (
      "userId", "clientId", "grantKey", "day", "feature", "channel"
    ) DO UPDATE SET
      "readCount" = "OAuthGrantUsageDaily"."readCount" + EXCLUDED."readCount",
      "writeCount" = "OAuthGrantUsageDaily"."writeCount" + EXCLUDED."writeCount",
      "errorCount" = "OAuthGrantUsageDaily"."errorCount" + EXCLUDED."errorCount",
      "lastUsedAt" = GREATEST(
        "OAuthGrantUsageDaily"."lastUsedAt",
        EXCLUDED."lastUsedAt"
      ),
      "updatedAt" = CURRENT_TIMESTAMP
  `);
  return true;
}

function usageBatchKey(input: OAuthGrantUsageInput) {
  return [
    input.userId,
    input.clientId,
    oauthGrantUsageKey(input.grantId),
    input.channel,
    input.feature,
    input.action,
    input.outcome ?? "success",
  ].join("\u0000");
}

async function flushPendingUsage() {
  const batch = [...pendingUsage.values()];
  pendingUsage.clear();
  await Promise.all(batch.map((input) => recordOAuthGrantUsage(input)));
}

function startUsageFlush() {
  pendingFlush ??= (async () => {
    do {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, USAGE_BATCH_DELAY_MS);
      });
      await flushPendingUsage();
    } while (pendingUsage.size > 0);
  })()
    .catch((error: unknown) => {
      logAppEvent(
        "error",
        "OAuth grant usage batch write failed",
        { source: "oauth-grant-usage" },
        error,
      );
    })
    .finally(() => {
      pendingFlush = undefined;
      if (pendingUsage.size > 0) {
        const followup = startUsageFlush();
        getCloudflareRuntimeTaskScheduler()?.(followup);
      }
    });
  return pendingFlush;
}

/**
 * OAuth usage is informational rather than authorization-critical. In the
 * Worker it is scheduled with waitUntil so API latency does not include the
 * aggregate upsert. Tests and non-Worker scripts call recordOAuthGrantUsage
 * directly when they need deterministic persistence.
 */
function logUsageFailure(input: OAuthGrantUsageInput, error: unknown) {
  logAppEvent(
    "error",
    "OAuth grant usage write failed",
    {
      source: "oauth-grant-usage",
      channel: input.channel,
      feature: input.feature,
    },
    error,
  );
}

export function scheduleOAuthGrantUsage(input: OAuthGrantUsageInput) {
  const schedule = getCloudflareRuntimeTaskScheduler();
  if (!schedule) {
    return recordOAuthGrantUsage(input).catch((error: unknown) => {
      logUsageFailure(input, error);
    });
  }
  const key = usageBatchKey(input);
  const existing = pendingUsage.get(key);
  pendingUsage.set(key, {
    ...input,
    count: (existing?.count ?? 0) + Math.max(1, Math.trunc(input.count ?? 1)),
    usedAt: input.usedAt ?? new Date(),
  });
  schedule(startUsageFlush());
  return Promise.resolve();
}

const requestUsage = new WeakMap<Request, OAuthGrantUsageInput[]>();

export function registerOAuthRequestUsage(
  request: Request,
  input: OAuthGrantUsageInput,
) {
  const values = requestUsage.get(request) ?? [];
  if (!requestUsage.has(request)) requestUsage.set(request, values);
  if (
    !values.some(
      (value) =>
        value.clientId === input.clientId &&
        value.channel === input.channel &&
        value.feature === input.feature &&
        value.action === input.action,
    )
  ) {
    values.push(input);
  }
}

export async function finishOAuthRequestUsage(
  request: Request,
  status: number,
) {
  const values = requestUsage.get(request);
  requestUsage.delete(request);
  if (!values) return;
  await Promise.all(
    values.map((value) =>
      scheduleOAuthGrantUsage({
        ...value,
        outcome: status >= 400 ? "error" : "success",
      }),
    ),
  );
}
