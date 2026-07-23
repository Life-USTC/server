import { expect, test } from "@playwright/test";
import { assertApiContract } from "../../_shared/api-contract";

test("/api/account/preferences 接口契约", async ({ request, baseURL }) => {
  await assertApiContract(request, {
    routePath: "/api/account/preferences",
    baseURL,
  });
});

test("/api/account/preferences 非法 locale 返回 400", async ({ request }) => {
  const response = await request.post("/api/account/preferences", {
    data: { locale: "invalid-locale" },
  });
  expect(response.status()).toBe(400);
});
