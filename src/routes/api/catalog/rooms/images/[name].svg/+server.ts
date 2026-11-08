import { errorResponse } from "@/lib/api/responses";
import { getDemoRoomMapAssetRoute } from "@/lib/api/routes/demo-room-map-route";
import type { RequestHandler } from "./$types";

/**
 * Read a fixed local .svg schematic by basename within a trusted Demo session.
 * @pathParams roomMapImageNamePathParamsSchema
 * @response binary
 * @response 304
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 */
export const GET: RequestHandler = ({ locals, request, params }) =>
  locals.demo
    ? getDemoRoomMapAssetRoute(request, params.name)
    : errorResponse("Not found", 404);
