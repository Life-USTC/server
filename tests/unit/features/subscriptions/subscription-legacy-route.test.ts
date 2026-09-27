import { describe, expect, it } from "vitest";
import * as legacySubscriptionsRoute from "@/routes/workspace/subscriptions/sections/+page.server";

const canonicalPath = "/workspace/subscriptions";
describe("旧版订阅班级路由", () => {
  it("将 GET 请求重定向到标准订阅页面", async () => {
    await expect(
      legacySubscriptionsRoute.load({
        url: new URL(
          "https://life.example/workspace/subscriptions/sections?semester=2026-spring",
        ),
      } as Parameters<typeof legacySubscriptionsRoute.load>[0]),
    ).rejects.toMatchObject({
      status: 308,
      location: `${canonicalPath}?semester=2026-spring`,
    });
  });

  it("旧版重定向路由不暴露页面 actions", () => {
    expect("actions" in legacySubscriptionsRoute).toBe(false);
  });
});
