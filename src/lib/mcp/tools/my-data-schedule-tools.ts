import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  listSubscribedExams,
  listSubscribedSchedules,
} from "@/features/subscriptions/server/subscription-read-model";
import {
  flexDateInputSchema,
  getUserId,
  jsonToolResult,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
  parseMcpDateRange,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import { serializeScheduleTimeFields } from "@/shared/lib/schedule-serialization";

export function registerMyScheduleTools(server: McpServer) {
  server.registerTool(
    "workspace_schedule_list",
    {
      description:
        "List schedules across your subscribed sections in all semesters. Use catalog_schedule_list for public schedules of any section without personal context. " +
        "Pass semesterId to limit results to a specific semester.",
      inputSchema: {
        dateFrom: flexDateInputSchema.optional(),
        dateTo: flexDateInputSchema.optional(),
        weekday: z.number().int().min(1).max(7).optional(),
        limit: z.number().int().min(1).max(300).default(150),
        semesterId: z.number().int().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async (
      { dateFrom, dateTo, weekday, limit, semesterId, locale, mode },
      extra,
    ) => {
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
        semesterId,
      });

      return jsonToolResult(
        { schedules: schedules.map(serializeScheduleTimeFields) },
        { mode: resolvedMode },
      );
    },
  );

  server.registerTool(
    "workspace_exam_list",
    {
      description:
        "List exams across your subscribed sections in all semesters. Includes unknown-date exams by default (set includeDateUnknown: false to exclude). " +
        "Pass semesterId to limit results to a specific semester.",
      inputSchema: {
        dateFrom: flexDateInputSchema.optional(),
        dateTo: flexDateInputSchema.optional(),
        includeDateUnknown: z.boolean().default(true),
        limit: z.number().int().min(1).max(300).default(150),
        semesterId: z.number().int().min(1).optional(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    async (
      { dateFrom, dateTo, includeDateUnknown, limit, semesterId, locale, mode },
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
        semesterId,
      });

      return jsonToolResult({ exams }, { mode: resolvedMode });
    },
  );
}
