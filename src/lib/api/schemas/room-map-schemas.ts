import * as z from "zod";
import {
  roomCodeSchema,
  roomMapSchema,
} from "@/features/rooms/server/room-map-schema";
export const roomMapCodePathParamsSchema = z.object({ code: roomCodeSchema });
export const roomMapResponseSchema = roomMapSchema;
