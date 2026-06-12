import * as z from "zod";
import { normalizeEnvInput } from "./env-normalize";

export function formatIssues(issues: z.ZodIssue[]) {
  return issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
}

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  input: NodeJS.ProcessEnv,
  prefix = "Invalid environment variables",
): z.output<T> {
  const result = schema.safeParse(normalizeEnvInput(input));
  if (result.success) return result.data;
  throw new Error(`${prefix}:\n${formatIssues(result.error.issues)}`);
}
