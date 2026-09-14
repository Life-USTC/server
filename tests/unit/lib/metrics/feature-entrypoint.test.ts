import { afterEach, expect, it, vi } from "vitest";
import { handle } from "@/hooks.server";
import { INTERNAL_REQUEST_ID_HEADER } from "@/lib/log/worker-entrypoint-observability";
import worker from "@/worker";

vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));
const { appFetch } = vi.hoisted(() => ({ appFetch: vi.fn() }));
vi.mock("life-ustc-sveltekit-worker", () => ({ default: { fetch: appFetch } }));
vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
  logApiRequest: vi.fn(),
}));

vi.mock("@/app-env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app-env")>()),
  loadEnv: vi.fn(),
}));

const writeDataPoint = vi.fn();
const env = { ANALYTICS: { writeDataPoint } };
const featureEvents = () =>
  writeDataPoint.mock.calls
    .map(([event]) => event)
    .filter((event) => event.blobs?.[0] === "feature_operation_v1");
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
  writeDataPoint.mockReset();
  appFetch.mockReset();
  vi.unstubAllGlobals();
});

it("records a dynamic REST request once across actual Worker and application hooks", async () => {
  appFetch.mockImplementation(appHandle);
  const request = new Request("https://example.com/api/catalog/courses");
  const response = await worker.fetch(request, env, { waitUntil: vi.fn() });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("payload");
  expect(appFetch).toHaveBeenCalledTimes(1);
  expect(featureEvents()).toHaveLength(1);
  expect(featureEvents()[0].blobs.slice(1, 7)).toEqual([
    "catalog.course",
    "list",
    "rest",
    "unknown",
    "anonymous",
    "success",
  ]);
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
        waitUntil: vi.fn(),
        exports: { PublicSsr: () => ({ fetch: cachedFetch }) },
      },
    );
    expect(await response.text()).toBe("cached");
    expect(featureEvents()).toHaveLength(1);
    expect(featureEvents()[0].blobs.slice(1, 5)).toEqual([
      "catalog.course",
      "view",
      "web",
      "web",
    ]);
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
  expect(featureEvents()).toHaveLength(0);
});

it("records a standalone local application request once", async () => {
  await appHandle(new Request("https://example.com/api/catalog/courses"));
  expect(featureEvents()).toHaveLength(1);
});
