import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { roomCodeSchema } from "@/features/rooms/server/room-map-schema";
import { getRoomMap } from "@/features/rooms/server/room-map-service";
import {
  jsonToolResult,
  mcpModeInputSchema,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";
export function registerRoomMapTools(server: McpServer) {
  server.registerTool(
    "catalog_rooms_map",
    {
      description:
        "Find the floor map for an exact USTC room code (for example 3A204). Returns a highlighted image URL when annotated. Overview status does not confirm the room exists. Show the returned image when the user asks where a room is; resolve ambiguous class references first.",
      inputSchema: { code: roomCodeSchema, mode: mcpModeInputSchema },
    },
    async ({ code, mode }) =>
      jsonToolResult(await getRoomMap(code), { mode: resolveMcpMode(mode) }),
  );
}
