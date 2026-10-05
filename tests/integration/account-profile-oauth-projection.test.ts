import { expect } from "vitest";
import { accountProfileTest as it } from "../shared/account-profile-contract-fixture";

for (const method of ["REST", "GraphQL", "MCP"] as const) {
  it(`user.account-profile-oauth-projection / ${method}`, {
    tags: [`@Account/${method}`],
  }, async ({
    account: {
      origin,
      fetch,
      cookie,
      userId,
      otherUserId,
      email,
      authorization,
      graph,
      mcp,
    },
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const selection = "{ account { profile { id email name isAdmin } } }";
      if (method === "REST") {
        const response = await fetch(`${origin}/api/account/profile`, {
          headers: { cookie },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          id: userId,
          email,
          isAdmin: true,
        });
      } else if (method === "GraphQL") {
        const result = await graph(selection, { cookie });
        expect(result.errors).toBeUndefined();
        expect(result.data.account.profile).toMatchObject({
          id: userId,
          email,
          isAdmin: true,
        });
      }
      for (const allowEmail of [false, true]) {
        const allowed = [
          "account.profile:read",
          ...(allowEmail ? ["email"] : []),
        ];
        const expected = {
          id: userId,
          email: allowEmail ? email : null,
          isAdmin: null,
        };
        if (method === "REST") {
          const response = await fetch(
            `${origin}/api/account/profile?userId=${otherUserId}`,
            { headers: await authorization("rest", allowed) },
          );
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject(expected);
        } else if (method === "GraphQL") {
          const result = await graph(
            selection,
            await authorization("graphql", allowed),
          );
          expect(result.errors).toBeUndefined();
          expect(result.data.account.profile).toMatchObject(expected);
        } else {
          expect(await mcp("account_profile_get", {}, allowed)).toMatchObject(
            expected,
          );
        }
      }
    });
  });
}
