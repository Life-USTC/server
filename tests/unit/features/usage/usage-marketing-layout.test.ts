import { expect, it } from "vitest";
import {
  usageMarketingExampleCardClass,
  usageMarketingExampleGridClass,
  usageMarketingIconClass,
  usageMarketingPrimaryCtaClass,
  usageMarketingStepGridClass,
  usageMarketingStepIndex,
  usageMarketingTitleClass,
} from "@/features/usage/lib/usage-marketing-layout";

it("usage.marketing-composition exports shared recipe classes", () => {
  expect(usageMarketingIconClass).toContain("size-14");
  expect(usageMarketingTitleClass).toContain("text-4xl");
  expect(usageMarketingPrimaryCtaClass).toContain("h-10");
  expect(usageMarketingExampleGridClass).toContain("md:grid-cols-3");
  expect(usageMarketingExampleGridClass).toContain("md:items-stretch");
  expect(usageMarketingExampleCardClass).toContain("h-full");
  expect(usageMarketingStepGridClass).toContain("lg:grid-cols-3");
  expect(usageMarketingStepGridClass).toContain("lg:items-stretch");
  expect(usageMarketingStepIndex(0)).toBe("01");
  expect(usageMarketingStepIndex(2)).toBe("03");
});
