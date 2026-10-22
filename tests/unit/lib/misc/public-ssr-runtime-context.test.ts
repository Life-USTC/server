import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWaitUntil } from "../../../shared/wait-until";

/**
 * The public SSR entrypoint must hand renders a usable task scheduler.
 *
 * `ctx.exports.PublicSsr(...).fetch()` is a separate invocation, so the default
 * entrypoint's runtime context never reaches it, and the generated SvelteKit
 * adapter worker (`.svelte-kit/cloudflare/_sveltekit.js`) has the signature
 * `fetch(req, env)` — it drops the execution context passed third and calls
 * `server.respond(req, { getClientAddress })` with no `platform`. So
 * `hooks.server.ts` sees neither `platform.ctx` nor a parent context, and
 * `getCloudflareRuntimeTaskScheduler()` returns undefined unless this
 * entrypoint establishes the context itself.
 *
 * Every deferred write behind `getCloudflareRuntimeTaskScheduler()` is silently
 * dropped when that happens; the public detail caches recorded it only as a
 * `scheduler_unavailable` analytics reason and never populated. Keep this
 * assertion on the real `cloudflare-runtime` module, never a mock of it.
 */
const backgroundTasks = createWaitUntil();

const { appFetchMock } = vi.hoisted(() => ({ appFetchMock: vi.fn() }));

vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("cloudflare:workers", () => ({
  // `this.ctx` / `this.env` as the real base class exposes them.
  WorkerEntrypoint: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));
vi.mock("life-ustc-sveltekit-worker", () => ({
  default: { fetch: appFetchMock },
}));

import {
  getCloudflareRuntimeTaskScheduler,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import { PublicSsr } from "@/worker";

/**
 * The JS production module's inferred type omits its native base constructor,
 * which takes the execution context and env — the same cast the e2e storage
 * fixture uses to instantiate this entrypoint.
 */
const PublicSsrEntrypoint = PublicSsr as unknown as new (
  ctx: { waitUntil(task: Promise<unknown>): void },
  env: Record<string, unknown>,
) => PublicSsr;

/**
 * Stand in for the generated adapter worker plus `hooks.server.ts`: the
 * adapter's `fetch(req, env)` ignores any third argument and supplies no
 * `platform`, so the hook can only pass `undefined` as its execution context.
 */
function renderThroughSvelteKit(record: (scheduler: unknown) => void) {
  return async (_request: Request, env: unknown) => {
    const platform = undefined as
      | { context?: unknown; ctx?: unknown; env?: unknown }
      | undefined;
    return await runWithCloudflareRuntimeEnv(
      platform?.env ?? env,
      () => {
        record(getCloudflareRuntimeTaskScheduler());
        return new Response('<!doctype html><html lang="zh-cn"></html>', {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      },
      platform?.ctx ?? platform?.context,
    );
  };
}

describe("public SSR runtime context", () => {
  beforeEach(() => {
    appFetchMock.mockReset();
  });

  it("rendering-and-cache.cache-layers-and-invalidation-13", async () => {
    let scheduler: unknown;
    appFetchMock.mockImplementation(
      renderThroughSvelteKit((observed) => {
        scheduler = observed;
      }),
    );

    const scheduled: Promise<unknown>[] = [];
    const entrypoint = new PublicSsrEntrypoint(
      {
        waitUntil(task: Promise<unknown>) {
          scheduled.push(task);
          backgroundTasks.waitUntil(task);
        },
      },
      {},
    );

    const response = await entrypoint.fetch(
      new Request("https://life-ustc.test/catalog/sections/9902002", {
        headers: { Accept: "text/html" },
      }),
    );
    expect(response.status).toBe(200);

    // Without a runtime context in this entrypoint the render sees no
    // scheduler and drops every deferred cache write.
    expect(typeof scheduler).toBe("function");

    const deferred = Promise.resolve("cache-write");
    (scheduler as (task: Promise<unknown>) => void)(deferred);
    await backgroundTasks.drain();
    expect(scheduled).toContain(deferred);
  });
});
