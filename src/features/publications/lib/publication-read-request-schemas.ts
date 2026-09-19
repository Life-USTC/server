import * as z from "zod";

const publicationTypeSchema = z.enum(["news", "notice"]);
const sourceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);

export const publicationReadTypeSchema = publicationTypeSchema;

/**
 * Anonymous public publication filters. `other` is intentionally not valid.
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
  source: sourceIdSchema.optional(),
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
