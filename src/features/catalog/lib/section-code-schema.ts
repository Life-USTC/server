import * as z from "zod";

export const sectionCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/);

const SECTION_CODE_TOKEN_PATTERN = /[A-Za-z0-9_.-]+/g;

export function extractSectionCodeTokens(value: string) {
  const codes = new Set<string>();

  for (const token of value.match(SECTION_CODE_TOKEN_PATTERN) ?? []) {
    const parsed = sectionCodeSchema.safeParse(token);
    if (parsed.success) {
      codes.add(parsed.data);
    }
  }

  return Array.from(codes);
}
