export function parsePositivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function optionalValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function toLoadData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
