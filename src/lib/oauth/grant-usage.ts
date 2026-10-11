import type { AuditChannel } from "@/generated/prisma/client";
import {
  getCloudflareRuntimeContext,
  getCloudflareRuntimeTaskScheduler,
} from "@/lib/adapters/cloudflare-runtime";
import {
  type RuntimeDatabaseAdapter,
  withRuntimeDatabaseAdapter,
} from "@/lib/db/prisma-adapter";
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
const MAX_PENDING_USAGE_DIMENSIONS = 256;
type UsageBatch = {
  pending: Map<string, OAuthGrantUsageInput>;
  flush?: Promise<void>;
};
// A background task may use IO only from its originating Worker request.
// Weak keys retain neither completed request contexts nor database connections.
const requestBatches = new WeakMap<
  NonNullable<ReturnType<typeof getCloudflareRuntimeContext>>,
  UsageBatch
>();

type UsageQuery = Parameters<RuntimeDatabaseAdapter["executeRaw"]>[0];
const usageSql = `
  INSERT INTO "OAuthGrantUsageDaily" (
    "id", "userId", "clientId", "grantId", "grantKey", "day", "feature", "channel",
    "readCount", "writeCount", "errorCount", "lastUsedAt", "updatedAt"
  ) SELECT
    $1, $2, $3, $4, $5, $6, $7, $8::"AuditChannel", $9, $10, $11, $12, CURRENT_TIMESTAMP
  WHERE EXISTS (SELECT 1 FROM "User" WHERE "id" = $2)
    AND EXISTS (SELECT 1 FROM "OAuthClient" WHERE "clientId" = $3)
  ON CONFLICT ("userId", "clientId", "grantKey", "day", "feature", "channel")
  DO UPDATE SET
    "readCount" = "OAuthGrantUsageDaily"."readCount" + EXCLUDED."readCount",
    "writeCount" = "OAuthGrantUsageDaily"."writeCount" + EXCLUDED."writeCount",
    "errorCount" = "OAuthGrantUsageDaily"."errorCount" + EXCLUDED."errorCount",
    "lastUsedAt" = GREATEST("OAuthGrantUsageDaily"."lastUsedAt", EXCLUDED."lastUsedAt"),
    "updatedAt" = CURRENT_TIMESTAMP
`;
const usageArgTypes: UsageQuery["argTypes"] = [
  { scalarType: "string", arity: "scalar" },
  { scalarType: "string", arity: "scalar" },
  { scalarType: "string", arity: "scalar" },
  { scalarType: "string", arity: "scalar" },
  { scalarType: "string", arity: "scalar" },
  { scalarType: "datetime", dbType: "DATE", arity: "scalar" },
  { scalarType: "string", arity: "scalar" },
  { scalarType: "enum", arity: "scalar" },
  { scalarType: "int", arity: "scalar" },
  { scalarType: "int", arity: "scalar" },
  { scalarType: "int", arity: "scalar" },
  { scalarType: "datetime", arity: "scalar" },
];

export function oauthGrantUsageKey(grantId?: string) {
  return grantId ? `grant:${grantId}` : "none";
}

function usageQuery(input: OAuthGrantUsageInput): UsageQuery {
  const usedAt = input.usedAt ?? new Date();
  const count = Math.max(1, Math.trunc(input.count ?? 1));
  return {
    sql: usageSql,
    args: [
      crypto.randomUUID(),
      input.userId,
      input.clientId,
      input.grantId ?? null,
      oauthGrantUsageKey(input.grantId),
      new Date(`${shanghaiDayjs(usedAt).format("YYYY-MM-DD")}T00:00:00.000Z`),
      input.feature,
      input.channel,
      input.action === "read" ? count : 0,
      input.action === "write" ? count : 0,
      input.outcome === "error" ? count : 0,
      usedAt,
    ],
    argTypes: usageArgTypes,
  };
}

async function writeUsageBatch(inputs: OAuthGrantUsageInput[]) {
  const queries = inputs.map(usageQuery);
  await withRuntimeDatabaseAdapter("auth", async (adapter) => {
    // A rejected statement must not dispose the pool while sibling writes run.
    const results = await Promise.allSettled(
      queries.map((query) => adapter.executeRaw(query)),
    );
    const failures = results
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "OAuth grant usage batch write failed",
      );
    }
  });
}

export async function recordOAuthGrantUsage(input: OAuthGrantUsageInput) {
  await writeUsageBatch([input]);
  return true;
}

function usageBatchKey(input: OAuthGrantUsageInput, usedAt: Date) {
  return [
    input.userId,
    input.clientId,
    oauthGrantUsageKey(input.grantId),
    shanghaiDayjs(usedAt).format("YYYY-MM-DD"),
    input.channel,
    input.feature,
    input.action,
    input.outcome ?? "success",
  ].join("\u0000");
}

async function flushPendingUsage(state: UsageBatch) {
  const batch = [...state.pending.values()];
  state.pending.clear();
  await writeUsageBatch(batch);
}

function startUsageFlush(state: UsageBatch) {
  state.flush ??= (async () => {
    do {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, USAGE_BATCH_DELAY_MS);
      });
      await flushPendingUsage(state);
    } while (state.pending.size > 0);
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
      state.flush = undefined;
      if (state.pending.size > 0) {
        const followup = startUsageFlush(state);
        getCloudflareRuntimeTaskScheduler()?.(followup);
      }
    });
  return state.flush;
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
  const context = getCloudflareRuntimeContext();
  if (!context) {
    schedule(
      recordOAuthGrantUsage(input).catch((error: unknown) => {
        logUsageFailure(input, error);
      }),
    );
    return Promise.resolve();
  }
  let state = requestBatches.get(context);
  if (!state) {
    state = { pending: new Map() };
    requestBatches.set(context, state);
  }
  const usedAt = input.usedAt ?? new Date();
  const key = usageBatchKey(input, usedAt);
  const existing = state.pending.get(key);
  if (!existing && state.pending.size >= MAX_PENDING_USAGE_DIMENSIONS) {
    // Bound coalescing memory without losing completed-operation counts.
    const write = recordOAuthGrantUsage({ ...input, usedAt }).catch(
      (error: unknown) => {
        logUsageFailure(input, error);
      },
    );
    schedule(write);
    return Promise.resolve();
  }
  state.pending.set(key, {
    ...input,
    count: (existing?.count ?? 0) + Math.max(1, Math.trunc(input.count ?? 1)),
    usedAt:
      existing?.usedAt && existing.usedAt.getTime() > usedAt.getTime()
        ? existing.usedAt
        : usedAt,
  });
  schedule(startUsageFlush(state));
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
