import { describe, expect, it } from "vitest";
import type { SpecificationFile } from "../../../scripts/specifications/repository";
import {
  loadSpecificationValidators,
  validateSpecificationReferences,
  validateSpecificationShapes,
} from "../../../scripts/specifications/validate";

function specification(
  expectation: Record<string, unknown>,
): SpecificationFile {
  return {
    path: "docs/features/example.yaml",
    data: {
      kind: "feature",
      id: "example",
      name: "Example",
      areas: ["workspace"],
      requirements: [
        {
          id: "example.limit",
          category: "validation",
          applies_to: ["list"],
          expectation,
          acceptance: {
            given: "A request exceeding the maximum",
            when: "The real route validates the request",
            // biome-ignore lint/suspicious/noThenProperty: Non-callable acceptance outcomes.
            then: ["The request is rejected"],
            test: {
              file: "tests/unit/contracts/specifications-schema.test.ts",
              name: "example.limit",
            },
          },
        },
      ],
      capabilities: {
        list: {
          title: "List",
          auth: "user",
          rest: { routes: [{ path: "/api/example" }] },
        },
      },
    },
  };
}

function numeric() {
  return {
    kind: "numeric_input",
    surface: "rest",
    operation: "GET /api/example",
    input: "limit",
    minimum: 1,
    maximum: 200,
    default: 100,
    integer: true,
  };
}

describe("typed specification expectations", () => {
  it("accepts finite cache freshness rules and rejects ambiguous or invalid expiry policies", async () => {
    const validators = await loadSpecificationValidators();
    const value = {
      kind: "cache_freshness",
      surface: "service",
      operation: "getWeatherSnapshot",
      timestamp: "fetchedAt",
      max_age_seconds: 900,
      expires_at_boundary: true,
      invalid_timestamps: "refresh",
      future_timestamps: "refresh",
      refresh_failure: "unavailable",
    };
    expect(
      validateSpecificationShapes([specification(value)], validators),
    ).toEqual([]);
    for (const invalid of [
      { ...value, max_age_seconds: 0 },
      { ...value, max_age_seconds: 0.5 },
      { ...value, max_age_seconds: "900" },
      { ...value, expires_at_boundary: false },
      { ...value, invalid_timestamps: "serve" },
      { ...value, future_timestamps: "serve" },
      { ...value, refresh_failure: "pretend-fresh" },
    ]) {
      expect(
        validateSpecificationShapes([specification(invalid)], validators),
      ).not.toEqual([]);
    }
  });
  it("rejects the obsolete many-to-many acceptance shape", async () => {
    const validators = await loadSpecificationValidators();
    const file = specification(numeric());
    const requirement = (
      file.data.requirements as Array<Record<string, unknown>>
    )[0];
    const acceptance = requirement.acceptance as Record<string, unknown>;
    requirement.acceptance = [acceptance];
    expect(
      validateSpecificationShapes([file], validators).join("\n"),
    ).toContain("must be object");
    requirement.acceptance = { ...acceptance, tests: [acceptance.test] };
    expect(
      validateSpecificationShapes([file], validators).join("\n"),
    ).toContain("additional properties");
  });
  it("requires bound acceptance tests for typed expectations and disallows duplicate prose rules", async () => {
    const validators = await loadSpecificationValidators();
    const file = specification(numeric());
    expect(validateSpecificationShapes([file], validators)).toEqual([]);
    const requirement = (
      file.data.requirements as Array<Record<string, unknown>>
    )[0];
    requirement.rule = "Another independently maintained limit";
    expect(validateSpecificationShapes([file], validators)).not.toEqual([]);
    delete requirement.rule;
    const acceptance = requirement.acceptance as Record<string, unknown>;
    delete acceptance.test;
    expect(
      validateSpecificationShapes([file], validators).join("\n"),
    ).toContain("test");
    delete requirement.acceptance;
    expect(
      validateSpecificationShapes([file], validators).join("\n"),
    ).toContain("acceptance");
  });

  it("rejects unknown expectation kinds, mistyped constraints and undeclared fields", async () => {
    const validators = await loadSpecificationValidators();
    for (const value of [
      {
        ...numeric(),
        kind: "arbitrary_expression",
        expression: "limit <= 200",
      },
      { ...numeric(), maximum: "200" },
      { ...numeric(), maximmum: 200 },
    ]) {
      expect(
        validateSpecificationShapes([specification(value)], validators),
      ).not.toEqual([]);
    }
  });

  it("rejects contradictory bounds, defaults and integer constraints", async () => {
    for (const [value, message] of [
      [{ ...numeric(), minimum: 201 }, "minimum must not exceed maximum"],
      [{ ...numeric(), default: 201 }, "default must be within"],
      [{ ...numeric(), default: 1.5 }, "integer constraints require"],
    ] as const) {
      expect(
        (
          await validateSpecificationReferences([specification(value)])
        ).errors.join("\n"),
      ).toContain(message);
    }
  });

  it("rejects typed operations that do not belong to an applicable capability", async () => {
    const result = await validateSpecificationReferences([
      specification({ ...numeric(), operation: "POST /api/example" }),
    ]);
    expect(result.errors.join("\n")).toContain(
      "not declared on the applicable rest capability",
    );
  });

  it("checks requirement references independent of document ordering", async () => {
    const file = specification(numeric());
    (
      file.data.capabilities as Record<string, Record<string, unknown>>
    ).list.requirement_refs = ["example.limit"];
    expect(
      (await validateSpecificationReferences([file])).errors.join("\n"),
    ).not.toContain("unknown requirement");
    (
      file.data.capabilities as Record<string, Record<string, unknown>>
    ).list.requirement_refs = ["example.missing"];
    expect(
      (await validateSpecificationReferences([file])).errors.join("\n"),
    ).toContain("unknown requirement example.missing");
  });

  it("rejects duplicate authorization cases and contradictory visibility states", async () => {
    const entry = {
      id: "owner",
      authenticated: true,
      suspended: false,
      role: "user",
      relationship: "owner",
      outcome: "allowed",
    };
    const auth = specification({
      kind: "authorization",
      surface: "service",
      operation: "delete",
      cases: [entry, entry],
      denied_effects: ["todo"],
    });
    expect(
      (await validateSpecificationReferences([auth])).errors.join("\n"),
    ).toContain("duplicate authorization case owner");
    const display = specification({
      kind: "state_visibility",
      surface: "web",
      targets: ["detail"],
      state: { completed: true },
      visible: ["due_at"],
      hidden: ["due_at"],
      restore_on_incomplete: ["deadline_reminder"],
    });
    const errors = (
      await validateSpecificationReferences([display])
    ).errors.join("\n");
    expect(errors).toContain("cannot be both visible and hidden");
    expect(errors).toContain("must be hidden before it can be restored");
  });
});
