export function trimOrUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function parsePositiveIntOrUndefined(value: string | undefined) {
  const trimmed = trimOrUndefined(value);
  if (!trimmed) return undefined;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function normalizeEnvInput(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => {
        if (typeof value !== "string") return [key, undefined];
        if (key === "UPLOAD_TOTAL_QUOTA_MB")
          return [key, parsePositiveIntOrUndefined(value)];
        return [key, trimOrUndefined(value)];
      })
      .filter(([, v]) => v !== undefined),
  );
}
