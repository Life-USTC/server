import { describe, expect, test } from "vitest";
import {
  expectationDigest,
  expectationLeaves,
  expectationValue,
  validateSemanticReceipt,
} from "../../../scripts/specifications/semantic-receipt";
import { SemanticContract } from "../../shared/specifications/semantic-contract";

const requirement = () => ({
  id: "example.collection",
  category: "consistency",
  expectation: {
    kind: "example",
    bounds: { minimum: 2, maximum: 4 },
    fields: ["id", "title"],
    cases: [{ id: "later-page", partial_output: false }],
    omitted: [],
  },
});

function verifyAll(contract: SemanticContract) {
  contract.equal("/kind", "example");
  contract.atLeast("/bounds/minimum", 3);
  contract.atMost("/bounds/maximum", 3);
  contract.set("/fields", ["title", "id"]);
  contract.equal("/cases/0/id", "later-page");
  contract.equal("/cases/0/partial_output", false);
  contract.equal("/omitted", []);
}

function context(name = "example.collection") {
  return { task: { name, meta: {} as Record<string, unknown> } };
}

describe("semantic assertion evidence", () => {
  test("does not let consumers rewrite expected values to match observations", () => {
    const contract = new SemanticContract(requirement());
    const value = contract.expectation<{ bounds: { maximum: number } }>();
    expect(() => {
      value.bounds.maximum = 10;
    }).toThrow();
    expect(() => contract.atMost("/bounds/maximum", 10)).toThrow();
  });
  test("records only completed comparisons and rejects a missing business field", () => {
    const contract = new SemanticContract(requirement());
    contract.expectation();
    contract.equal("/kind", "example");
    const native = context();
    expect(() => contract.recordVitest(native)).toThrow(
      "unverified expectation fields",
    );
    expect(native.task.meta).toEqual({});
    expect(() => contract.equal("/cases/0/partial_output", true)).toThrow();
    expect(() => contract.recordVitest(native)).toThrow();
  });

  test("covers every leaf including empty values and binds the native canonical identity", () => {
    const rule = requirement();
    const contract = new SemanticContract(rule);
    verifyAll(contract);
    const native = context();
    expect(() => contract.recordVitest(context("other.requirement"))).toThrow();
    contract.recordVitest(native);
    expect(
      validateSemanticReceipt(native.task.meta.specification, rule),
    ).toEqual([]);
    expect(() => contract.recordVitest(native)).toThrow(
      "Duplicate semantic receipt",
    );
  });

  test("changed expectations invalidate an otherwise passing receipt", () => {
    const rule = requirement();
    const contract = new SemanticContract(rule);
    verifyAll(contract);
    const native = context();
    contract.recordVitest(native);
    const changed = structuredClone(rule);
    changed.expectation.bounds.maximum = 2;
    expect(
      validateSemanticReceipt(native.task.meta.specification, changed),
    ).toContain("Semantic receipt does not match the current expectation");
    const changedConsumer = new SemanticContract(changed);
    expect(() => verifyAll(changedConsumer)).toThrow("above maximum");
  });

  test("new scenarios and unknown fields cannot inherit another check's coverage", () => {
    const rule = requirement();
    rule.expectation.cases.push({ id: "empty", partial_output: false });
    const contract = new SemanticContract(rule);
    verifyAll(contract);
    expect(() => contract.recordVitest(context())).toThrow();
    expect(() => contract.equal("/cases/10/id", "empty")).toThrow(
      "Unknown expectation field",
    );
    expect(() => contract.equal("/bounds/min", 2)).toThrow(
      "Unknown expectation field",
    );
  });

  test("rejects unexpected and duplicate members in observed projections", () => {
    const contract = new SemanticContract(requirement());
    expect(() => contract.set("/fields", ["id", "title", "secret"])).toThrow();
    expect(() => contract.set("/fields", ["id", "id"])).toThrow();
    expect(() => contract.atLeast("/bounds/minimum", Number.NaN)).toThrow();
    expect(() =>
      contract.atMost("/bounds/maximum", Number.POSITIVE_INFINITY),
    ).toThrow();
  });

  test("uses native Playwright annotations without creating another test identity", () => {
    const rule = requirement();
    const contract = new SemanticContract(rule);
    verifyAll(contract);
    const native = {
      title: rule.id,
      annotations: [] as { type: string; description?: string }[],
    };
    contract.recordPlaywright(native);
    expect(native.annotations).toHaveLength(1);
    expect(native.annotations[0].type).toBe("specification");
    expect(
      validateSemanticReceipt(
        JSON.parse(native.annotations[0].description ?? "null"),
        rule,
      ),
    ).toEqual([]);
  });

  test("rejects receipt comparison modes that cannot verify the addressed field", () => {
    const rule = requirement();
    for (const comparison of ["minimum", "maximum", "set"]) {
      const issues = validateSemanticReceipt(
        {
          version: 1,
          requirement: rule.id,
          expectation: expectationDigest(rule.expectation),
          checks: [{ path: "", comparison }],
        },
        rule,
      );
      expect(issues.join(" ")).toContain("comparison requires");
    }
  });
  test("does not accept self-declared reference checks for business values", () => {
    const rule = requirement();
    expect(
      validateSemanticReceipt(
        {
          version: 1,
          requirement: rule.id,
          expectation: expectationDigest(rule.expectation),
          checks: [{ path: "", comparison: "reference" }],
        },
        rule,
      ),
    ).toContain("Missing or invalid native semantic receipt");
    expect(validateSemanticReceipt(undefined, rule)).toContain(
      "Missing or invalid native semantic receipt",
    );
  });
});

describe("expectation addressing", () => {
  test("hashes mappings independently of key order and preserves array order", () => {
    expect(expectationDigest({ a: 1, b: [2, 3] })).toBe(
      expectationDigest({ b: [2, 3], a: 1 }),
    );
    expect(expectationDigest([2, 3])).not.toBe(expectationDigest([3, 2]));
  });
  test("uses exact JSON Pointers and includes empty collections", () => {
    const value = { "a/b": { "~key": [] }, empty: {} };
    expect(expectationLeaves(value)).toEqual(["/a~1b/~0key", "/empty"]);
    expect(expectationValue(value, "/a~1b/~0key")).toEqual([]);
    expect(() => expectationValue(value, "/a~1b/~key")).toThrow(
      "Invalid expectation JSON Pointer",
    );
    expect(() => expectationValue(value, "/toString")).toThrow(
      "Unknown expectation field",
    );
  });
});
