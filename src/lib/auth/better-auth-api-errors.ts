import { isDevelopment } from "@/lib/auth/auth-config";
import { logAppEvent } from "@/lib/log/app-logger";
import { isOAuthDebugLogging, logOAuthDebug } from "@/lib/log/oauth-debug";

export const betterAuthApiErrorHandler = {
  onError(error: unknown) {
    if (isDevelopment) {
      logAppEvent(
        "error",
        "Better Auth API error",
        { source: "auth", event: "better-auth.api-error" },
        error,
      );
    }
    if (isOAuthDebugLogging()) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "unknown";
      logOAuthDebug("better-auth.api-error", undefined, {
        message: errorMessage,
        name: errorName,
      });
    }
  },
};
