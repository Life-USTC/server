import { describe, expect, it } from "vitest";
import {
  coursesQuerySchema,
  sectionsQuerySchema,
  teachersQuerySchema,
} from "@/lib/api/schemas/request-schemas";

describe.each([
  ["courses", coursesQuerySchema],
  ["sections", sectionsQuerySchema],
  ["teachers", teachersQuerySchema],
] as const)("%s catalog search", (_name, schema) => {
  it("uses the shared search schema and accepts an omitted search", () => {
    expect(schema.shape.search.unwrap()).toBe(
      coursesQuerySchema.shape.search.unwrap(),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });

  it.each([
    ["empty", "", false],
    ["whitespace", " ", false],
    ["below minimum", "a", false],
    ["minimum", "ab", true],
    ["maximum", "a".repeat(200), true],
    ["above maximum", "a".repeat(201), false],
    ["padded minimum", "  ab  ", true],
    ["padded maximum", `  ${"a".repeat(200)}  `, true],
    ["supplementary Unicode at maximum", "😀".repeat(100), true],
    ["supplementary Unicode above maximum", "😀".repeat(101), false],
  ] as const)(
    "handles %s after trimming using UTF-16 length",
    (_label, search, valid) => {
      const result = schema.safeParse({ search });
      expect(result.success).toBe(valid);
      if (result.success) expect(result.data.search).toBe(search.trim());
    },
  );
});
