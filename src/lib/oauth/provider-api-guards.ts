export function asRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  throw new Error(message);
}

export function requireMethod<TArgs extends unknown[], TReturn>(
  target: Record<string, unknown>,
  label: string,
  method: string,
): (...args: TArgs) => TReturn {
  const fn = target[method];
  if (typeof fn !== "function")
    throw new Error(`${label} is unavailable: missing ${method}()`);
  return fn.bind(target) as (...args: TArgs) => TReturn;
}
