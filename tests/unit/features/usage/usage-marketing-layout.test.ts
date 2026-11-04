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
  expect(usageMarketingExampleGridClass).toContain("min-w-0");
  expect(usageMarketingExampleCardClass).toContain("min-w-0");
  expect(usageMarketingStepGridClass).toContain("min-w-0");
  expect(usageMarketingStepIndex(0)).toBe("01");
  expect(usageMarketingStepIndex(2)).toBe("03");
});
