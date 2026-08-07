const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "APIError",
  "AggregateError",
  "DOMException",
  "DevalueError",
  "DriverAdapterError",
  "Error",
  "EvalError",
  "McpError",
  "PostgresError",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
  "ZodError",
]);

function readErrorName(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }
  return undefined;
}

/**
 * node-pg `DatabaseError` uses lowercase name `"error"`. Map it to the
 * allowlisted Postgres label so production logs stay diagnosable without
 * leaking the message.
 */
function normalizeSafeErrorName(name: string) {
  if (name === "error") return "PostgresError";
  return name;
}

export function getSafeErrorName(error: unknown, depth = 0): string {
  if (depth > 5) return "UnknownError";

  const name = readErrorName(error);
  if (name) {
    const normalized = normalizeSafeErrorName(name);
    if (SAFE_ERROR_NAMES.has(normalized)) {
      return normalized;
    }
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    const nested = getSafeErrorName(
      (error as { cause: unknown }).cause,
      depth + 1,
    );
    if (nested !== "UnknownError") {
      return nested;
    }
  }

  return "UnknownError";
}
