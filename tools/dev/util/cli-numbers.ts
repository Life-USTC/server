type CliIntegerOptions = {
  min?: number;
  max?: number;
};

const INTEGER_PATTERN = /^-?\d+$/;

function isWithinBounds(value: number, options: CliIntegerOptions) {
  if (options.min !== undefined && value < options.min) {
    return false;
  }
  if (options.max !== undefined && value > options.max) {
    return false;
  }
  return true;
}

export function parseOptionalCliInteger(
  value: string | undefined,
  options: CliIntegerOptions = {},
) {
  const trimmed = value?.trim();
  if (!trimmed || !INTEGER_PATTERN.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }
  if (!isWithinBounds(parsed, options)) {
    return null;
  }

  return parsed;
}

export function parseCliInteger(
  value: string | undefined,
  fallback: number,
  options: CliIntegerOptions = {},
) {
  return parseOptionalCliInteger(value, options) ?? fallback;
}

export function parseCliIntegerList(
  value: string | undefined,
  options: CliIntegerOptions = {},
) {
  return (value ?? "").split(",").flatMap((entry) => {
    const parsed = parseOptionalCliInteger(entry, options);
    return parsed === null ? [] : [parsed];
  });
}
