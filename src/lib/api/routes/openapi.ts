import { getCloudflareAssetsBinding } from "@/lib/adapters/cloudflare-runtime";
import { OPENAPI_SPEC_PUBLIC_PATH } from "@/lib/openapi/spec";

export async function getOpenApiRoute(request: Request) {
  const assetRequest = new Request(
    new URL(OPENAPI_SPEC_PUBLIC_PATH, request.url),
    request,
  );
  const assets = getCloudflareAssetsBinding();
  const assetResponse = assets
    ? await assets.fetch(assetRequest)
    : await fetch(assetRequest);
  const headers = new Headers(assetResponse.headers);
  headers.set("cache-control", "public, max-age=300");
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    headers,
    status: assetResponse.status,
    statusText: assetResponse.statusText,
  });
}
