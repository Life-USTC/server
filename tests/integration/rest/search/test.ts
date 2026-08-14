import { expect, test } from "@playwright/test";

test.describe("GET /api/search", () => {
  test("accepts the catalog search bound and rejects longer queries", async ({
    request,
  }) => {
    const accepted = await request.get(
      `/api/search?q=${"a".repeat(200)}&locale=zh-cn`,
    );
    expect(accepted.status()).toBe(200);

    const rejected = await request.get(
      `/api/search?q=${"a".repeat(201)}&locale=zh-cn`,
    );
    expect(rejected.status()).toBe(400);
    await expect(rejected.json()).resolves.toEqual({
      error: "Search query must not exceed 200 characters",
    });
  });
});
