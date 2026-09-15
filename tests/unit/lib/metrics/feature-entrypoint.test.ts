import { afterEach, expect, it, vi } from "vitest";
import { handle } from "@/hooks.server";
import { INTERNAL_REQUEST_ID_HEADER } from "@/lib/log/worker-entrypoint-observability";
import worker from "@/worker";

vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
const { appFetch, writeObservabilityBatch, waitUntil } = vi.hoisted(() => ({
  appFetch: vi.fn(),
  waitUntil: vi.fn(),
  writeObservabilityBatch: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("life-ustc-sveltekit-worker", () => ({ default: { fetch: appFetch } }));
vi.mock("@/lib/db/feature-event-store", () => ({
  writeObservabilityBatch,
}));
vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
  logApiRequest: vi.fn(),
}));

vi.mock("@/app-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app-env")>()),
  loadEnv: vi.fn(),
}));

const env = {};
const featureEvents = () =>
  writeObservabilityBatch.mock.calls.flatMap(([batch]) => batch.features ?? []);
async function flushObservability() {
  await Promise.resolve();
  await Promise.resolve();
  const tasks = waitUntil.mock.calls.map(([task]) => task);
  if (tasks.length > 0) await Promise.all(tasks);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
function appHandle(request: Request) {
  return handle({
    event: {
      request,
      url: new URL(request.url),
      route: { id: "/api/catalog/courses" },
      params: {},
      cookies: { get: () => undefined },
      locals: {},
      platform: { env },
    },
    resolve: async () =>
      new Response("payload", {
        headers: { "content-type": "application/json" },
      }),
  } as unknown as Parameters<typeof handle>[0]);
}
afterEach(() => {
  writeObservabilityBatch.mockReset().mockResolvedValue(undefined);
  waitUntil.mockReset();
  appFetch.mockReset();
  vi.unstubAllGlobals();
});

it("records a dynamic REST request once across actual Worker and application hooks", async () => {
  appFetch.mockImplementation(appHandle);
  const request = new Request("https://example.com/api/catalog/courses");
  const response = await worker.fetch(request, env, { waitUntil });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("payload");
  expect(appFetch).toHaveBeenCalledTimes(1);
  await flushObservability();
  expect(featureEvents()).toHaveLength(1);
  expect(featureEvents()[0]).toMatchObject({
    feature: "catalog.course",
    operation: "list",
    protocol: "rest",
    surface: "unknown",
    authMode: "anonymous",
    outcome: "success",
    errorClass: "none",
  });
});

it.each(["HIT", "MISS"])(
  "records a public cache %s once without changing cache keys",
  async (cacheStatus) => {
    vi.stubGlobal(
      "HTMLRewriter",
      class {
        on() {
          return this;
        }
        transform(response: Response) {
          return response;
        }
      },
    );
    const cachedFetch = vi.fn().mockResolvedValue(
      new Response("cached", {
        headers: {
          "content-type": "text/html",
          "cf-cache-status": cacheStatus,
        },
      }),
    );
    const response = await worker.fetch(
      new Request("https://example.com/catalog/courses", {
        headers: { accept: "text/html" },
      }),
      env,
      {
        waitUntil,
        exports: { PublicSsr: () => ({ fetch: cachedFetch }) },
      },
    );
    expect(await response.text()).toBe("cached");
    await flushObservability();
    expect(featureEvents()).toHaveLength(1);
    expect(featureEvents()[0]).toMatchObject({
      feature: "catalog.course",
      operation: "view",
      protocol: "web",
      surface: "web",
      authMode: "anonymous",
    });
    expect(cachedFetch.mock.calls[0][1]).toEqual({
      cf: { cacheKey: "/catalog/courses?__life_locale=zh-cn&__life_mode=page" },
    });
    expect(appFetch).not.toHaveBeenCalled();
  },
);

it("does not count an internal cache-origin request a second time", async () => {
  await appHandle(
    new Request("https://example.com/api/catalog/courses", {
      headers: {
        [INTERNAL_REQUEST_ID_HEADER]: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      },
    }),
  );
  await flushObservability();
  expect(featureEvents()).toHaveLength(0);
});

it("records a standalone local application request once", async () => {
  await appHandle(new Request("https://example.com/api/catalog/courses"));
  await flushObservability();
  expect(featureEvents()).toHaveLength(1);
});
