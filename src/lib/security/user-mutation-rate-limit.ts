import {
  getCloudflareUserMutationRateLimiter,
  hasCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";

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
    return hasCloudflareRuntimeEnv()
      ? { allowed: false, reason: "unavailable" }
      : { allowed: true };
  }

  try {
    const outcome = await limiter.limit({ key: rateLimitKey(input) });
    return outcome.success
      ? { allowed: true }
      : { allowed: false, reason: "limited" };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}
