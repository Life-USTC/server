/** Fixed transport codes only: never log arbitrary error messages or properties. */
const TRANSPORT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const CAUSE_ERROR_NAMES = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "DriverAdapterError",
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
  "PrismaClientValidationError",
]);

/** Read data properties only; diagnostics must not invoke an error's getters. */
function ownValue(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function knownName(value: object): string | undefined {
  let name = ownValue(value, "name");
  // Built-in Error and DOMException names live on their prototypes/accessors.
  if (name === undefined && value instanceof DOMException) {
    try {
      name = Object.getOwnPropertyDescriptor(
        DOMException.prototype,
        "name",
      )?.get?.call(value);
    } catch {
      return undefined;
    }
  }
  if (name === undefined) {
    if (value instanceof TypeError) name = "TypeError";
    else if (value instanceof RangeError) name = "RangeError";
    else if (value instanceof ReferenceError) name = "ReferenceError";
    else if (value instanceof SyntaxError) name = "SyntaxError";
    else if (value instanceof URIError) name = "URIError";
  }
  if (name === "error") return "PostgresError";
  return typeof name === "string" && CAUSE_ERROR_NAMES.has(name)
    ? name
    : undefined;
}

/** Bounded, content-free hints; a missing hint does not identify the failure layer. */
export function getSafeErrorCauseDetails(error: unknown) {
  const details: { causeName?: string; transportCode?: string } = {};
  const seen = new WeakSet<object>();
  let remaining = 16;
  const visit = (value: unknown, depth: number) => {
    if (
      remaining <= 0 ||
      depth > 5 ||
      !value ||
      typeof value !== "object" ||
      seen.has(value)
    )
      return;
    remaining -= 1;
    seen.add(value);
    const code = ownValue(value, "code");
    if (typeof code === "string" && TRANSPORT_ERROR_CODES.has(code))
      details.transportCode ??= code;
    if (depth > 0) details.causeName ??= knownName(value);
    visit(ownValue(value, "cause"), depth + 1);
    const errors = ownValue(value, "errors");
    if (Array.isArray(errors)) {
      for (
        let index = 0;
        index < Math.min(errors.length, 8) && remaining > 0;
        index++
      ) {
        visit(ownValue(errors, String(index)), depth + 1);
      }
    }
  };
  try {
    visit(error, 0);
  } catch {
    // Revoked/hostile proxies cannot replace the original application error.
  }
  return details;
}
