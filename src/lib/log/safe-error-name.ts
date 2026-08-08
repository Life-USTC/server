const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "APIError",
  "ActionFailure",
  "AggregateError",
  "DOMException",
  "DevalueError",
  "DriverAdapterError",
  "Error",
  "EvalError",
  "HttpError",
  "McpError",
  "PostgresError",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
  "RangeError",
  "Redirect",
  "ReferenceError",
  "SvelteKitError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
  "ValidationError",
  "ZodError",
]);

/** Identifier-shaped constructor names only — no hyphens, spaces, or punctuation. */
const SAFE_CONSTRUCTOR_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]+$/;
const MAX_SAFE_CONSTRUCTOR_NAME_LENGTH = 64;

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

/**
 * Fallback when `.name` is missing or not allowlisted (e.g. SvelteKit
 * `HttpError` / `Redirect` have no `.name`). Constructor names are class
 * identifiers — still no message/stack.
 */
function readSafeConstructorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const ctor = (error as { constructor?: unknown }).constructor;
  if (typeof ctor !== "function") return undefined;

  const { name } = ctor;
  if (typeof name !== "string") return undefined;
  if (name.length === 0 || name.length > MAX_SAFE_CONSTRUCTOR_NAME_LENGTH) {
    return undefined;
  }
  if (!SAFE_CONSTRUCTOR_NAME_PATTERN.test(name)) return undefined;

  return normalizeSafeErrorName(name);
}

export function getSafeErrorName(error: unknown, depth = 0): string {
  if (depth > 5) return "UnknownError";

  const name = readErrorName(error);
  if (name) {
    const normalized = normalizeSafeErrorName(name);
    if (SAFE_ERROR_NAMES.has(normalized)) {
      // Bun/Node often leave Error subclasses with `.name === "Error"`
      // (e.g. SvelteKitError). Prefer a more specific safe constructor name.
      if (normalized === "Error") {
        const ctorName = readSafeConstructorName(error);
        if (ctorName && ctorName !== "Error") {
          return ctorName;
        }
      }
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

  return readSafeConstructorName(error) ?? "UnknownError";
}
