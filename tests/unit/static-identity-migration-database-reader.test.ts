import { describe, expect, it } from "vitest";
import { descriptionContentFingerprint } from "@/static-loader/identity-migration/database-reader";

describe("identity migration database reader", () => {
  it("only classifies an empty description as empty when it has no edit history", () => {
    expect(descriptionContentFingerprint("", false)).toBe("");
    expect(descriptionContentFingerprint("", true)).toMatch(/^[a-f0-9]{64}$/);
    expect(descriptionContentFingerprint("", true)).not.toBe("");
  });
});
