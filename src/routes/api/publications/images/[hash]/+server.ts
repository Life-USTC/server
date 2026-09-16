import type { RequestHandler } from "@sveltejs/kit";
import { getCloudflareTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { getPublicPublicationImageRoute } from "@/lib/api/routes/publication-public-routes";
import { observedApiRoute } from "@/lib/log/api-observability";

/**
 * Lazily fetch and cache an image referenced by a public publication's
 * Markdown body.
 * @pathParams publicationImagePathParamsSchema
 * @response binary
 * @response 304
 * @response 400:openApiErrorSchema
 * @response 404:openApiErrorSchema
 * @response 502:openApiErrorSchema
 * @response 503:openApiErrorSchema
 */
export const GET: RequestHandler = async ({ request, params, platform }) => {
  const response = await observedApiRoute(() =>
    getPublicPublicationImageRoute(
      request,
      { hash: params.hash },
      { defer: getCloudflareTaskScheduler(platform) },
    ),
  )(request);
  if (response.status >= 400) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
};
