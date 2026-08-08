import { describe, expect, it } from "vitest";
import {
  buildWelcomeStepUrl,
  nextWelcomeStep,
  parseWelcomeStep,
  previousWelcomeStep,
  welcomeStepNumber,
} from "@/features/welcome/lib/welcome-steps";

describe("欢迎流程步骤", () => {
  it("将未知步骤解析为必填的资料步骤", () => {
    expect(parseWelcomeStep(null)).toBe("profile");
    expect(parseWelcomeStep("")).toBe("profile");
    expect(parseWelcomeStep("finish?")).toBe("profile");
    expect(parseWelcomeStep("subscriptions")).toBe("subscriptions");
    expect(parseWelcomeStep("finish")).toBe("finish");
  });

  it("按顺序前进和后退", () => {
    expect(welcomeStepNumber("profile")).toBe(1);
    expect(welcomeStepNumber("finish")).toBe(3);
    expect(nextWelcomeStep("profile")).toBe("subscriptions");
    expect(nextWelcomeStep("subscriptions")).toBe("finish");
    expect(nextWelcomeStep("finish")).toBeNull();
    expect(previousWelcomeStep("finish")).toBe("subscriptions");
    expect(previousWelcomeStep("profile")).toBeNull();
  });

  it("构建步骤 URL 时编码回调地址", () => {
    expect(
      buildWelcomeStepUrl("subscriptions", "/account/settings?tab=a"),
    ).toBe(
      "/account/welcome?step=subscriptions&callbackUrl=%2Faccount%2Fsettings%3Ftab%3Da",
    );
  });
});
