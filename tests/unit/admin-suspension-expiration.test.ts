import { describe, expect, it } from "vitest";
import { adminUserSuspensionExpiresAt } from "@/features/admin/lib/admin-users-display";
import { expiresAtFromModerationDuration } from "@/features/admin/lib/moderation-action-display";
import { adminCreateSuspensionRequestSchema } from "@/lib/api/schemas/request-schemas";

describe("admin suspension expiration input", () => {
  it("accepts omitted, null, and empty expiration values as permanent", () => {
    const base = { userId: "user-1" };

    expect(adminCreateSuspensionRequestSchema.safeParse(base).success).toBe(
      true,
    );
    expect(
      adminCreateSuspensionRequestSchema.safeParse({
        ...base,
        expiresAt: null,
      }).success,
    ).toBe(true);
    expect(
      adminCreateSuspensionRequestSchema.safeParse({
        ...base,
        expiresAt: "   ",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid non-empty expiration values", () => {
    const result = adminCreateSuspensionRequestSchema.safeParse({
      userId: "user-1",
      expiresAt: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("preserves invalid custom UI expiration values for API rejection", () => {
    expect(adminUserSuspensionExpiresAt("custom", "not-a-date")).toBe(
      "not-a-date",
    );
    expect(expiresAtFromModerationDuration("custom", "not-a-date")).toBe(
      "not-a-date",
    );
    expect(adminUserSuspensionExpiresAt("custom", "   ")).toBeUndefined();
    expect(expiresAtFromModerationDuration("custom", "   ")).toBeUndefined();
  });
});
