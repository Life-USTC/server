import { getOptionalTrimmedEnv } from "@/app-env";
import { baseLogPayload, serializeError } from "@/lib/log/app-logger-core";

let fileLogFailureReported = false;

function getLogFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function reportLogFileFailure(error: unknown) {
  if (fileLogFailureReported) return;
  fileLogFailureReported = true;
  console.error(
    JSON.stringify({
      prefix: "[app]",
      ...baseLogPayload(),
      runtime: "server",
      message: "app.log_file_write_failed",
      error: serializeError(error),
    }),
  );
}

export function writeLogFileLine(payload: Record<string, unknown>) {
  if (typeof window !== "undefined") return;

  const logDir = getOptionalTrimmedEnv("APP_LOG_DIR");
  if (!logDir) return;

  try {
    const fs = process.getBuiltinModule("fs");
    const path = process.getBuiltinModule("path");
    const logFile = path.join(logDir, `app-${getLogFileDate()}.log`);
    const line = `${JSON.stringify(payload)}\n`;

    fs.mkdir(logDir, { recursive: true }, (mkdirError) => {
      if (mkdirError) {
        reportLogFileFailure(mkdirError);
        return;
      }

      fs.appendFile(logFile, line, "utf8", (appendError) => {
        if (appendError) {
          reportLogFileFailure(appendError);
        }
      });
    });
  } catch (error) {
    reportLogFileFailure(error);
  }
}
