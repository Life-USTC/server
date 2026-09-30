import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { assertApiContract } from "../_shared/api-contract";

test("/api/account/preferences 接口契约", async ({ run, request, baseURL }) => {
  return run(async () => {
    await assertApiContract(request, {
      routePath: "/api/account/preferences",
      baseURL,
    });
  });
});

test("/api/account/preferences 非法 locale 返回 400", async ({ run, request }) => {
  return run(async () => {
    const response = await request.post("/api/account/preferences", {
      data: { locale: "invalid-locale" },
    });
    expect(response.status()).toBe(400);
  });
});
