import * as z from "zod";
import { DEFAULT_LOCALE, localeSchema } from "@/i18n/config";

export type Locale = z.infer<typeof localeSchema>;
export const dateTimeSchema = z.string().datetime({ offset: true });

/**
 * Flexible date input schema for MCP tool parameters.
 * Accepts ISO 8601 with timezone offset, date-only strings, or datetime without timezone.
 */
export const flexDateInputSchema = z
  .string()
  .trim()
  .min(1)
  .describe(
    "Accepts ISO 8601 with offset (2026-05-01T08:00:00+08:00), date-only (2026-05-01), or datetime without timezone (2026-05-01T08:00:00, interpreted as Asia/Shanghai).",
  );

export const sectionCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/);
export const todoPrioritySchema = z.enum(["low", "medium", "high"]);

export const mcpModeSchema = z.enum(["summary", "default", "full"]);
export const mcpModeInputSchema = mcpModeSchema
  .default("default")
  .describe(
    "Output verbosity. summary=counts+top samples (smallest, good for quick checks). " +
      "default=compact structured data with low-value fields stripped (recommended for most calls). " +
      "full=complete raw records (use only when exact nested values are explicitly required).",
  );

export const mcpLocaleInputSchema = localeSchema
  .default(DEFAULT_LOCALE)
  .describe(
    "Language for localized names: zh-cn (Chinese, default) or en-us (English).",
  );

export function resolveMcpMode(
  mode: z.infer<typeof mcpModeSchema> | undefined,
) {
  return mode ?? "default";
}
