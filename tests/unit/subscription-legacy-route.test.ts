import { describe, expect, it } from "vitest";
import * as legacySubscriptionsRoute from "@/routes/dashboard/subscriptions/sections/+page.server";
import overviewContract from "../../docs/contracts/overview.json";
import subscribedSectionsContract from "../../docs/contracts/subscribed-sections.json";
import subscriptionContract from "../../docs/contracts/subscription.json";

const canonicalPath = "/dashboard/subscriptions";
const legacyPath = "/dashboard/subscriptions/sections";

type ContractModule = {
  rules?: Record<string, string>;
  capabilities: Record<
    string,
    {
      web?: string | { pages: string[] };
    }
  >;
};

function capabilityPages(contract: ContractModule, capability: string) {
  const web = contract.capabilities[capability]?.web;
  if (!web || typeof web === "string") {
    throw new Error(`Missing web pages for ${capability}`);
  }
  return web.pages;
}

describe("旧版订阅班级路由", () => {
  it("将 GET 请求重定向到标准订阅页面", async () => {
    await expect(
      legacySubscriptionsRoute.load({
        url: new URL(
          "https://life.example/dashboard/subscriptions/sections?semester=2026-spring",
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

  it("记录标准页面并保持旧版 URL 仅用于重定向", () => {
    const canonicalCapabilities = [
      [subscriptionContract, "batch-subscribe-by-codes"],
      [subscribedSectionsContract, "subscribed-sections-tab"],
      [overviewContract, "authenticated-overview"],
    ] as const satisfies readonly [ContractModule, string][];

    for (const [contract, capability] of canonicalCapabilities) {
      const pages = capabilityPages(contract, capability);
      expect(pages).toContain(canonicalPath);
      expect(pages).not.toContain(legacyPath);
    }

    const legacyRule =
      subscribedSectionsContract.rules["legacy-sections-route"];
    expect(legacyRule).toContain(legacyPath);
    expect(legacyRule).toContain(canonicalPath);
    expect(legacyRule).toMatch(/redirect-only/);
    expect(legacyRule).toMatch(/must not expose page actions/);
  });
});
