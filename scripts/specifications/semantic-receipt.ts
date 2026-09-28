import { createHash } from "node:crypto";
import { z } from "zod";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

export function expectationDigest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

const escapePointer = (key: string) =>
  key.replaceAll("~", "~0").replaceAll("/", "~1");

/** Empty arrays and objects are obligations too: they must not disappear. */
export function expectationLeaves(value: unknown, pointer = ""): string[] {
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length)
      return entries.flatMap(([key, item]) =>
        expectationLeaves(item, `${pointer}/${escapePointer(key)}`),
      );
  }
  return [pointer];
}

export function expectationValue(value: unknown, pointer: string): unknown {
  if (!pointer) return value;
  if (!pointer.startsWith("/") || /~(?![01])/u.test(pointer))
    throw new Error(`Invalid expectation JSON Pointer: ${pointer}`);
  let current = value;
  for (const raw of pointer.slice(1).split("/")) {
    const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (
      current === null ||
      typeof current !== "object" ||
      !Object.hasOwn(current, key)
    )
      throw new Error(`Unknown expectation field: ${pointer}`);
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const checkSchema = z.strictObject({
  path: z.string(),
  comparison: z.enum(["equal", "set", "minimum", "maximum", "reference"]),
});

export const semanticReceiptSchema = z.strictObject({
  version: z.literal(1),
  requirement: z.string().min(1),
  expectation: z.string().regex(/^[a-f0-9]{64}$/u),
  checks: z.array(checkSchema).min(1),
});

export type SemanticReceipt = z.infer<typeof semanticReceiptSchema>;

export function coveredExpectationPaths(
  expectation: unknown,
  checks: SemanticReceipt["checks"],
): Set<string> {
  const leaves = expectationLeaves(expectation);
  const covered = new Set<string>();
  for (const check of checks) {
    expectationValue(expectation, check.path);
    for (const leaf of leaves)
      if (leaf === check.path || leaf.startsWith(`${check.path}/`))
        covered.add(leaf);
  }
  return covered;
}

/** A receipt is evidence only in conjunction with its passing native test. */
export function validateSemanticReceipt(
  value: unknown,
  requirement: { id: string; expectation?: unknown },
  bindingPaths: readonly string[] = [],
): string[] {
  const parsed = semanticReceiptSchema.safeParse(value);
  if (!parsed.success) return ["Missing or invalid native semantic receipt"];
  const receipt = parsed.data;
  const errors: string[] = [];
  if (receipt.requirement !== requirement.id)
    errors.push("Semantic receipt belongs to another requirement");
  if (receipt.expectation !== expectationDigest(requirement.expectation))
    errors.push("Semantic receipt does not match the current expectation");
  for (const check of receipt.checks)
    if (check.comparison === "reference" && !bindingPaths.includes(check.path))
      errors.push(`Field is not a validated locator binding: ${check.path}`);
  try {
    const covered = coveredExpectationPaths(
      requirement.expectation,
      receipt.checks,
    );
    for (const path of expectationLeaves(requirement.expectation))
      if (!covered.has(path))
        errors.push(`Unverified expectation field: ${path}`);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}
