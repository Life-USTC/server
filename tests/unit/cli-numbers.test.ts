import {
  parseCliInteger,
  parseCliIntegerList,
  parseOptionalCliInteger,
} from "@tools/dev/util/cli-numbers";
import { describe, expect, it } from "vitest";

describe("CLI number parsing", () => {
  it("parses exact safe integers", () => {
    expect(parseOptionalCliInteger(" 42 ")).toBe(42);
    expect(parseOptionalCliInteger("-1")).toBe(-1);
  });

  it("rejects partial, decimal, unsafe, and bounded values", () => {
    expect(parseOptionalCliInteger("42x")).toBeNull();
    expect(parseOptionalCliInteger("4.2")).toBeNull();
    expect(parseOptionalCliInteger("9007199254740992")).toBeNull();
    expect(parseOptionalCliInteger("0", { min: 1 })).toBeNull();
    expect(parseOptionalCliInteger("11", { max: 10 })).toBeNull();
  });

  it("returns fallback for invalid integer values", () => {
    expect(parseCliInteger("2x", 8, { min: 1 })).toBe(8);
    expect(parseCliInteger("2", 8, { min: 1 })).toBe(2);
  });

  it("parses comma-separated integer lists and drops invalid entries", () => {
    expect(parseCliIntegerList("1, 2x, 3, 0", { min: 1 })).toEqual([1, 3]);
  });
});
