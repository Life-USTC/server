import { isDevelopment } from "@/lib/auth/auth-config";
import { logAppEvent } from "@/lib/log/app-logger";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

function oauthApiErrorEventKey(error: unknown): string {
  if (!error || typeof error !== "object") return "better-auth.api-error";
  const code =
    "code" in error && typeof error.code === "string"
      ? error.code
      : "error" in error && typeof error.error === "string"
        ? error.error
        : undefined;
  if (code === "state_mismatch" || code === "state_not_found") {
    return "oauth.callback.state_mismatch";
  }
  if (code === "invalid_grant") return "oauth.token.invalid_grant";
  if (code === "invalid_request") return "oauth.token.invalid_request";
  return "better-auth.api-error";
}

export const betterAuthApiErrorHandler = {
  onError(error: unknown) {
    const event = oauthApiErrorEventKey(error);
    if (isDevelopment()) {
      logAppEvent(
        "error",
        "Better Auth API error",
        { source: "auth", event },
        error,
      );
    }
    if (isOAuthDebugLogging()) {
      logOAuthDebug(event, undefined, {
        errorName: getSafeErrorName(error),
      });
    }
  },
};
