import {
  socialCookies as cookies,
  socialLoginTest,
} from "../shared/social-login-fixture";

const it = socialLoginTest.extend({ socialIp: "192.0.2.1" });

it("user.oauth-callback-integrity", { tags: ["@Account/OAuth"] }, async ({
  social,
  expect,
}) => {
  await social.run(async () => {
    const { db, origin, email, fetch, start, network } = social;
    for (const variant of ["wrong-state", "missing-cookie"] as const) {
      const flow = await start();
      const before = network.upstreamTokenRequests;
      const response = await fetch(
        `${origin}/api/auth/callback/github?code=controlled-code&state=${variant === "wrong-state" ? "incorrect-state" : encodeURIComponent(flow.state)}`,
        {
          headers: { cookie: variant === "missing-cookie" ? "" : flow.cookie },
          redirect: "manual",
        },
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain("error=");
      await response.text();
      expect(network.upstreamTokenRequests).toBe(before);
      expect(await db.user.count({ where: { email } })).toBe(0);
    }
    const flow = await start();
    const callback = `${origin}/api/auth/callback/github?code=controlled-code&state=${encodeURIComponent(flow.state)}`;
    const response = await fetch(callback, {
      headers: { cookie: flow.cookie },
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      `${origin}/catalog/courses?from=oauth`,
    );
    await response.text();
    const sessionResponse = await fetch(
      `${origin}/api/auth/get-session?disableCookieCache=true`,
      { headers: { cookie: cookies(response) } },
    );
    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json();
    expect(session.user).toMatchObject({ email, name: "" });
    const account = await db.account.findFirstOrThrow({
      where: { userId: session.user.id, provider: "github" },
    });
    expect(account.providerAccountId).toBe("1900260927");
    expect(await db.session.count({ where: { userId: session.user.id } })).toBe(
      1,
    );
    const before = network.upstreamTokenRequests;
    const replay = await fetch(callback, {
      headers: { cookie: flow.cookie },
      redirect: "manual",
    });
    expect(replay.status).toBe(302);
    expect(replay.headers.get("location")).toContain("error=");
    await replay.text();
    expect(network.upstreamTokenRequests).toBe(before);
    expect(await db.session.count({ where: { userId: session.user.id } })).toBe(
      1,
    );
  });
});
