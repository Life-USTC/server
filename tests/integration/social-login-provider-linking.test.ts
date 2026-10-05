import { getCookies } from "better-auth/cookies";
import { makeSignature } from "better-auth/crypto";
import { getBetterAuthInstance } from "@/lib/auth/core";
import {
  socialCookies as cookies,
  socialLoginTest,
} from "../shared/social-login-fixture";

const it = socialLoginTest.extend({ socialIp: "192.0.2.3" });

it("user.explicit-provider-linking", { tags: ["@Account/OAuth"] }, async ({
  social,
  expect,
}) => {
  await social.run(async () => {
    const { db, origin, email, fetch, start, request } = social;
    const owner = await db.user.create({
      data: { email, emailVerified: true, name: "Existing verified user" },
    });
    const flow = await start();
    const implicit = await fetch(
      `${origin}/api/auth/callback/github?code=unlinked-code&state=${encodeURIComponent(flow.state)}`,
      { headers: { cookie: flow.cookie }, redirect: "manual" },
    );
    expect(implicit.status).toBe(302);
    expect(implicit.headers.get("location")).toContain("error=");
    await implicit.text();
    expect(await db.account.count({ where: { userId: owner.id } })).toBe(0);
    expect(await db.session.count({ where: { userId: owner.id } })).toBe(0);
    async function sessionFor(userId: string) {
      const token = crypto.randomUUID();
      await db.session.create({
        data: {
          userId,
          sessionToken: token,
          expires: new Date(Date.now() + 3600000),
        },
      });
      const secret = (await request(() => getBetterAuthInstance().$context))
        .secret;
      return `${getCookies({ baseURL: origin }).sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, secret)}`)}`;
    }
    const link = async (cookie: string) => {
      const response = await fetch(`${origin}/api/auth/link-social`, {
        method: "POST",
        headers: { origin, cookie, "content-type": "application/json" },
        body: JSON.stringify({
          provider: "github",
          callbackURL: `${origin}/account/settings/linked-accounts`,
          disableRedirect: true,
        }),
      });
      expect(response.status).toBe(200);
      const authorization = new URL((await response.json()).url);
      const callback = await fetch(
        `${origin}/api/auth/callback/github?code=explicit-link&state=${encodeURIComponent(authorization.searchParams.get("state") ?? "")}`,
        {
          headers: { cookie: [cookie, cookies(response)].join("; ") },
          redirect: "manual",
        },
      );
      return callback;
    };
    const authorized = await link(await sessionFor(owner.id));
    expect(authorized.headers.get("location")).toBe(
      `${origin}/account/settings/linked-accounts`,
    );
    await authorized.text();
    expect(
      await db.account.count({
        where: { userId: owner.id, provider: "github" },
      }),
    ).toBe(1);
    const other = await db.user.create({
      data: { email: `other-${email}`, name: "Other identity" },
    });
    const blocked = await link(await sessionFor(other.id));
    expect(blocked.status).toBe(302);
    const location = blocked.headers.get("location") ?? "";
    expect(new URL(location, origin).searchParams.get("error")).toBe(
      "account_already_linked_to_different_user",
    );
    const body = await blocked.text();
    for (const privateValue of [owner.id, owner.name, owner.email]) {
      if (!privateValue)
        throw new Error("Expected an identifiable fixture owner");
      expect(location).not.toContain(privateValue);
      expect(location).not.toContain(encodeURIComponent(privateValue));
      expect(body).not.toContain(privateValue);
    }
    expect(await db.account.count({ where: { userId: other.id } })).toBe(0);
    expect(
      await db.account.count({
        where: { userId: owner.id, provider: "github" },
      }),
    ).toBe(1);
  });
});
