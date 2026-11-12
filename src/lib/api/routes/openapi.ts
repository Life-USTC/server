import { getCloudflareAssetsBinding } from "@/lib/adapters/cloudflare-runtime";
import { OPENAPI_SPEC_PUBLIC_PATH } from "@/lib/openapi/spec";

export async function getOpenApiRoute(request: Request, demo = false) {
  const assetRequest = new Request(
    new URL(OPENAPI_SPEC_PUBLIC_PATH, request.url),
    request,
  );
  const assets = getCloudflareAssetsBinding();
  if (demo && !assets)
    return new Response("Local API specification unavailable", { status: 503 });
  const assetResponse = assets
    ? await assets.fetch(assetRequest)
    : await fetch(assetRequest);
  const headers = new Headers(assetResponse.headers);
  headers.set(
    "cache-control",
    demo ? "private, no-store" : "public, max-age=300",
  );
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : assetResponse.body, {
    headers,
    status: assetResponse.status,
    statusText: assetResponse.statusText,
  });
}
