import {
  type AppLogLevel,
  getLogMethod,
  isProductionEnvironment,
  safeJsonStringify,
  serializeError,
} from "@/lib/log/app-logger-core";

type RuntimeIssueRecorder = (
  level: AppLogLevel,
  payload: Record<string, unknown>,
) => void;
let runtimeIssueRecorder: RuntimeIssueRecorder | undefined;

/** Installed by server request infrastructure; client logging has no database dependency. */
export function setRuntimeIssueRecorder(recorder: RuntimeIssueRecorder) {
  runtimeIssueRecorder = recorder;
}

export function emitLog(
  prefix: string,
  level: AppLogLevel,
  payload: Record<string, unknown>,
  error?: unknown,
) {
  try {
    runtimeIssueRecorder?.(level, payload);
  } catch {
    /* Logging is fail-open. */
  }
  const method = getLogMethod(level);
  const serializedError = serializeError(error);

  if (isProductionEnvironment()) {
    const logObj = {
      prefix,
      ...payload,
      ...(serializedError ? { error: serializedError } : {}),
    };
    method(
      safeJsonStringify(
        logObj,
        JSON.stringify({
          environment: "production",
          event: "log.serialization-failed",
          message: "Log serialization failed",
          prefix: "[app]",
        }),
      ),
    );
    return;
  }

  if (serializedError) {
    method(prefix, payload, serializedError);
  } else {
    method(prefix, payload);
  }
}
