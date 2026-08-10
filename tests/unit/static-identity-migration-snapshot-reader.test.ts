/// <reference path="../../src/static-loader/bun-sqlite.d.ts" />

import { describe, expect, it, vi } from "vitest";
import { legacyCodeCourseJwId } from "@/static-loader/identity-migration/snapshot-reader";

vi.mock("bun:sqlite", () => ({ Database: class {} }));

describe("identity migration snapshot reader", () => {
  it("reproduces the original code-based Course synthetic ID", () => {
    expect(legacyCodeCourseJwId("001046")).toBe(1_637_214_764);
  });
});
