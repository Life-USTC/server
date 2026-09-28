import type { ExecutionContext, R2Bucket } from "@cloudflare/workers-types";
import productionWorker from "../../../src/worker.js";

export { PublicSsr } from "../../../src/worker.js";

const storagePath = "/__test/storage/uploads";
const ownedPrefix = /^uploads\/[0-9a-f-]{36}\/$/;
const ownedKey = /^uploads\/[0-9a-f-]{36}\/(?:\d+-)?[0-9a-f-]{36}$/;

// Only wrangler.e2e.jsonc loads this entrypoint. Fixture writes and independent
// observations use the same R2 binding/runtime as the production request.
export default {
  ...productionWorker,
  async fetch(
    request: Request,
    env: {
      NODE_ENV: string;
      E2E_STORAGE_SECRET: string;
      R2_UPLOADS: R2Bucket;
    },
    context: ExecutionContext,
  ) {
    const url = new URL(request.url);
    if (url.pathname !== storagePath)
      return productionWorker.fetch(request, env, context);
    if (
      env.NODE_ENV !== "test" ||
      !env.E2E_STORAGE_SECRET ||
      request.headers.get("x-test-storage-secret") !== env.E2E_STORAGE_SECRET
    )
      return new Response(null, { status: 404 });

    const prefix = url.searchParams.get("prefix");
    if (request.method === "GET" && prefix && ownedPrefix.test(prefix)) {
      const result = await env.R2_UPLOADS.list({
        prefix,
        cursor: url.searchParams.get("cursor") ?? undefined,
      });
      return Response.json({
        objects: result.objects.map(({ key }) => ({ key })),
        truncated: result.truncated,
        ...(result.truncated ? { cursor: result.cursor } : {}),
      });
    }
    const key = url.searchParams.get("key");
    if (!key || !ownedKey.test(key))
      return new Response("Expected a fixture-owned upload key", {
        status: 400,
      });

    switch (request.method) {
      case "GET": {
        if (url.searchParams.has("metadata")) {
          const object = await env.R2_UPLOADS.head(key);
          return Response.json(
            object
              ? { size: object.size, httpMetadata: object.httpMetadata }
              : null,
          );
        }
        const object = await env.R2_UPLOADS.get(key);
        return object
          ? new Response(await object.arrayBuffer())
          : new Response(null, { status: 404 });
      }
      case "PUT":
        await env.R2_UPLOADS.put(key, await request.arrayBuffer(), {
          httpMetadata: {
            contentType:
              request.headers.get("content-type") ?? "application/octet-stream",
          },
        });
        return new Response(null, { status: 204 });
      case "DELETE":
        await env.R2_UPLOADS.delete(key);
        return new Response(null, { status: 204 });
      default:
        return new Response(null, { status: 405 });
    }
  },
};
