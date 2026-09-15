import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listYoungNotifications,
  readYoungNotification,
} from "@/features/young/server/young-notification-service";
import {
  getYoungEventSubscription,
  getYoungOrganizerSubscription,
  listYoungEventSubscriptions,
  listYoungOrganizerSubscriptions,
  setYoungEventSubscription,
  setYoungOrganizerSubscription,
} from "@/features/young/server/young-subscription-service";
import {
  getUserId,
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "../_shared/helpers";

const id = z.string().trim().min(1).max(200);
const page = {
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  mode: mcpModeInputSchema,
};

export function registerYoungWorkspaceTools(server: McpServer) {
  server.registerTool(
    "workspace_young_organizer_subscription_get",
    {
      description: "Get personal organizer follow state.",
      inputSchema: { organizerId: id, mode: mcpModeInputSchema },
    },
    async (args, extra) =>
      jsonToolResult(
        await getYoungOrganizerSubscription(
          getUserId(extra.authInfo),
          args.organizerId,
        ),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_event_subscription_list",
    {
      description:
        "List the current user's subscribed Young activities (not official registrations).",
      inputSchema: page,
    },
    async (args, extra) =>
      jsonToolResult(
        await listYoungEventSubscriptions(getUserId(extra.authInfo), args),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_event_subscription_get",
    {
      description: "Get personal activity subscription and reminder settings.",
      inputSchema: { youngId: id, mode: mcpModeInputSchema },
    },
    async (args, extra) =>
      jsonToolResult(
        await getYoungEventSubscription(
          getUserId(extra.authInfo),
          args.youngId,
        ),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_event_subscription_set",
    {
      description:
        "Subscribe/unsubscribe a Young activity and set signup, deadline (24h) and start (1h) reminders. Adds subscribed activities to the personal calendar; does not register attendance.",
      inputSchema: {
        youngId: id,
        subscribed: z.boolean(),
        remindSignup: z.boolean().optional(),
        remindDeadline: z.boolean().optional(),
        remindStart: z.boolean().optional(),
        mode: mcpModeInputSchema,
      },
    },
    async ({ youngId, subscribed, mode, ...settings }, extra) =>
      jsonToolResult(
        await setYoungEventSubscription(
          getUserId(extra.authInfo),
          youngId,
          subscribed,
          settings,
        ),
        { mode: resolveMcpMode(mode) },
      ),
  );
  server.registerTool(
    "workspace_young_organizer_subscription_list",
    { description: "List followed Young organizers.", inputSchema: page },
    async (args, extra) =>
      jsonToolResult(
        await listYoungOrganizerSubscriptions(getUserId(extra.authInfo), args),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_organizer_subscription_set",
    {
      description:
        "Follow/unfollow an organizer for daily new-activity digests. Does not subscribe individual activities or add them to the calendar.",
      inputSchema: {
        organizerId: id,
        subscribed: z.boolean(),
        mode: mcpModeInputSchema,
      },
    },
    async (args, extra) =>
      jsonToolResult(
        await setYoungOrganizerSubscription(
          getUserId(extra.authInfo),
          args.organizerId,
          args.subscribed,
        ),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_notification_list",
    {
      description:
        "List current activity reminders, changes and organizer digests; expired reminders are excluded.",
      inputSchema: { ...page, unread: z.boolean().optional() },
    },
    async (args, extra) =>
      jsonToolResult(
        await listYoungNotifications(getUserId(extra.authInfo), args),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
  server.registerTool(
    "workspace_young_notification_read",
    {
      description: "Mark one own activity notification read, idempotently.",
      inputSchema: { id, mode: mcpModeInputSchema },
    },
    async (args, extra) =>
      jsonToolResult(
        await readYoungNotification(getUserId(extra.authInfo), args.id),
        { mode: resolveMcpMode(args.mode) },
      ),
  );
}
