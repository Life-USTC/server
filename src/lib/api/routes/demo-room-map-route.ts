import {
  getDemoRoomMap,
  getDemoRoomMapAsset,
} from "@/features/demo/server/demo-rooms";
import type { AppLocale } from "@/i18n/config";
import { parseRouteParams } from "@/lib/api/helpers";
import { errorResponse, schemaJsonResponse } from "@/lib/api/responses";
import {
  roomMapCodePathParamsSchema,
  roomMapImageNamePathParamsSchema,
  roomMapResponseSchema,
} from "@/lib/api/schemas/room-map-schemas";

export async function getDemoRoomMapRoute(code: string, locale: AppLocale) {
  const parsed = await parseRouteParams(
    Promise.resolve({ code }),
    roomMapCodePathParamsSchema,
    "Invalid room code",
  );
  if (parsed instanceof Response) return parsed;
  const map = getDemoRoomMap(code, locale);
  return map
    ? schemaJsonResponse(roomMapResponseSchema, map)
    : errorResponse("Demo room map not found", 404);
}

export async function getDemoRoomMapAssetRoute(request: Request, name: string) {
  if (new URL(request.url).search)
    return errorResponse("Invalid demo room map image query", 400);
  const parsed = await parseRouteParams(
    Promise.resolve({ name }),
    roomMapImageNamePathParamsSchema,
    "Invalid room map image name",
  );
  if (parsed instanceof Response) return parsed;
  const asset = getDemoRoomMapAsset(parsed.name);
  if (!asset) return errorResponse("Demo room map image not found", 404);
  const headers = new Headers({
    "Content-Type": asset.contentType,
    "Content-Length": String(asset.bytes.byteLength),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ETag: `"${asset.sha256}"`,
  });
  if (
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .some((value) =>
        ["*", `"${asset.sha256}"`].includes(value.trim().replace(/^W\//, "")),
      )
  )
    return new Response(null, { status: 304, headers });
  return new Response(
    request.method === "HEAD" ? null : asset.bytes.slice().buffer,
    { headers },
  );
}
