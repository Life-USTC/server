import { describe, expect, it } from "vitest";
import {
  isPublicationSourceOrganizationLevel,
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  parsePublicationSourceOrganizationLevel,
  publicationSourceOrganizationLevelSchema,
} from "@/features/publications/lib/publication-source-levels";
import { PublicationSourceOrganizationLevel } from "@/generated/prisma/enums";

describe("publication source organization levels", () => {
  it("covers exactly the persisted enum, so no stored level is unlabelled", () => {
    expect([...PUBLICATION_SOURCE_ORGANIZATION_LEVELS].sort()).toEqual(
      Object.values(PublicationSourceOrganizationLevel).sort(),
    );
  });

  it("orders the university body first so directory groups are hierarchical", () => {
    expect(PUBLICATION_SOURCE_ORGANIZATION_LEVELS[0]).toBe("university");
    expect(PUBLICATION_SOURCE_ORGANIZATION_LEVELS.at(-1)).toBe("unknown");
  });

  it("normalizes crawler-supplied levels and never rejects one", () => {
    expect(parsePublicationSourceOrganizationLevel("office")).toBe("office");
    expect(parsePublicationSourceOrganizationLevel("  College ")).toBe(
      "college",
    );
    // A level the crawler adds before this enum learns about it degrades to
    // `unknown` rather than failing the batch that carried it.
    expect(parsePublicationSourceOrganizationLevel("institute")).toBe(
      "unknown",
    );
    expect(parsePublicationSourceOrganizationLevel(undefined)).toBe("unknown");
    expect(parsePublicationSourceOrganizationLevel(null)).toBe("unknown");
    expect(parsePublicationSourceOrganizationLevel("")).toBe("unknown");
  });

  it("guards and validates level values", () => {
    expect(isPublicationSourceOrganizationLevel("journal")).toBe(true);
    expect(isPublicationSourceOrganizationLevel("Journal")).toBe(false);
    expect(
      publicationSourceOrganizationLevelSchema.safeParse("student").success,
    ).toBe(true);
    expect(
      publicationSourceOrganizationLevelSchema.safeParse("e2e").success,
    ).toBe(false);
  });
});
