import { describe, expect, it, vi } from "vitest";
import {
  isDemoApiDocsReadPath,
  isKnownApiDocsPath,
  type OpenApiDocument,
} from "@/features/api-docs/lib/docs-navigation";
import { requireDemoApiDocsPath } from "@/features/api-docs/server/demo-api-docs";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getOpenApiRoute } from "@/lib/api/routes/openapi";

const document: OpenApiDocument = {
  openapi: "3.1.0",
  servers: [{ url: "/" }],
  info: { title: "Owned contract" },
  tags: [{ name: "Catalog Section" }],
  paths: {
    "/api/catalog/sections/{id}": {
      get: { tags: ["Catalog Section"], summary: "Read one section" },
    },
  },
};
const tag = "/api/docs/tag/catalog-section";
const operation = `${tag}/GET/api/catalog/sections/%7Bid%7D`;
describe("Demo API documentation local reading", () => {
  it("admits only the existing document route shapes", () => {
    for (const path of [
      "/api-docs",
      "/api/docs",
      tag,
      `${tag}/__data.json`,
      operation,
      "/api/openapi",
    ])
      expect(isDemoApiDocsReadPath(path)).toBe(true);
    for (const path of [
      "/api/openapi/extra",
      "/api/docs/authorize",
      "/api/docs/tag/a/execute/x",
      "/api/docs/tag/a/GET",
      "/api/health",
    ])
      expect(isDemoApiDocsReadPath(path)).toBe(false);
  });
  it("never uses the ordinary unknown-tag or unknown-operation fallback", () => {
    expect(isKnownApiDocsPath(document, tag)).toBe(true);
    expect(isKnownApiDocsPath(document, operation)).toBe(true);
    for (const path of [
      "/api/docs/tag/foreign",
      `${tag}/GET/api/private`,
      `${tag}/POST/api/catalog/sections/%7Bid%7D`,
    ])
      expect(isKnownApiDocsPath(document, path)).toBe(false);
  });
  it("uses the actual local assets binding with private spec responses", async () => {
    const fetch = vi.fn(async () => Response.json(document));
    const response = await runWithCloudflareRuntimeEnv(
      { ASSETS: { fetch } },
      () =>
        getOpenApiRoute(new Request("https://owned.test/api/openapi"), true),
    );
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        url: "https://owned.test/openapi.generated.json",
        method: "GET",
      }),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(document);
  });
  it("omits the actual spec HEAD body but still reads local ASSETS", async () => {
    const fetch = vi.fn(async () => Response.json(document));
    const response = await runWithCloudflareRuntimeEnv(
      { ASSETS: { fetch } },
      () =>
        getOpenApiRoute(
          new Request("https://owned.test/api/openapi", { method: "HEAD" }),
          true,
        ),
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(await response.text()).toBe("");
  });
  it("fails closed without ASSETS instead of falling back to global self HTTP", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await runWithCloudflareRuntimeEnv({}, () =>
      getOpenApiRoute(new Request("https://owned.test/api/openapi"), true),
    );
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("validates page HEAD membership using a real local GET document", async () => {
    const fetch = vi.fn(async () => Response.json(document));
    await runWithCloudflareRuntimeEnv({ ASSETS: { fetch } }, () =>
      requireDemoApiDocsPath(
        new Request(`https://owned.test${operation}`, { method: "HEAD" }),
        operation,
      ),
    );
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ method: "GET" }),
    );
  });
  it("fails closed if a future spec introduces an editable or external server", async () => {
    for (const servers of [
      [{ url: "https://example.invalid" }],
      [{ url: "/" }, { url: "/other" }],
      [{ url: "/", variables: {} }],
    ]) {
      await expect(
        runWithCloudflareRuntimeEnv(
          {
            ASSETS: {
              fetch: async () => Response.json({ ...document, servers }),
            },
          },
          () =>
            requireDemoApiDocsPath(
              new Request(`https://owned.test${tag}`),
              tag,
            ),
        ),
      ).rejects.toMatchObject({ status: 503 });
    }
  });
  it("returns 404 for an unknown document path, with no ordinary reader", async () => {
    await expect(
      runWithCloudflareRuntimeEnv(
        { ASSETS: { fetch: async () => Response.json(document) } },
        () =>
          requireDemoApiDocsPath(
            new Request("https://owned.test/api/docs/tag/foreign"),
            "/api/docs/tag/foreign",
          ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
