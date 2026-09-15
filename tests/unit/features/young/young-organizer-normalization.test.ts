import { describe, expect, it } from "vitest";
import {
  displayYoungOrganizerName,
  normalizeYoungOrganizerName,
} from "@/features/young/server/young-organizer-normalization";

describe("Young organizer normalization", () => {
  it("uses NFKC, collapses whitespace, trims, and lowercases for identity", () => {
    expect(normalizeYoungOrganizerName("  ＵＳＴＣ　学生会\n ")).toBe(
      "ustc 学生会",
    );
  });

  it("preserves readable case while applying the same Unicode and whitespace cleanup", () => {
    expect(displayYoungOrganizerName("  ＵＳＴＣ　学生会\n ")).toBe(
      "USTC 学生会",
    );
  });

  it("does not create an entity for blank or missing names", () => {
    expect(normalizeYoungOrganizerName(null)).toBeNull();
    expect(normalizeYoungOrganizerName(" \t\n ")).toBeNull();
  });
});
