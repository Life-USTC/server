import { expect, test } from "@playwright/test";
import { assertPageContract } from "../_shared/page-contract";

test("/demo page contract", async ({ page }, testInfo) => {
  await assertPageContract(page, { routePath: "/demo", testInfo });
});

test("demo session reads fixtures and marks writes as simulated", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Enter isolated demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Sample todos" }),
  ).toBeVisible();

  const tokenResponse = await page.request.post("/api/demo/token");
  expect(tokenResponse.status()).toBe(200);
  expect(tokenResponse.headers()["cache-control"]).toBe("no-store");
  const token = (await tokenResponse.json()) as { accessToken: string };
  const headers = { authorization: `Bearer ${token.accessToken}` };

  const before = await page.request.get("/api/demo/todos", { headers });
  expect(before.status()).toBe(200);
  const fixture = await before.json();

  const created = await page.request.post("/api/demo/todos", {
    data: { title: "演示待办" },
    headers,
  });
  expect(created.status()).toBe(200);
  expect(created.headers()["x-life-ustc-simulated"]).toBe("true");
  expect((await created.json()).simulated).toBe(true);

  const after = await page.request.get("/api/demo/todos", { headers });
  expect(after.status()).toBe(200);
  expect(await after.json()).toEqual(fixture);
});
