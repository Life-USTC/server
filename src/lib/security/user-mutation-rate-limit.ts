import {
  getCloudflareUserMutationRateLimiter,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { logAppEvent } from "@/lib/log/app-logger";

export const USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS = 60;

export type UserMutationRateLimitTier = "batch" | "write";

export type UserMutationRateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "limited" | "unavailable" };

function rateLimitKey(input: { action: string; host: string; userId: string }) {
  return JSON.stringify([
    "user-mutation:v1",
    input.host.trim().toLowerCase(),
    input.action,
    input.userId,
  ]);
}

function logUnavailableRateLimiter(
  action: string,
  tier: UserMutationRateLimitTier,
  reason: "binding-error" | "binding-missing",
  error?: unknown,
) {
  logAppEvent(
    "error",
    "user-mutation-rate-limit.unavailable",
    {
      action,
      event: "user-mutation-rate-limit.unavailable",
      reason,
      source: "rate-limit",
      tier,
    },
    error,
  );
}

/**
 * Enforce a per-deployment, per-user, per-action mutation budget.
 *
 * Host-native development has no Cloudflare runtime and intentionally bypasses
 * the gate. Once a Cloudflare runtime is present, a missing or failing binding
 * fails closed so a deployment cannot silently lose its abuse protection.
 */
export async function checkUserMutationRateLimit(input: {
  action: string;
  host: string;
  tier?: UserMutationRateLimitTier;
  userId: string;
}): Promise<UserMutationRateLimitResult> {
  const tier = input.tier ?? "write";
  const limiter = getCloudflareUserMutationRateLimiter(tier);
  if (limiter == null) {
    if (!hasCloudflareRuntimeEnv()) return { allowed: true };
    logUnavailableRateLimiter(input.action, tier, "binding-missing");
    return { allowed: false, reason: "unavailable" };
  }

  try {
    const outcome = await limiter.limit({ key: rateLimitKey(input) });
    return outcome.success
      ? { allowed: true }
      : { allowed: false, reason: "limited" };
  } catch (error) {
    logUnavailableRateLimiter(input.action, tier, "binding-error", error);
    return { allowed: false, reason: "unavailable" };
  }
}
