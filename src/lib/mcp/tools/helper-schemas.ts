import * as z from "zod";
import { sectionCodeSchema } from "@/features/catalog/lib/section-code-schema";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
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

export { sectionCodeSchema, todoPrioritySchema };

export const mcpModeSchema = z.enum(["summary", "default", "full"]);
export type McpModeInput = z.infer<typeof mcpModeSchema>;
export const mcpModeInputSchema = mcpModeSchema
  .default("default")
  .describe(
    "Output verbosity. default=compact structured data with stable field names (recommended). " +
      "summary is a deprecated alias for default. full adds complete raw record fields without changing the top-level shape.",
  );

export const mcpLocaleInputSchema = localeSchema
  .default(DEFAULT_LOCALE)
  .describe(
    "Language for localized names: zh-cn (Chinese, default) or en-us (English).",
  );

export function resolveMcpMode(
  mode: McpModeInput | undefined,
): "default" | "full" {
  return mode === "full" ? "full" : "default";
}
