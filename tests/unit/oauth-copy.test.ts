import { describe, expect, it } from "vitest";
import {
  oauthFeatureLabel,
  oauthScopeLabel,
} from "@/features/oauth/lib/oauth-copy";

describe("OAuth display copy", () => {
  it("localizes known scopes and analytics features from the canonical OAuth copy", () => {
    expect(oauthScopeLabel("en-us", "account.profile:read")).toBe(
      "Read your account profile (email also requires the email scope)",
    );
    expect(oauthFeatureLabel("en-us", "account.profile")).toBe("Profile");
    expect(oauthFeatureLabel("zh-cn", "workspace.calendar")).toBe("日历");
  });

  it("keeps unknown values visible for forward-compatible audit data", () => {
    expect(oauthScopeLabel("en-us", "future.scope")).toBe("future.scope");
    expect(oauthFeatureLabel("en-us", "future.feature")).toBe("future.feature");
  });
});
