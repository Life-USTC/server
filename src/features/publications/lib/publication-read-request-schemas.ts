import * as z from "zod";
import {
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  publicationSourceOrganizationLevelSchema,
} from "./publication-source-levels";

const publicationTypeSchema = z.enum(["news", "notice"]);
const sourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

export const publicationReadTypeSchema = publicationTypeSchema;

/** At most this many source ids may be combined in one list request. */
export const PUBLICATION_LIST_MAX_SOURCE_IDS = 20;

/**
 * Query params that accept a list (issue #1069). Both spellings are valid:
 * the repo's comma-separated idiom used by REST clients and the OpenAPI
 * document (`?source=a,b`), and the repeated form an HTML checkbox group
 * submits (`?source=a&source=b`), which the list page's no-JS GET form
 * produces. `collapsePublicationListSearchParams` folds the repeated form
 * into the comma form so a single schema validates both.
 */
export const PUBLICATION_LIST_MULTI_VALUE_PARAMS = [
  "source",
  "organizationLevel",
] as const;

function parameterList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Rewrite repeated list params into the single comma-separated param the
 * schemas below validate. Non-list params are copied through untouched, so
 * a duplicated `?type=` still resolves the way `URLSearchParams.get` would.
 */
export function collapsePublicationListSearchParams(
  searchParams: URLSearchParams,
) {
  const collapsed = new URLSearchParams();
  for (const key of new Set(searchParams.keys())) {
    if (
      (PUBLICATION_LIST_MULTI_VALUE_PARAMS as readonly string[]).includes(key)
    ) {
      const entries = searchParams.getAll(key).flatMap(parameterList);
      if (entries.length > 0) collapsed.set(key, entries.join(","));
      continue;
    }
    const value = searchParams.get(key);
    if (value !== null) collapsed.set(key, value);
  }
  return collapsed;
}

function commaSeparatedList<TValue>(
  entrySchema: z.ZodType<TValue, string>,
  options: { maxEntries: number; description: string },
) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((value, context) => {
      const entries = parameterList(value);
      if (entries.length === 0 || entries.length > options.maxEntries) {
        context.addIssue({
          code: "custom",
          message: `Expected 1 to ${options.maxEntries} comma-separated entries`,
        });
        return z.NEVER;
      }
      const parsed: TValue[] = [];
      for (const entry of entries) {
        const result = entrySchema.safeParse(entry);
        if (!result.success) {
          context.addIssue({
            code: "custom",
            message: `Invalid entry: ${entry}`,
          });
          return z.NEVER;
        }
        if (!parsed.includes(result.data)) parsed.push(result.data);
      }
      return parsed;
    })
    .meta({ override: { type: "string", description: options.description } });
}

/**
 * Anonymous public publication filters. `other` is intentionally not valid.
 *
 * `source` and `organizationLevel` accept a list (issue #1069) so the list
 * page can offer multi-select source filtering and "offices only"-style
 * aggregate filtering. A single value keeps working unchanged, so
 * `?source=ustc-news` is still a valid request; it simply parses to a
 * one-element list. The two facets combine with AND: sources within the
 * selected levels.
 *
 * `fold` is opt-in (issue #1068): when `fold=1`, the list groups reprints of
 * the same article across news.ustc.edu.cn sections/columns by
 * (normalized title, published date) and returns one representative row per
 * group. The unfolded default is unchanged — whether folding should become
 * the default is an open product question tracked in the issue, not decided
 * by this change.
 */
export const publicationsQuerySchema = z.strictObject({
  type: publicationTypeSchema.optional(),
  source: commaSeparatedList(sourceIdSchema, {
    maxEntries: PUBLICATION_LIST_MAX_SOURCE_IDS,
    description: `Comma-separated source ids, at most ${PUBLICATION_LIST_MAX_SOURCE_IDS} entries. A repeated source parameter is accepted as the same list.`,
  }).optional(),
  organizationLevel: commaSeparatedList(
    publicationSourceOrganizationLevelSchema,
    {
      maxEntries: PUBLICATION_SOURCE_ORGANIZATION_LEVELS.length,
      description: `Comma-separated source organization levels (${PUBLICATION_SOURCE_ORGANIZATION_LEVELS.join(", ")}). A repeated organizationLevel parameter is accepted as the same list.`,
    },
  ).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).max(100_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  fold: z
    .literal("1")
    .transform(() => true as const)
    .optional()
    .meta({ override: { type: "string", enum: ["1"] } }),
});

export const publicationIdPathParamsSchema = z.strictObject({
  id: z.string().trim().min(1).max(128),
});

export const publicationObjectPathParamsSchema = z.strictObject({
  kind: z.enum(["body_html", "body_markdown", "media", "asset", "raw_page"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const publicationImagePathParamsSchema = z.strictObject({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export type PublicationsQuery = z.output<typeof publicationsQuerySchema>;
export type PublicationIdPathParams = z.output<
  typeof publicationIdPathParamsSchema
>;
export type PublicationObjectPathParams = z.output<
  typeof publicationObjectPathParamsSchema
>;
export type PublicationImagePathParams = z.output<
  typeof publicationImagePathParamsSchema
>;
