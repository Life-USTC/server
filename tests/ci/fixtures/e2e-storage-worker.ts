import type { ExecutionContext, R2Bucket } from "@cloudflare/workers-types";
import productionWorker from "../../../src/worker.js";
import {
  handleCommunityEffectProbe,
  observeCommunityEffects,
} from "./community-effect-probe";

export { PublicSsr } from "../../../src/worker.js";

const storagePath = "/__test/storage/uploads";
const publicationStoragePath = "/__test/storage/publications";
const ownedPrefix = /^uploads\/[0-9a-f-]{36}\/$/;
const ownedKey = /^uploads\/[0-9a-f-]{36}\/(?:\d+-)?[0-9a-f-]{36}$/;
type DeleteProbe = {
  attempts: number;
  pending: number;
  fail: boolean;
  hold: boolean;
};
const deleteProbes = new Map<string, DeleteProbe>();

function observeDeletes(bucket: R2Bucket): R2Bucket {
  return new Proxy(bucket, {
    get(target, property) {
      if (property !== "delete") {
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return async (keys: string | string[]) => {
        const probes = (typeof keys === "string" ? [keys] : keys).flatMap(
          (key) => {
            const probe = deleteProbes.get(key);
            return probe ? [probe] : [];
          },
        );
        for (const probe of probes) {
          probe.attempts++;
          probe.pending++;
        }
        try {
          const deadline = Date.now() + 15_000;
          for (const probe of probes) {
            while (probe.hold) {
              if (Date.now() >= deadline)
                throw new Error("Test storage deletion hold timed out");
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            if (probe.fail) throw new Error("private-storage-failure");
          }
          return await target.delete(keys);
        } finally {
          for (const probe of probes) probe.pending--;
        }
      };
    },
  });
}

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
      R2_PUBLICATIONS: R2Bucket;
    },
    context: ExecutionContext,
  ) {
    const effectResponse = await handleCommunityEffectProbe(request, env);
    if (effectResponse) return effectResponse;
    const observed = observeCommunityEffects(request, env, context);
    const url = new URL(request.url);
    if (url.pathname !== storagePath && url.pathname !== publicationStoragePath)
      return productionWorker.fetch(
        request,
        deleteProbes.size
          ? { ...observed.env, R2_UPLOADS: observeDeletes(env.R2_UPLOADS) }
          : observed.env,
        observed.context,
      );
    if (
      env.NODE_ENV !== "test" ||
      !env.E2E_STORAGE_SECRET ||
      request.headers.get("x-test-storage-secret") !== env.E2E_STORAGE_SECRET
    )
      return new Response(null, { status: 404 });

    if (url.pathname === publicationStoragePath) {
      const key = url.searchParams.get("key");
      const object = key?.match(
        /^publications\/(?:body_markdown|asset)\/sha256\/([0-9a-f]{2})\/([0-9a-f]{64})$/,
      );
      const image =
        key && /^publications\/images\/url-sha256\/[0-9a-f]{64}$/.test(key);
      if (!key || !(image || (object && object[1] === object[2].slice(0, 2))))
        return new Response("Expected a publication fixture object key", {
          status: 400,
        });
      if (request.method === "PUT") {
        await env.R2_PUBLICATIONS.put(key, await request.arrayBuffer(), {
          httpMetadata: {
            contentType:
              request.headers.get("content-type") ?? "application/octet-stream",
          },
        });
        return new Response(null, { status: 204 });
      }
      if (request.method === "GET") {
        const stored = await env.R2_PUBLICATIONS.get(key);
        return stored
          ? new Response(await stored.arrayBuffer(), {
              headers: {
                "content-type":
                  stored.httpMetadata?.contentType ??
                  "application/octet-stream",
              },
            })
          : new Response(null, { status: 404 });
      }
      return new Response(null, { status: 405 });
    }

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

    // Exact-key probes pause only the real delete call. Tests can inspect
    // committed metadata while it is pending, then release to failure/success.
    if (url.searchParams.has("deleteProbe")) {
      switch (request.method) {
        case "GET":
          return Response.json(deleteProbes.get(key) ?? null);
        case "POST": {
          const body: unknown = await request.json();
          if (
            !body ||
            typeof body !== "object" ||
            !("fail" in body) ||
            typeof body.fail !== "boolean" ||
            !("hold" in body) ||
            typeof body.hold !== "boolean"
          )
            return new Response("Expected boolean fail and hold", {
              status: 400,
            });
          const probe = deleteProbes.get(key) ?? {
            attempts: 0,
            pending: 0,
            fail: false,
            hold: false,
          };
          probe.fail = body.fail;
          probe.hold = body.hold;
          deleteProbes.set(key, probe);
          return Response.json(probe);
        }
        case "DELETE": {
          const probe = deleteProbes.get(key);
          if (probe) {
            probe.hold = false;
            probe.fail = false;
          }
          deleteProbes.delete(key);
          return new Response(null, { status: 204 });
        }
        default:
          return new Response(null, { status: 405 });
      }
    }

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
