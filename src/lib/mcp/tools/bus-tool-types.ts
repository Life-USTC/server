import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type * as z from "zod";
import type {
  getNextBusDepartures,
  listBusRoutes,
} from "@/features/bus/lib/bus-service";
import type {
  flexDateInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

export type ToolExtra = { authInfo?: AuthInfo };
export type BusLocale = Parameters<typeof listBusRoutes>[0];
export type McpModeInput = Parameters<typeof resolveMcpMode>[0];
export type BusDayType = Parameters<typeof getNextBusDepartures>[0]["dayType"];
export type AtTimeInput = z.infer<typeof flexDateInputSchema>;
