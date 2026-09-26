import { describe, expect, it } from "vitest";
import { canManageSectionHomework } from "@/features/section-detail/lib/section-detail-derived-state";

describe("ordinary section homework deletion controls", () => {
  const viewer: Parameters<typeof canManageSectionHomework>[0] = {
    userId: "admin-1",
    isAdmin: true,
    isAuthenticated: true,
    isSuspended: false,
  };
  const homework = {
    id: "homework-1",
    createdById: "creator-1",
  } as NonNullable<Parameters<typeof canManageSectionHomework>[1]>;

  it("does not offer deletion of another creator's homework to an admin", () => {
    expect(canManageSectionHomework(viewer, homework)).toBe(false);
  });

  it("offers deletion to the active creator and hides it during suspension", () => {
    const creator = { ...viewer, userId: "creator-1" };
    expect(canManageSectionHomework(creator, homework)).toBe(true);
    expect(
      canManageSectionHomework({ ...creator, isSuspended: true }, homework),
    ).toBe(false);
    expect(
      canManageSectionHomework(
        { ...creator, isAuthenticated: false },
        homework,
      ),
    ).toBe(false);
  });
});
