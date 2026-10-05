import type { Cookies } from "@sveltejs/kit";
import { refreshWelcomeOAuthProfile } from "@/features/welcome/server/welcome-oauth-refresh-action";
import {
  socialCookies as cookies,
  socialLoginTest,
} from "../shared/social-login-fixture";

const it = socialLoginTest.extend({ socialIp: "192.0.2.2" });

it("user.welcome-oauth-refresh", { tags: ["@Account/Service"] }, async ({
  social,
  expect,
}) => {
  await social.run(async () => {
    const { db, origin, email, fetch, start, network, request } = social;
    const flow = await start();
    const response = await fetch(
      `${origin}/api/auth/callback/github?code=controlled-code&state=${encodeURIComponent(flow.state)}`,
      { headers: { cookie: flow.cookie }, redirect: "manual" },
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/catalog/courses?from=oauth`,
    );
    await response.text();
    const sessionCookie = cookies(response);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const customImage = "https://example.test/user-choice.png";
    await db.user.update({
      where: { id: user.id },
      data: {
        name: "User chosen name",
        username: "socialchosen",
        image: customImage,
      },
    });
    const grantsBefore = await db.oAuthConsent.count({
      where: { userId: user.id },
    });
    async function refresh(providerId: string) {
      const setCookies: string[] = [];
      const input = {
        cookies: {
          set: (name: string, value: string) => {
            setCookies.push(`${name}=${encodeURIComponent(value)}`);
          },
        } as unknown as Cookies,
        locals: {
          locale: "en-us",
          requestId: "social-refresh-contract",
        } as App.Locals,
        request: new Request(`${origin}/account/welcome?/refreshOAuth`, {
          method: "POST",
          headers: { cookie: sessionCookie, origin },
          body: new URLSearchParams({
            providerId,
            callbackUrl: "/account/settings/profile",
          }),
        }),
      };
      try {
        return {
          result: await request(() => refreshWelcomeOAuthProfile(input)),
          setCookies,
        };
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          "location" in error
        )
          return {
            redirect: error as { status: number; location: string },
            setCookies,
          };
        throw error;
      }
    }
    for (const provider of ["google", "unsupported"]) {
      const rejected = await refresh(provider);
      expect(rejected.result?.status).toBe(400);
      expect(rejected.setCookies).toEqual([]);
    }
    for (const mode of ["preserve", "empty-profile"] as const) {
      if (mode === "empty-profile")
        await db.user.update({
          where: { id: user.id },
          data: { name: "", username: null, image: null },
        });
      network.upstreamName = `Updated upstream ${mode}`;
      network.upstreamImage = `https://example.test/upstream-${mode}.png`;
      const initiated = await refresh("github");
      expect(initiated.redirect?.status).toBe(303);
      const authorization = new URL(initiated.redirect?.location ?? "");
      expect(authorization.origin).toBe("https://github.com");
      const state = authorization.searchParams.get("state");
      expect(state).toBeTruthy();
      const callback = await fetch(
        `${origin}/api/auth/callback/github?code=refresh-code&state=${encodeURIComponent(state ?? "")}`,
        {
          headers: {
            cookie: [sessionCookie, ...initiated.setCookies].join("; "),
          },
          redirect: "manual",
        },
      );
      expect(callback.status).toBe(302);
      expect(
        new URL(callback.headers.get("location") ?? "", origin).pathname,
        callback.headers.get("location") ?? "Missing callback destination",
      ).toBe("/account/welcome");
      expect(
        new URL(
          callback.headers.get("location") ?? "",
          origin,
        ).searchParams.get("oauthRefreshed"),
      ).toBe("1");
      await callback.text();
      const updated = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(updated.name).toBe(mode === "preserve" ? "User chosen name" : "");
      expect(updated.image).toBe(
        mode === "preserve" ? customImage : network.upstreamImage,
      );
      expect(updated.username).toBe(
        mode === "preserve" ? "socialchosen" : null,
      );
      expect(updated.profilePictures).toContain(network.upstreamImage);
      expect(
        await db.account.count({
          where: { userId: user.id, provider: "github" },
        }),
      ).toBe(1);
      expect(await db.oAuthConsent.count({ where: { userId: user.id } })).toBe(
        grantsBefore,
      );
    }
  });
});
