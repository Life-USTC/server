import { expect, test } from "@playwright/test";

test("GET /api/catalog/weather route is wired", async ({ request }) => {
  const response = await request.get(
    "/api/catalog/weather?locationKey=ustc-main",
  );
  // 200 if providers are configured and responding, 503 if both fail.
  expect([200, 503]).toContain(response.status());
  if (response.status() === 200) {
    const body = await response.json();
    expect(body.location.key).toBe("ustc-main");
    expect(typeof body.current.temperature).toBe("number");
  }
});
