import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  listSubscribedExams,
  listSubscribedSchedules,
} from "@/features/home/server/subscription-read-model";
import {
  flexDateInputSchema,
  getUserId,
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export function registerMyScheduleTools(server: McpServer) {
  server.registerTool(
    "list_my_schedules",
    {
      description:
        "List schedules across your subscribed sections. Use query_schedules for public schedules of any section without personal context.",
      inputSchema: {
        dateFrom: flexDateInputSchema.optional(),
        dateTo: flexDateInputSchema.optional(),
        weekday: z.number().int().min(1).max(7).optional(),
        limit: z.number().int().min(1).max(300).default(150),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async ({ dateFrom, dateTo, weekday, limit, locale, mode }, extra) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const dateRange = parseMcpDateRange({ dateFrom, dateTo });
      if (!dateRange.ok) {
        return dateRange.result;
      }
      const schedules = await listSubscribedSchedules(userId, {
        locale,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        weekday,
        limit,
      });

      return jsonToolResult({ schedules }, { mode: resolvedMode });
    },
  );

  server.registerTool(
    "list_my_exams",
    {
      description:
        "List exams across your subscribed sections. Includes unknown-date exams by default (set includeDateUnknown: false to exclude).",
      inputSchema: {
        dateFrom: flexDateInputSchema.optional(),
        dateTo: flexDateInputSchema.optional(),
        includeDateUnknown: z.boolean().default(true),
        limit: z.number().int().min(1).max(300).default(150),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async (
      { dateFrom, dateTo, includeDateUnknown, limit, locale, mode },
      extra,
    ) => {
      const resolvedMode = resolveMcpMode(mode);
      const userId = getUserId(extra.authInfo);
      const dateRange = parseMcpDateRange({ dateFrom, dateTo });
      if (!dateRange.ok) {
        return dateRange.result;
      }
      const exams = await listSubscribedExams(userId, {
        locale,
        dateFrom: dateRange.dateFrom,
        dateTo: dateRange.dateTo,
        includeDateUnknown,
        limit,
      });

      return jsonToolResult({ exams }, { mode: resolvedMode });
    },
  );
}
