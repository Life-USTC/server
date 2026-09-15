import { describe, expect, it } from "vitest";
import { optionalId, requiredId } from "@/static-loader/required-id";

describe("static loader required upstream identity", () => {
  it("returns the database id mapped from an upstream jwId", () => {
    expect(requiredId(new Map([[41, 7]]), 41, "Semester jwId 41")).toBe(7);
  });

  it("fails instead of silently dropping unresolved data", () => {
    expect(() =>
      requiredId(new Map<number, number>(), 41, "Semester jwId 41"),
    ).toThrow("Semester jwId 41 did not resolve from its upstream jwId");
  });

  it("allows an absent optional upstream relation", () => {
    expect(optionalId(new Map(), undefined, "optional relation")).toBeNull();
  });
});
