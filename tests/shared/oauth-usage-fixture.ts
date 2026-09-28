import { isolatedNodeTest } from "./isolated-node-fixture";

export const oauthUsageTest = isolatedNodeTest.extend<{
  usage: { userId: string; clientId: string; grantId: string };
}>({
  usage: async ({ isolatedDatabase: { owner: db }, nodeRuntime }, use) => {
    const identity = {
      userId: "usage-user",
      clientId: "usage-client",
      grantId: "usage-grant",
    };
    await nodeRuntime.run(() =>
      db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: identity.userId,
            email: "usage@example.test",
            name: "Usage summary user",
          },
        });
        await tx.oAuthClient.create({
          data: {
            clientId: identity.clientId,
            name: "Usage client",
            redirectUris: ["https://usage.example/callback"],
            skipConsent: false,
          },
        });
        await tx.oAuthConsent.create({
          data: {
            ...identity,
            scopes: ["account.profile:read", "workspace.todo:write"],
          },
        });
      }),
    );
    await use(identity);
  },
});
