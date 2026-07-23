const SAFE_ERROR_NAMES = new Set([
  "AbortError",
  "DOMException",
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

export function getSafeErrorName(error: unknown) {
  if (!(error instanceof Error) || !SAFE_ERROR_NAMES.has(error.name)) {
    return "UnknownError";
  }
  return error.name;
}
