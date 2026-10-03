import {
  socialCookies as cookies,
  socialLoginTest,
} from "../shared/social-login-fixture";

const it = socialLoginTest.extend({ socialIp: "192.0.2.4" });

it("user.sign-in-providers", async ({ social, expect }) => {
  await social.run(async () => {
    const { db, origin, marker, oidcSubject, fetch } = social;
    for (const [
      provider,
      endpoint,
      callbackPath,
      expectedSubject,
      upstreamOrigin,
    ] of [
      [
        "github",
        "/sign-in/social",
        "/callback/github",
        "1900260927",
        "https://github.com",
      ],
      [
        "google",
        "/sign-in/social",
        "/callback/google",
        `google-${marker}`,
        "https://accounts.google.com",
      ],
      [
        "oidc",
        "/sign-in/social",
        "/callback/oidc",
        oidcSubject,
        "https://oidc.example.test",
      ],
    ]) {
      const started = await fetch(`${origin}/api/auth${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({
          provider,
          callbackURL: `${origin}/workspace/overview`,
          disableRedirect: true,
        }),
      });
      expect(started.status).toBe(200);
      const authorization = new URL((await started.json()).url);
      expect(authorization.origin).toBe(upstreamOrigin);
      expect(authorization.searchParams.get("redirect_uri")).toBe(
        `${origin}/api/auth${callbackPath}`,
      );
      expect(authorization.searchParams.get("state")).toBeTruthy();
      const completed = await fetch(
        `${origin}/api/auth${callbackPath}?${new URLSearchParams({ code: "controlled-code", state: authorization.searchParams.get("state") ?? "" })}`,
        { headers: { cookie: cookies(started) }, redirect: "manual" },
      );
      expect(completed.status).toBe(302);
      expect(completed.headers.get("location")).toBe(
        `${origin}/workspace/overview`,
      );
      await completed.text();
      const sessionResponse = await fetch(
        `${origin}/api/auth/get-session?disableCookieCache=true`,
        { headers: { cookie: cookies(completed) } },
      );
      expect(sessionResponse.status).toBe(200);
      const current = await sessionResponse.json();
      expect(current.user.name).toBe("");
      const user = await db.user.findUniqueOrThrow({
        where: { id: current.user.id },
      });
      expect(user.name).toBe("");
      expect(user.username).toBeNull();
      const accounts = await db.account.findMany({
        where: { userId: current.user.id },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        provider,
        providerAccountId: expectedSubject,
      });
      expect(accounts[0].password).toBeNull();
    }
  });
});
