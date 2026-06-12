const API_ERROR_MESSAGE_KEYS = ["error", "message", "detail"] as const;

function trimmedMessage(value: string | undefined): string | null {
  return value?.trim() || null;
}

function normalizeStringMessage(value: unknown): string | null | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }
  return trimmedMessage(value);
}

function asErrorRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function firstStringMessage(
  record: Record<string, unknown>,
  keys: readonly string[] = API_ERROR_MESSAGE_KEYS,
): string | null | undefined {
  for (const key of keys) {
    const message = normalizeStringMessage(record[key]);
    if (message !== undefined) {
      return message;
    }
  }

  return undefined;
}

function firstRecordMessage(
  value: unknown,
  keys: readonly string[] = API_ERROR_MESSAGE_KEYS,
): string | null | undefined {
  const record = asErrorRecord(value);
  return record ? firstStringMessage(record, keys) : undefined;
}

export function extractApiErrorMessage(errorBody: unknown): string | null {
  if (typeof errorBody === "string") {
    return trimmedMessage(errorBody);
  }
  if (errorBody instanceof Error) {
    return trimmedMessage(errorBody.message);
  }

  const anyBody = asErrorRecord(errorBody);
  if (!anyBody) {
    return null;
  }

  const direct = firstStringMessage(anyBody);
  if (direct !== undefined) {
    return direct;
  }

  const nestedDirect = firstRecordMessage(anyBody.error);
  if (nestedDirect !== undefined) {
    return nestedDirect;
  }

  const errors = anyBody.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const firstMessage = firstRecordMessage(errors[0], ["message", "error"]);
    if (firstMessage !== undefined) {
      return firstMessage;
    }
  }

  return null;
}
