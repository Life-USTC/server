import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { signInAsDebugUserApi } from "../_harness/auth";

test("private API successes and authentication errors never permit HTTP storage", async ({
  request,
}) => {
  for (const path of ["/api/account/profile", "/api/workspace/overview"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["cloudflare-cdn-cache-control"]).toBe("no-store");
  }

  await signInAsDebugUserApi(request, "/");
  for (const path of [
    "/api/account/profile",
    "/api/workspace/overview",
    `/api/community/comments?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
    `/api/community/section-homeworks?sectionJwId=${DEV_SEED.section.jwId}`,
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toBe("private, no-store");
    expect(response.headers()["cloudflare-cdn-cache-control"], path).toBe(
      "no-store",
    );
  }

  const publicResponse = await request.get("/api/catalog/courses?locale=zh-cn");
  expect(publicResponse.status()).toBe(200);
  expect(publicResponse.headers()["cache-control"]).toContain("public");
  expect(publicResponse.headers()["cloudflare-cdn-cache-control"]).toContain(
    "public",
  );
});
