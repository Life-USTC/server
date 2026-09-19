import * as z from "zod";

/**
 * Ordered vocabulary for `PublicationSource.organizationLevel` (issue #1069).
 *
 * The order is the display order of the source directory — from the
 * university body outwards — and it matches the declaration order of the
 * Postgres enum, so an `ORDER BY "organizationLevel"` sorts groups without a
 * CASE expression. `tests/unit/features/publications/publication-source-levels.test.ts`
 * asserts this list stays exactly the Prisma enum's members.
 *
 * `unknown` is the fallback for a level the crawler introduces before this
 * list learns about it: `config/sources.yaml` lives in the crawler repo and
 * can gain a level at any time, and losing one source's grouping is a much
 * better failure than rejecting the ingestion batch that carried it.
 */
export const PUBLICATION_SOURCE_ORGANIZATION_LEVELS = [
  "university",
  "office",
  "department",
  "college",
  "center",
  "research",
  "service",
  "program",
  "society",
  "journal",
  "student",
  "unknown",
] as const;

export type PublicationSourceOrganizationLevel =
  (typeof PUBLICATION_SOURCE_ORGANIZATION_LEVELS)[number];

/** The level whose copy of a reprint the fold query prefers (issue #1068). */
export const PUBLICATION_SOURCE_UNIVERSITY_LEVEL =
  "university" satisfies PublicationSourceOrganizationLevel;

export const PUBLICATION_SOURCE_UNKNOWN_LEVEL =
  "unknown" satisfies PublicationSourceOrganizationLevel;

export function isPublicationSourceOrganizationLevel(
  value: string,
): value is PublicationSourceOrganizationLevel {
  return (PUBLICATION_SOURCE_ORGANIZATION_LEVELS as readonly string[]).includes(
    value,
  );
}

/**
 * Normalize a crawler-supplied `organizationLevel` to the stored enum.
 * Trims and lowercases, then falls back to `unknown` for an absent or
 * unrecognized level so ingestion stays total (see the note above).
 */
export function parsePublicationSourceOrganizationLevel(
  value: string | null | undefined,
): PublicationSourceOrganizationLevel {
  if (typeof value !== "string") return PUBLICATION_SOURCE_UNKNOWN_LEVEL;
  const normalized = value.trim().toLowerCase();
  return isPublicationSourceOrganizationLevel(normalized)
    ? normalized
    : PUBLICATION_SOURCE_UNKNOWN_LEVEL;
}

export const publicationSourceOrganizationLevelSchema = z.enum(
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
);
