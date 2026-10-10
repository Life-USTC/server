// Vitest's adjacent redirect replaces the provider boundary without evaluating
// the production singleton or reflecting its lazy proxies during collection.
export {
  betterAuthInstance,
  getSessionFromHeaders,
} from "../../../../tests/shared/oauth-continuation-provider";
