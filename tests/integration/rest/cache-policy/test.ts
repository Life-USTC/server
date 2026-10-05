import { expect } from "@playwright/test";
import { signIn, test } from "../_harness/auth";

for (const domain of ["Account", "Overview", "Comment", "Homework"] as const)
  test(`${domain} private API responses never permit HTTP storage`, {
    tag: `@${domain}/REST`,
  }, async ({ run, request, account, catalogSection }) => {
    await run(async () => {
      const path = {
        Account: "/api/account/profile",
        Overview: "/api/workspace/overview",
        Comment: `/api/community/comments?targetType=section&sectionJwId=${catalogSection.jwId}`,
        Homework: `/api/community/section-homeworks?sectionJwId=${catalogSection.jwId}`,
      }[domain];
      if (domain === "Account" || domain === "Overview") {
        const response = await request.get(path);
        expect(response.status()).toBe(401);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
          "no-store",
        );
      }
      await signIn(request, account);
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["cache-control"], path).toBe(
        "private, no-store",
      );
      expect(response.headers()["cloudflare-cdn-cache-control"], path).toBe(
        "no-store",
      );
    });
  });

test("Catalog public API responses permit HTTP storage", {
  tag: "@Catalog/REST",
}, async ({ run, request, account }) => {
  await run(async () => {
    await signIn(request, account);
    const response = await request.get("/api/catalog/courses?locale=zh-cn");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("public");
    expect(response.headers()["cloudflare-cdn-cache-control"]).toContain(
      "public",
    );
  });
});
