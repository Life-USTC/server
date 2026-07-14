import * as z from "zod";

export const dateTimeSchema = z.string().datetime({ offset: true });

export const paginationSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const createListSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
  });

export const createPaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  createListSchema(itemSchema).extend({
    pagination: paginationSchema,
  });

export const createPaginatedMetaSchema = <
  TItem extends z.ZodTypeAny,
  TMeta extends z.ZodTypeAny,
>(
  itemSchema: TItem,
  metaSchema: TMeta,
) =>
  createPaginatedSchema(itemSchema).extend({
    meta: metaSchema,
  });
