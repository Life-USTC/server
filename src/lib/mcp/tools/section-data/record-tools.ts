import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  flexDateInputSchema,
  mcpLocaleInputSchema,
  mcpModeInputSchema,
} from "@/lib/mcp/tools/_helpers";
import { listExamsBySectionAction } from "./exam-record-actions";
import { querySchedulesAction } from "./schedule-query-action";
import { listSchedulesBySectionAction } from "./schedule-section-list-action";

export function registerSectionRecordTools(server: McpServer) {
  server.registerTool(
    "catalog_schedule_list",
    {
      description:
        "Query public schedules across sections by section, teacher, room, weekday, and date range. " +
        "Use workspace_schedule_list for only subscribed sections.",
      inputSchema: {
        sectionId: z.number().int().positive().optional(),
        sectionJwId: z.number().int().positive().optional(),
        sectionCode: z.string().trim().min(1).optional(),
        teacherId: z.number().int().positive().optional(),
        teacherCode: z.string().trim().min(1).optional(),
        roomId: z.number().int().positive().optional(),
        roomJwId: z.number().int().positive().optional(),
        weekday: z.number().int().min(1).max(7).optional(),
        dateFrom: flexDateInputSchema
          .optional()
          .describe("Earliest schedule date/time (inclusive)."),
        dateTo: flexDateInputSchema
          .optional()
          .describe("Latest schedule date/time (inclusive)."),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    querySchedulesAction,
  );

  server.registerTool(
    "catalog_section_schedule_list",
    {
      description:
        "Schedules for one section by JW ID, ordered by date/start time. Use dateFrom/dateTo for a week or date window.",
      inputSchema: {
        sectionJwId: z.number().int().positive(),
        dateFrom: flexDateInputSchema
          .optional()
          .describe(
            "Earliest schedule date (inclusive). Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        dateTo: flexDateInputSchema
          .optional()
          .describe(
            "Latest schedule date (inclusive). Accepts YYYY-MM-DD or ISO 8601 with offset.",
          ),
        limit: z.number().int().min(1).max(200).default(100),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    listSchedulesBySectionAction,
  );

  server.registerTool(
    "catalog_section_exam_list",
    {
      description: "Exams for one section by JW ID, including batch and rooms.",
      inputSchema: {
        sectionJwId: z.number().int().positive(),
        locale: mcpLocaleInputSchema,
        mode: mcpModeInputSchema,
      },
    },
    listExamsBySectionAction,
  );
}
