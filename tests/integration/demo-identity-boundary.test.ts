import { resolveApiPrincipal } from "@/lib/auth/api-auth";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";

// Isolate the real Better Auth singleton from the registration-only case.
it("demo.no-live-writes", { tags: ["@Account/Service"] }, async ({
  isolatedDatabase: { owner: fixtures },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { actor, victim, token, session } = await fixtures.$transaction(
      async (tx) => {
        const [actor, victim] = await Promise.all(
          ["actor", "victim"].map(async (name) => {
            const user = await tx.user.create({
              data: {
                name: `[integration-test] Demo boundary ${name}`,
                email: `demo-boundary-${crypto.randomUUID()}@example.test`,
              },
            });
            return user;
          }),
        );
        const token = crypto.randomUUID();
        const session = await tx.session.create({
          data: {
            userId: actor.id,
            sessionToken: token,
            expires: new Date(Date.now() + 3_600_000),
          },
        });
        return { actor, victim, token, session };
      },
    );
    const context = await getBetterAuthInstance().$context;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(context.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(token)),
    );
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${btoa(String.fromCharCode(...signature))}`)}`;
    for (const authenticated of [false, true]) {
      const principal = await protocolRuntime.request(() =>
        resolveApiPrincipal(
          new Request(
            `${origin}/api/workspace/todos?demo=true&userId=${victim.id}`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-demo-user-id": victim.id,
                "x-user-id": victim.id,
                cookie: `${authenticated ? `${cookie}; ` : ""}demo_user=${victim.id}; demo=true`,
              },
              body: JSON.stringify({
                demo: true,
                userId: victim.id,
                principal: { kind: "demo", userId: victim.id },
              }),
            },
          ),
          { bearerScope: { feature: "workspace.todo", action: "write" } },
        ),
      );
      expect(principal).toEqual(
        authenticated
          ? { kind: "session", userId: actor.id, sessionId: session.id }
          : null,
      );
    }
    expect(
      await fixtures.session.findUnique({
        where: { id: session.id },
        select: { userId: true },
      }),
    ).toEqual({ userId: actor.id });
    expect(await fixtures.session.count({ where: { userId: victim.id } })).toBe(
      0,
    );
  });
});
