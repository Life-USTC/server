import { expect } from "vitest";
import { accountProfileTest as it } from "../shared/account-profile-contract-fixture";

it("user.account-profile-oauth-projection", async ({
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
    const sessionResponse = await fetch(`${origin}/api/account/profile`, {
      headers: { cookie },
    });
    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toMatchObject({
      id: userId,
      email,
      isAdmin: true,
    });
    const sessionGraph = await graph(selection, { cookie });
    expect(sessionGraph.errors).toBeUndefined();
    expect(sessionGraph.data.account.profile).toMatchObject({
      id: userId,
      email,
      isAdmin: true,
    });
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
      const response = await fetch(
        `${origin}/api/account/profile?userId=${otherUserId}`,
        { headers: await authorization("rest", allowed) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject(expected);
      const graphql = await graph(
        selection,
        await authorization("graphql", allowed),
      );
      expect(graphql.errors).toBeUndefined();
      expect(graphql.data.account.profile).toMatchObject(expected);
      expect(await mcp("account_profile_get", {}, allowed)).toMatchObject(
        expected,
      );
    }
  });
});
