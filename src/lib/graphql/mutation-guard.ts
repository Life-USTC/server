import type { RestFeature } from "@/lib/oauth/constants";
import {
  checkUserMutationRateLimit,
  USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS,
  type UserMutationRateLimitTier,
} from "@/lib/security/user-mutation-rate-limit";
import { requireGraphqlScope } from "./auth";
import type { GraphqlContext } from "./context";
import { GraphqlMutationError } from "./mutation-errors";

export async function requireGraphqlMutation(
  context: Pick<GraphqlContext, "principal" | "request">,
  feature: RestFeature,
  options: { rateLimitTier?: UserMutationRateLimitTier } = {},
) {
  const principal = requireGraphqlScope(context.principal, {
    feature,
    action: "write",
  });
  const rateLimitTier = options.rateLimitTier ?? "write";
  const outcome = await checkUserMutationRateLimit({
    action: `${feature}:${rateLimitTier === "batch" ? "batch-write" : "write"}`,
    host: new URL(context.request.url).host,
    tier: rateLimitTier,
    userId: principal.userId,
  });
  if (outcome.allowed) return principal;

  if (outcome.reason === "limited") {
    throw new GraphqlMutationError(
      `Rate limit exceeded. Retry after ${USER_MUTATION_RATE_LIMIT_PERIOD_SECONDS} seconds.`,
      "RATE_LIMITED",
      429,
    );
  }
  throw new GraphqlMutationError(
    "Rate limiting unavailable.",
    "SERVICE_UNAVAILABLE",
    503,
  );
}
