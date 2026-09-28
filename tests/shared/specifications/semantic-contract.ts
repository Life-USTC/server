import { deepStrictEqual, ok } from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { TestInfo } from "@playwright/test";
import type { TestContext } from "vitest";
import {
  type Requirement,
  readSpecifications,
} from "../../../scripts/specifications/repository";
import {
  coveredExpectationPaths,
  expectationDigest,
  expectationLeaves,
  expectationValue,
  type SemanticReceipt,
} from "../../../scripts/specifications/semantic-receipt";
import { collectRequirements } from "../../../scripts/specifications/validate";

function freezeExpectation(value: unknown): void {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeExpectation(child);
    Object.freeze(value);
  }
}

/** Only completed comparisons enter the ledger; merely reading a field does not. */
export class SemanticContract {
  readonly #requirement: Requirement;
  readonly #checks: SemanticReceipt["checks"] = [];

  constructor(requirement: Requirement) {
    ok(requirement.expectation, `${requirement.id}: missing typed expectation`);
    this.#requirement = structuredClone(requirement);
    freezeExpectation(this.#requirement.expectation);
  }

  expectation<T>(): T {
    return this.#requirement.expectation as T;
  }

  #value(pointer: string): unknown {
    return expectationValue(this.#requirement.expectation, pointer);
  }

  equal(pointer: string, actual: unknown): void {
    deepStrictEqual(
      actual,
      this.#value(pointer),
      `${this.#requirement.id}${pointer}`,
    );
    this.#checks.push({ path: pointer, comparison: "equal" });
  }

  set(pointer: string, actual: readonly unknown[]): void {
    const expected = this.#value(pointer);
    ok(Array.isArray(expected), `${pointer}: expected an array`);
    const unique = (values: readonly unknown[]) =>
      values.every((value, index) =>
        values
          .slice(0, index)
          .every((other) => !isDeepStrictEqual(value, other)),
      );
    ok(unique(expected), `${pointer}: duplicate expected set member`);
    ok(unique(actual), `${pointer}: duplicate actual set member`);
    ok(
      actual.length === expected.length &&
        expected.every((item) =>
          actual.some((value) => isDeepStrictEqual(item, value)),
        ),
      `${this.#requirement.id}${pointer}: observed set differs from expectation`,
    );
    this.#checks.push({ path: pointer, comparison: "set" });
  }

  atLeast(pointer: string, actual: number): void {
    const expected = this.#value(pointer);
    ok(typeof expected === "number" && Number.isFinite(expected));
    ok(
      Number.isFinite(actual) && actual >= expected,
      `${this.#requirement.id}${pointer}: below minimum`,
    );
    this.#checks.push({ path: pointer, comparison: "minimum" });
  }

  atMost(pointer: string, actual: number): void {
    const expected = this.#value(pointer);
    ok(typeof expected === "number" && Number.isFinite(expected));
    ok(
      Number.isFinite(actual) && actual <= expected,
      `${this.#requirement.id}${pointer}: above maximum`,
    );
    this.#checks.push({ path: pointer, comparison: "maximum" });
  }

  #receipt(): SemanticReceipt {
    const covered = coveredExpectationPaths(
      this.#requirement.expectation,
      this.#checks,
    );
    const missing = expectationLeaves(this.#requirement.expectation).filter(
      (path) => !covered.has(path),
    );
    deepStrictEqual(
      missing,
      [],
      `${this.#requirement.id}: unverified expectation fields`,
    );
    return {
      version: 1,
      requirement: this.#requirement.id,
      expectation: expectationDigest(this.#requirement.expectation),
      checks: [...this.#checks],
    };
  }

  recordVitest(context: {
    task: Pick<TestContext["task"], "name" | "meta">;
  }): void {
    deepStrictEqual(
      context.task.name,
      this.#requirement.id,
      "Semantic evidence must belong to its canonical test",
    );
    ok(
      !Object.hasOwn(context.task.meta, "specification"),
      "Duplicate semantic receipt",
    );
    Object.assign(context.task.meta, { specification: this.#receipt() });
  }

  recordPlaywright(info: Pick<TestInfo, "title" | "annotations">): void {
    deepStrictEqual(
      info.title,
      this.#requirement.id,
      "Semantic evidence must belong to its canonical test",
    );
    ok(
      !info.annotations.some(({ type }) => type === "specification"),
      "Duplicate semantic receipt",
    );
    info.annotations.push({
      type: "specification",
      description: JSON.stringify(this.#receipt()),
    });
  }
}

let inventory: ReturnType<typeof readSpecifications> | undefined;

export async function semanticContract(
  id: string,
  kind?: string,
): Promise<SemanticContract> {
  inventory ??= readSpecifications();
  const requirements = (await inventory).flatMap(({ data }) =>
    collectRequirements(data),
  );
  const matches = requirements.filter((requirement) => requirement.id === id);
  deepStrictEqual(
    matches.length,
    1,
    `Expected one canonical requirement: ${id}`,
  );
  const contract = new SemanticContract(matches[0]);
  if (kind) contract.equal("/kind", kind);
  return contract;
}
