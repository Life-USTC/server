import { getRoomMap } from "@/features/rooms/server/room-map-service";
import {
  handleRouteError,
  parseRouteParams,
  schemaJsonResponse,
} from "@/lib/api/helpers";
import {
  roomMapCodePathParamsSchema,
  roomMapResponseSchema,
} from "@/lib/api/schemas/room-map-schemas";
import { PUBLIC_CATALOG_HEADERS } from "@/lib/public-cache-control";
export async function getRoomMapRoute(
  _request: Request,
  params: { code: string },
) {
  const parsed = await parseRouteParams(
    Promise.resolve(params),
    roomMapCodePathParamsSchema,
    "Invalid room code",
  );
  if (parsed instanceof Response) return parsed;
  try {
    return schemaJsonResponse(
      roomMapResponseSchema,
      await getRoomMap(parsed.code),
      { headers: PUBLIC_CATALOG_HEADERS },
    );
  } catch (error) {
    return handleRouteError("Failed to fetch room map", error);
  }
}
