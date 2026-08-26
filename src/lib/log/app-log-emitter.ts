import {
  type AppLogLevel,
  getLogMethod,
  isProductionEnvironment,
  safeJsonStringify,
  serializeError,
} from "@/lib/log/app-logger-core";

export function emitLog(
  prefix: string,
  level: AppLogLevel,
  payload: Record<string, unknown>,
  error?: unknown,
) {
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
