import { expect, test } from "@playwright/test";

test.describe("未知 API 路由", () => {
  test("GET 与非 GET 请求都返回 JSON 404", async ({ request }) => {
    for (const [path, method] of [
      ["/api/nonexistent", "GET"],
      ["/api/removed/nested-endpoint", "POST"],
    ] as const) {
      const response = await request.fetch(path, { method });

      expect(response.status()).toBe(404);
      expect(response.headers()["content-type"]).toBe(
        "application/json; charset=utf-8",
      );
      await expect(response.json()).resolves.toEqual({ error: "Not found" });
    }
  });
});
