import { describe, expect, it } from "vitest";
import * as legacySubscriptionsRoute from "@/routes/workspace/subscriptions/sections/+page.server";
import { readSpecification } from "../../../../scripts/specifications/yaml";

const canonicalPath = "/workspace/subscriptions";
const legacyPath = "/workspace/subscriptions/sections";

type ContractModule = {
  requirements: { id: string; rule: string }[];
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

  it("记录标准页面并保持旧版 URL 仅用于重定向", async () => {
    const [subscriptionContract, subscribedSectionsContract, overviewContract] =
      await Promise.all([
        readSpecification<ContractModule>("docs/features/subscription.yaml"),
        readSpecification<ContractModule>(
          "docs/features/subscribed-sections.yaml",
        ),
        readSpecification<ContractModule>("docs/features/overview.yaml"),
      ]);
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

    const legacyRule = subscribedSectionsContract.requirements.find(
      (requirement) =>
        requirement.id === "subscribed-sections.legacy-sections-route",
    )?.rule;
    expect(legacyRule).toContain(legacyPath);
    expect(legacyRule).toContain(canonicalPath);
    expect(legacyRule).toMatch(/redirect-only/);
    expect(legacyRule).toMatch(/must not expose page actions/);
  });
});
