import * as z from "zod";
import {
  roomCodeSchema,
  roomMapSchema,
} from "@/features/rooms/server/room-map-schema";
export const roomMapCodePathParamsSchema = z.object({ code: roomCodeSchema });
export const roomMapResponseSchema = roomMapSchema;

export const roomMapImageNamePathParamsSchema = z.object({
  // The route supplies the basename; the fixed .svg suffix completes max 64.
  name: z.string().min(1).max(60),
});
