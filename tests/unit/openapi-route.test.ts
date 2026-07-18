import { describe, expect, it } from "vitest";
import { getOpenApiRoute } from "@/lib/api/routes/openapi";

describe("OpenAPI document route", () => {
  it("serves the build-time document with public cache headers", async () => {
    const response = getOpenApiRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await expect(response.json()).resolves.toMatchObject({
      openapi: "3.0.0",
      info: { title: "Life@USTC API" },
    });
  });
});
