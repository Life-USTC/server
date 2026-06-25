import * as z from "zod";

export const sectionCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/);

const SECTION_CODE_TOKEN_PATTERN = /[A-Za-z0-9_.-]+/g;
const SECTION_CODE_TOKEN_SHAPE =
  /^(?=[A-Za-z0-9_.-]*[A-Za-z])(?=[A-Za-z0-9_.-]*\d)(?=[A-Za-z0-9_.-]*[_.-])[A-Za-z0-9_.-]+$/;

export function extractSectionCodeTokens(value: string) {
  const codes = new Set<string>();

  for (const token of value.match(SECTION_CODE_TOKEN_PATTERN) ?? []) {
    if (!SECTION_CODE_TOKEN_SHAPE.test(token)) {
      continue;
    }

    const parsed = sectionCodeSchema.safeParse(token);
    if (parsed.success) {
      codes.add(parsed.data);
    }
  }

  return Array.from(codes);
}
