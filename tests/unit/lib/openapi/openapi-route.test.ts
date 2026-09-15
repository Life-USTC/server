import { describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getOpenApiRoute } from "@/lib/api/routes/openapi";

describe("OpenAPI document route", () => {
  it("serves the build-time document with public cache headers", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        openapi: "3.0.0",
        info: { title: "Life@USTC API" },
      }),
    );
    const response = await runWithCloudflareRuntimeEnv(
      { ASSETS: { fetch } },
      () =>
        getOpenApiRoute(
          new Request("https://example.test/api/openapi", { method: "GET" }),
        ),
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.test/openapi.generated.json",
      }),
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await expect(response.json()).resolves.toMatchObject({
      openapi: "3.0.0",
      info: { title: "Life@USTC API" },
    });
  });

  it("omits the asset body for HEAD requests", async () => {
    const response = await runWithCloudflareRuntimeEnv(
      {
        ASSETS: {
          fetch: async () => Response.json({ openapi: "3.0.0" }),
        },
      },
      () =>
        getOpenApiRoute(
          new Request("https://example.test/api/openapi", { method: "HEAD" }),
        ),
    );

    expect(await response.text()).toBe("");
  });
});
