import { describe, expect, it } from "vitest";
import {
  isValidProfileUsername,
  PROFILE_USERNAME_MAX_LENGTH,
  PROFILE_USERNAME_PATTERN,
} from "@/features/profile/lib/profile-username";

describe("profile username rules", () => {
  it("exposes the same pattern and limit used by form inputs", () => {
    expect(PROFILE_USERNAME_PATTERN).toBe("[a-z0-9-]+");
    expect(PROFILE_USERNAME_MAX_LENGTH).toBe(20);
  });

  it("allows lowercase letters, numbers, and hyphens", () => {
    expect(isValidProfileUsername("student-2026")).toBe(true);
  });

  it("rejects empty, overlong, uppercase, and reserved names", () => {
    expect(isValidProfileUsername("")).toBe(false);
    expect(isValidProfileUsername("a".repeat(21))).toBe(false);
    expect(isValidProfileUsername("Student")).toBe(false);
    expect(isValidProfileUsername("id")).toBe(false);
  });
});
