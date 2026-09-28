import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateDomainExpectation } from "../../../scripts/specifications/domain-semantics";
import { repositoryRoot } from "../../../scripts/specifications/yaml";

const root = repositoryRoot;
const operation = {
  module: "src/features/young/server/young-notification-state.ts",
  export: "youngReminderCandidates",
};
const window = {
  kind: "reminder_window",
  operation,
  anchor: "applyEndAt",
  notification: "signup_deadline",
  lead_seconds: 86400,
  before_window: false,
  at_open: true,
  before_close: true,
  at_close: false,
};
const schema = JSON.parse(
  readFileSync(`${root}/docs/schemas/domain-expectations.schema.json`, "utf8"),
);
const ajv = new Ajv2020({ strict: true });
ajv.addSchema(schema);
const valid = ajv.compile({ $ref: `${schema.$id}#/$defs/expectation` });
const openapi = JSON.parse(
  readFileSync(`${root}/public/openapi.generated.json`, "utf8"),
);
const projection = {
  kind: "public_projection",
  operation,
  response: { schema: "sectionDetailSchema", path: "teachers/items" },
  fields: ["id", "jwId"],
  preserves: { id: true, "department/id": true },
  concealed_source_values: true,
};

describe("domain expectation references", () => {
  it("accepts closed reminder boundaries and rejects unknown or malformed values", () => {
    expect(valid(window)).toBe(true);
    expect(valid({ ...window, lead_seconds: -1 })).toBe(false);
    expect(
      valid({ ...window, arbitrary_expression: "actual == expected" }),
    ).toBe(false);
    expect(valid({ ...window, notification: "whatever" })).toBe(false);
  });
  it("resolves source exports and only exempts locator fields", () => {
    expect(validateDomainExpectation(window, { root })).toEqual({
      errors: [],
      validatedPaths: [],
      bindingPaths: ["/operation/module", "/operation/export"],
    });
    expect(
      validateDomainExpectation(
        { ...window, operation: { ...operation, export: "missingOperation" } },
        { root },
      ).errors.join(" "),
    ).toContain("missing exported operation");
    expect(
      validateDomainExpectation(
        {
          ...window,
          operation: {
            module:
              "../server/src/features/young/server/young-notification-state.ts",
            export: operation.export,
          },
        },
        { root },
      ).bindingPaths,
    ).toEqual([]);
  });
  it("requires OpenAPI and resolves nested projection fields without consuming them", () => {
    expect(
      validateDomainExpectation(projection, { root }).errors.join(" "),
    ).toContain("requires the generated OpenAPI");
    const result = validateDomainExpectation(projection, { root, openapi });
    expect(result.errors).toEqual([]);
    expect(result.validatedPaths).toContain("/preserves/department~1id");
    expect(result.bindingPaths).not.toContain("/fields/0");
    expect(result.bindingPaths).not.toContain("/preserves/department~1id");
  });
  it("rejects misspelled schema, projection and preserved-value paths", () => {
    for (const changed of [
      { ...projection, fields: ["privateOrMisspelled"] },
      { ...projection, preserves: { "department/private": true } },
      {
        ...projection,
        response: { schema: "missingSchema", path: "teachers/items" },
      },
      {
        ...projection,
        response: { schema: "sectionDetailSchema", path: "teachers/missing" },
      },
    ]) {
      const result = validateDomainExpectation(changed, { root, openapi });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.bindingPaths).toEqual([]);
    }
  });
  it("requires a model catalog and rejects invented order fields", () => {
    const page = {
      kind: "ordered_page",
      operation,
      model: "Semester",
      order: [{ field: "startDate", direction: "desc", nulls: "last" }],
    };
    expect(
      validateDomainExpectation(page, { root }).errors.join(" "),
    ).toContain("requires the Prisma model");
    const models = new Map([["Semester", new Set(["startDate", "jwId"])]]);
    expect(validateDomainExpectation(page, { root, models }).errors).toEqual(
      [],
    );
    expect(
      validateDomainExpectation(
        { ...page, order: [{ field: "fabricated" }] },
        { root, models },
      ).errors.join(" "),
    ).toContain("unknown model field");
  });
  it("rejects duplicate effects even when their expected counts differ", () => {
    const result = validateDomainExpectation(
      {
        kind: "transaction_effects",
        operation,
        before_commit: [
          { operation, calls: 0 },
          { operation, calls: 1 },
        ],
      },
      { root },
    );
    expect(result.errors).toContain(
      "before_commit: duplicate effect operation",
    );
  });
});
