import { expect } from "vitest";
import { accountProfileTest as it } from "../shared/account-profile-contract-fixture";

it("user.oauth-client-activity-isolation", async ({
  account: {
    db,
    marker,
    userId,
    otherUserId,
    clientId,
    grantId,
    origin,
    cookie,
    fetch,
    authorization,
    graph,
    mcp,
  },
  protocolRuntime,
}) => {
  await protocolRuntime.run(async () => {
    const allowed = ["account.client-activity:read"];
    const events = [];
    for (const [index, identity] of [
      { subjectUserId: userId, oauthClientId: clientId, oauthGrantId: grantId },
      { subjectUserId: userId, oauthClientId: clientId, oauthGrantId: grantId },
      {
        subjectUserId: otherUserId,
        oauthClientId: clientId,
        oauthGrantId: grantId,
      },
      {
        subjectUserId: userId,
        oauthClientId: `other-${clientId}`,
        oauthGrantId: grantId,
      },
      {
        subjectUserId: userId,
        oauthClientId: clientId,
        oauthGrantId: "other-generation",
      },
    ].entries()) {
      events.push(
        await db.auditLog.create({
          data: {
            ...identity,
            id: `activity-${marker}-${String(10 + index).padStart(2, "0")}`,
            action: "comment_create",
            channel: "rest",
            outcome: "success",
            createdAt: new Date(
              1_800_000_000_000 + (index < 2 ? 0 : index * 1000),
            ),
            ipAddress: "203.0.113.49",
            userAgent: "PRIVATE_USER_AGENT",
            sessionId: "PRIVATE_SESSION",
            requestId: "PRIVATE_REQUEST",
            targetId: "PRIVATE_TARGET",
            targetType: "comment",
          },
        }),
      );
    }
    // Equal timestamps must continue by descending unique ID, independently of insertion order.
    const expectedIds = [events[1].id, events[0].id];
    const fields = [
      "action",
      "channel",
      "createdAt",
      "id",
      "outcome",
      "targetType",
    ].sort();
    for (const surface of ["rest", "graphql", "mcp"] as const) {
      const observed: string[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 2; page++) {
        let result: {
          items: Record<string, unknown>[];
          nextCursor: string | null;
        };
        if (surface === "rest") {
          const query = new URLSearchParams({
            limit: "1",
            userId: otherUserId,
            clientId: `other-${clientId}`,
            grantId: "other-generation",
            ...(cursor ? { cursor } : {}),
          });
          const response = await fetch(
            `${origin}/api/account/client-activity?${query}`,
            { headers: await authorization(surface, allowed) },
          );
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toBe(
            "private, no-store",
          );
          result = await response.json();
        } else if (surface === "graphql") {
          const response = await graph(
            "query($cursor: String) { account { clientActivity(limit: 1, cursor: $cursor) { items { id action outcome channel createdAt targetType } nextCursor } } }",
            await authorization(surface, allowed),
            { cursor },
          );
          expect(response.errors).toBeUndefined();
          result = response.data.account.clientActivity;
        } else
          result = await mcp(
            "account_client_activity_list",
            { limit: 1, ...(cursor ? { cursor } : {}) },
            allowed,
          );
        expect(result.items).toHaveLength(1);
        expect(Object.keys(result.items[0]).sort()).toEqual(fields);
        observed.push(String(result.items[0].id));
        cursor = result.nextCursor;
        if (page === 0) expect(cursor).toBeTruthy();
      }
      expect(observed).toEqual(expectedIds);
      expect(cursor).toBeNull();
    }
    const sessionResponse = await fetch(
      `${origin}/api/account/client-activity`,
      {
        headers: { cookie },
      },
    );
    expect(sessionResponse.status).toBe(401);
    await sessionResponse.text();
  });
});
