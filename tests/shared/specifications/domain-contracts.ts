import type { SemanticContract } from "./semantic-contract";

/** The callable returned here is the same real operation whose import is recorded. */
export function bindDomainOperation<T extends (...args: never[]) => unknown>(
  contract: SemanticContract,
  module: string,
  execute: T,
): T {
  contract.equal("/operation", { module, export: execute.name });
  return execute;
}

/** Read actual object values, including nested references, independently of expected booleans. */
export function projectionPreservation(
  paths: readonly string[],
  actual: unknown,
  source: unknown,
): Record<string, boolean> {
  const read = (value: unknown, path: string): unknown => {
    for (const key of path.split("/")) {
      if (value === null || typeof value !== "object" || !(key in value))
        throw new Error(`Missing observed projection path: ${path}`);
      value = (value as Record<string, unknown>)[key];
    }
    return value;
  };
  return Object.fromEntries(
    paths.map((path) => [
      path,
      JSON.stringify(read(actual, path)) === JSON.stringify(read(source, path)),
    ]),
  );
}
