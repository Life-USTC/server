import { getDemoRoomMapRoute } from "@/lib/api/routes/demo-room-map-route";
import { getRoomMapRoute } from "@/lib/api/routes/room-map-route";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";
/**
 * Look up a room's highlighted map or an available building overview.
 * @pathParams roomMapCodePathParamsSchema
 * @response roomMapResponseSchema
 * @response 400:openApiErrorSchema
 */
export const GET: RequestHandler = ({ request, params, locals }) =>
  locals.demo
    ? getDemoRoomMapRoute(params.code, locals.locale)
    : observedApiRoute(() => getRoomMapRoute(request, { code: params.code }))(
        request,
      );
