export function requiredValue<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined)
    throw new Error(`Expected ${name}`);
  return value;
}
