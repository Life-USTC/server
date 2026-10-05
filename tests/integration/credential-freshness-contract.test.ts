import { makeSignature } from "better-auth/crypto";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";

it("user.sensitive-account-recent-auth", { tags: ["@Account/OAuth"] }, async ({
  isolatedDatabase: { owner: db },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { user, passkey, account } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: `freshness-${crypto.randomUUID()}@test.invalid`,
          name: "Original",
        },
      });
      const passkey = await tx.passkey.create({
        data: {
          userId: user.id,
          name: "Original",
          publicKey: "controlled-public-key",
          credentialID: crypto.randomUUID(),
          counter: 0,
          deviceType: "singleDevice",
          backedUp: false,
        },
      });
      const account = await tx.account.create({
        data: {
          userId: user.id,
          provider: "github",
          issuer: "https://github.com",
          providerAccountId: crypto.randomUUID(),
        },
      });
      return { user, passkey, account };
    });
    const auth = getBetterAuthInstance();
    const context = await auth.$context;
    async function session(
      age: number,
      state: "valid" | "expired" | "revoked" = "valid",
    ) {
      const token = crypto.randomUUID();
      const row = await db.session.create({
        data: {
          userId: user.id,
          sessionToken: token,
          createdAt: new Date(Date.now() - age),
          expires: new Date(
            Date.now() + (state === "expired" ? -60_000 : 3600_000),
          ),
        },
      });
      if (state === "revoked")
        await db.session.delete({ where: { id: row.id } });
      return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
    }
    const bodies: [string, object][] = [
      ["/change-email", { newEmail: "changed@test.invalid" }],
      [
        "/change-password",
        { currentPassword: "old-password", newPassword: "new-password" },
      ],
      [
        "/link-social",
        {
          provider: "github",
          callbackURL: `${origin}/account/settings/security`,
        },
      ],
      [
        "/passkey/verify-registration",
        { response: {}, name: "New credential" },
      ],
      ["/passkey/update-passkey", { id: passkey.id, name: "Renamed" }],
      ["/passkey/delete-passkey", { id: passkey.id }],
      ["/unlink-account", { accountId: account.id }],
    ];
    let requestNumber = 0;
    const post = (path: string, body: object, cookie: string) =>
      protocolRuntime.request(() =>
        auth.handler(
          new Request(`${origin}/api/auth${path}`, {
            method: "POST",
            headers: {
              origin,
              cookie,
              "content-type": "application/json",
              "cf-connecting-ip": `192.0.2.${++requestNumber}`,
            },
            body: JSON.stringify(body),
          }),
        ),
      );
    for (const [label, cookie, status, code] of [
      ["stale", await session(960_000), 403, "SESSION_NOT_FRESH"],
      ["future", await session(-60_000), 403, "SESSION_NOT_FRESH"],
      ["expired", await session(60_000, "expired"), 401, "UNAUTHORIZED"],
      ["revoked", await session(60_000, "revoked"), 401, "UNAUTHORIZED"],
      ["missing", "", 401, "UNAUTHORIZED"],
    ] as const) {
      for (const [path, body] of bodies) {
        const response = await post(path, body, cookie);
        const result = await response.json();
        expect(
          response.status,
          `${label} ${path}: ${JSON.stringify(result)}`,
        ).toBe(status);
        expect(result).toMatchObject({ code });
        expect(
          await db.passkey.findMany({ where: { userId: user.id } }),
        ).toEqual([passkey]);
        expect(await db.user.findUnique({ where: { id: user.id } })).toEqual(
          user,
        );
        expect(
          await db.account.findMany({ where: { userId: user.id } }),
        ).toEqual([account]);
      }
    }
    const renamed = await post(
      "/passkey/update-passkey",
      { id: passkey.id, name: "Fresh rename" },
      await session(60_000),
    );
    expect(renamed.status, await renamed.text()).toBe(200);
    expect(
      await db.passkey.findUnique({ where: { id: passkey.id } }),
    ).toMatchObject({ name: "Fresh rename" });
  });
});
