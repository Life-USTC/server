import { expect, it } from "vitest";
import {
  coursesQuerySchema,
  sectionsQuerySchema,
  teachersQuerySchema,
} from "@/lib/api/schemas/request-schemas";
import type { FeatureSpecification } from "../../../../scripts/specifications/repository";
import { readSpecification } from "../../../../scripts/specifications/yaml";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

it("openapi.public-catalog-search-boundaries", async (context) => {
  const contract = await semanticContract(context.task.name, "string_input");
  contract.equal("/surface", "service");
  contract.equal("/operation", "catalogSearchSchema");
  contract.equal("/input", "search");
  const document = await readSpecification<FeatureSpecification>(
    "docs/features/openapi.yaml",
  );
  const rule = document.requirements.find(
    (entry) => entry.id === "openapi.public-catalog-search-boundaries",
  )?.expectation;
  if (rule?.kind !== "string_input" || rule.length_unit !== "utf16_code_units")
    throw new Error("Missing search input contract");
  const minimum = Number(rule.min_length);
  const maximum = Number(rule.max_length);
  const catalogSearchSchema = coursesQuerySchema.shape.search.unwrap();
  contract.equal("/min_length", catalogSearchSchema.minLength);
  contract.equal("/max_length", catalogSearchSchema.maxLength);
  contract.equal("/length_unit", "utf16_code_units");
  contract.equal("/trim", catalogSearchSchema.parse("  ab  ") === "ab");
  for (const schema of [
    coursesQuerySchema,
    sectionsQuerySchema,
    teachersQuerySchema,
  ]) {
    expect(schema.shape.search.unwrap()).toBe(catalogSearchSchema);
    expect(schema.safeParse({}).success).toBe(true);
    for (const input of [
      "",
      " ",
      "a".repeat(minimum - 1),
      "a".repeat(minimum),
      "a".repeat(maximum),
      "a".repeat(maximum + 1),
      `  ${"a".repeat(maximum)}  `,
      "😀".repeat(Math.floor(maximum / 2)),
      "😀".repeat(Math.floor(maximum / 2) + 1),
    ]) {
      const value = rule.trim ? input.trim() : input;
      const valid = value.length >= minimum && value.length <= maximum;
      const result = schema.safeParse({ search: input });
      expect(result.success, JSON.stringify(input)).toBe(valid);
      if (result.success) expect(result.data.search).toBe(value);
    }
  }
  contract.recordVitest(context);
});
