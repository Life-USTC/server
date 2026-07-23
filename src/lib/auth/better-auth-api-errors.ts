import { isDevelopment } from "@/lib/auth/auth-config";
import { logAppEvent } from "@/lib/log/app-logger";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";
import { getSafeErrorName } from "@/lib/log/safe-error-name";

export const betterAuthApiErrorHandler = {
  onError(error: unknown) {
    if (isDevelopment()) {
      logAppEvent(
        "error",
        "Better Auth API error",
        { source: "auth", event: "better-auth.api-error" },
        error,
      );
    }
    if (isOAuthDebugLogging()) {
      logOAuthDebug("better-auth.api-error", undefined, {
        errorName: getSafeErrorName(error),
      });
    }
  },
};
