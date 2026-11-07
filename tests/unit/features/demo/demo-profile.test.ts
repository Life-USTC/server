import { describe, expect, it, vi } from "vitest";
import { getDemoAccountProfile } from "@/features/demo/server/demo-profile";
import { loadSettingsPage } from "@/features/settings/server/settings-page-load";
import { meResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import { GET } from "@/routes/api/account/profile/+server";

const { livePage, liveProfile } = vi.hoisted(() => ({
  livePage: vi.fn(),
  liveProfile: vi.fn(),
}));
vi.mock("@/features/settings/server/settings-page-data", () => ({
  getSettingsPageData: livePage,
}));
vi.mock("@/lib/api/routes/account-profile-route", () => ({
  getAccountProfileRoute: liveProfile,
}));

const identity = {
  fixtureVersion: "workspace-v1",
  expiresAt: 1_800_000_000_000,
} as const;

describe("demo account profile", () => {
  it.each(["en-us", "zh-cn"] as const)(
    "shares fixed profile facts with page and existing API shape in %s without live reads",
    async (locale) => {
      livePage.mockClear();
      liveProfile.mockClear();
      const url = new URL(
        "https://demo.test/account/settings/profile?tab=accounts&message=Success&userId=victim",
      );
      const page = await loadSettingsPage({
        locals: { locale, demo: identity },
        request: new Request(url),
        tab: "profile",
        url,
      });
      const response = await GET({
        request: new Request(
          "https://demo.test/api/account/profile?userId=victim",
        ),
        locals: { locale, demo: identity },
      } as never);
      expect(response.status).toBe(200);
      const profile = meResponseSchema.parse(await response.json());
      expect(profile).toEqual({
        id: "demo:workspace-v1",
        email: "demo@example.test",
        username: "demo-student",
        name:
          locale === "en-us" ? "Demo account · Read only" : "演示账户 · 只读",
        image: null,
        isAdmin: false,
        createdAt: "2026-09-24T09:00:00+08:00",
        updatedAt: "2026-09-24T09:00:00+08:00",
      });
      const fixed = getDemoAccountProfile(identity, locale);
      expect(fixed.createdAt).toBeInstanceOf(Date);
      expect(fixed.updatedAt).toBeInstanceOf(Date);
      expect(page).toMatchObject({
        tab: "profile",
        message: null,
        user: { ...fixed, profilePictures: [] },
        demo: { ...identity, displayName: profile.name },
        accounts: [],
        authorizations: [],
        securityActivity: { hasCursor: false, items: [], nextCursor: null },
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
        "no-store",
      );
      expect(response.headers.get("vary")).toBe("Cookie");
      expect(livePage).not.toHaveBeenCalled();
      expect(liveProfile).not.toHaveBeenCalled();
    },
  );

  it("keeps ordinary profile page and API delegation unchanged", async () => {
    livePage.mockClear();
    liveProfile.mockClear();
    const url = new URL(
      "https://demo.test/account/settings/profile?message=Success",
    );
    const request = new Request(url);
    livePage.mockResolvedValue({ tab: "profile", marker: "ordinary" });
    const response = Response.json({ marker: "ordinary" });
    liveProfile.mockResolvedValue(response);
    expect(
      await loadSettingsPage({
        locals: { locale: "en-us", demo: null },
        request,
        tab: "profile",
        url,
      }),
    ).toMatchObject({ marker: "ordinary" });
    expect(livePage).toHaveBeenCalledExactlyOnceWith(request, url, "profile");
    expect(
      await GET({ request, locals: { locale: "en-us", demo: null } } as never),
    ).toBe(response);
    expect(liveProfile).toHaveBeenCalledExactlyOnceWith(request);
  });
});
