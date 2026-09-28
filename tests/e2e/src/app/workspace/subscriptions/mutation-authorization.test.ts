import { expect, test } from "@playwright/test";
import {
  createSubscriptionMutationFixture,
  expectSubscriptionRelations,
  openSubscriptionTransport,
  subscriptionGraphql,
} from "../../../../utils/subscription-mutations";

const mutationFields = [
  "subscriptionAdd",
  "subscriptionRemove",
  "subscriptionKindUpdate",
] as const;
const mutationQuery = (field: (typeof mutationFields)[number]) =>
  `mutation($jwId: Int!) { ${field}(jwId: $jwId${field === "subscriptionKindUpdate" ? ", kind: auditor" : ""}) { ${field === "subscriptionKindUpdate" ? "kind" : "subscribed"} } }`;

test("Anonymous subscription writes are rejected without changing any memberships", async ({
  request,
}) => {
  const fixture = await createSubscriptionMutationFixture();
  try {
    for (const method of ["patch", "delete"] as const) {
      const response = await request[method]("/api/workspace/subscriptions", {
        data: { sectionIds: [fixture.own.section.id] },
      });
      expect(response.status()).toBe(401);
      await expectSubscriptionRelations(fixture, fixture.initial);
    }
    const kind = await request.patch(
      `/api/workspace/subscriptions/${fixture.own.section.jwId}`,
      { data: { kind: "auditor" } },
    );
    expect(kind.status()).toBe(401);
    await expectSubscriptionRelations(fixture, fixture.initial);
    for (const field of mutationFields) {
      const { body } = await subscriptionGraphql(
        request,
        mutationQuery(field),
        { jwId: fixture.own.section.jwId },
      );
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].extensions.code).toBe("UNAUTHENTICATED");
      expect(body.data).toBeNull();
      await expectSubscriptionRelations(fixture, fixture.initial);
    }
    for (const action of ["add", "remove", "kind_update"]) {
      const response = await request.post("/api/mcp", {
        headers: { Accept: "application/json, text/event-stream" },
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: `workspace_subscription_${action}`,
            arguments: {
              jwId: fixture.own.section.jwId,
              ...(action === "kind_update" ? { kind: "auditor" } : {}),
            },
          },
        },
      });
      expect(response.status()).toBe(401);
      expect(response.headers()["www-authenticate"]).toContain("Bearer");
      await expectSubscriptionRelations(fixture, fixture.initial);
    }
  } finally {
    await fixture.cleanup();
  }
});

for (const transport of [
  "REST session",
  "REST bearer",
  "GraphQL session",
  "GraphQL bearer",
] as const) {
  test(`${transport}: owner injection into kind mutation is rejected without side effects`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const fixture = await createSubscriptionMutationFixture();
    let connection:
      | Awaited<ReturnType<typeof openSubscriptionTransport>>
      | undefined;
    try {
      connection = await openSubscriptionTransport(
        page,
        request,
        fixture.own.users[0].id,
        transport,
      );
      if (transport.startsWith("REST")) {
        const response = await connection.request.patch(
          `/api/workspace/subscriptions/${fixture.foreign.section.jwId}`,
          {
            headers: connection.headers,
            data: { kind: "auditor", userId: fixture.foreign.users[0].id },
          },
        );
        expect(response.status()).toBe(400);
      } else {
        const { response, body } = await subscriptionGraphql(
          connection.request,
          "mutation($jwId: Int!, $userId: String!) { subscriptionKindUpdate(jwId: $jwId, kind: auditor, userId: $userId) { kind } }",
          {
            jwId: fixture.foreign.section.jwId,
            userId: fixture.foreign.users[0].id,
          },
          connection.headers,
        );
        // The default JSON GraphQL response carries validation errors in a 200 envelope.
        expect(response.status()).toBe(200);
        expect(body.errors).toHaveLength(1);
        expect(body.errors[0].extensions.code).toBe(
          "GRAPHQL_VALIDATION_FAILED",
        );
        expect(body.errors[0].message).toContain('Unknown argument "userId"');
        expect(body.data).toBeUndefined();
      }
      await expectSubscriptionRelations(fixture, fixture.initial);
    } finally {
      await connection?.close();
      await fixture.cleanup();
    }
  });
}

for (const transport of [
  "REST bearer",
  "GraphQL bearer",
  "MCP bearer",
] as const) {
  test(`${transport}: read-only authorization cannot add, remove, or change kind`, async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const fixture = await createSubscriptionMutationFixture();
    let connection:
      | Awaited<ReturnType<typeof openSubscriptionTransport>>
      | undefined;
    try {
      connection = await openSubscriptionTransport(
        page,
        request,
        fixture.own.users[0].id,
        transport,
        "workspace.subscription:read",
      );
      if (transport === "REST bearer") {
        const read = await request.get("/api/workspace/subscriptions/current", {
          headers: connection.headers,
        });
        expect(read.status()).toBe(200);
        expect((await read.json()).subscription.userId).toBe(
          fixture.own.users[0].id,
        );
        for (const action of ["add", "remove", "kind"]) {
          const target =
            action === "kind"
              ? `/api/workspace/subscriptions/${fixture.own.section.jwId}`
              : "/api/workspace/subscriptions";
          const response = await request[
            action === "remove" ? "delete" : "patch"
          ](target, {
            headers: connection.headers,
            data:
              action === "kind"
                ? { kind: "auditor" }
                : {
                    sectionIds: [
                      action === "add"
                        ? fixture.foreign.section.id
                        : fixture.own.section.id,
                    ],
                  },
          });
          // REST deliberately represents unusable bearer scopes as unauthorized.
          expect(response.status()).toBe(401);
          await expectSubscriptionRelations(fixture, fixture.initial);
        }
      } else if (transport === "GraphQL bearer") {
        const read = await subscriptionGraphql(
          request,
          "{ workspace { subscribedSections { items { section { id } } } } }",
          {},
          connection.headers,
        );
        expect(read.body.errors).toBeUndefined();
        expect(read.body.data.workspace.subscribedSections.items).toEqual([
          { section: { id: fixture.own.section.id } },
        ]);
        for (const field of mutationFields) {
          const { body } = await subscriptionGraphql(
            request,
            mutationQuery(field),
            {
              jwId:
                field === "subscriptionAdd"
                  ? fixture.foreign.section.jwId
                  : fixture.own.section.jwId,
            },
            connection.headers,
          );
          expect(body.errors).toHaveLength(1);
          expect(body.errors[0].extensions).toMatchObject({
            code: "FORBIDDEN",
            requiredScopes: ["workspace.subscription:write"],
          });
          expect(body.data).toBeNull();
          await expectSubscriptionRelations(fixture, fixture.initial);
        }
      } else {
        const client = connection.client;
        if (!client) throw new Error("MCP connection is required");
        const read = await client.callTool({
          name: "workspace_subscription_list",
          arguments: {},
        });
        expect(read.isError).not.toBe(true);
        for (const action of ["add", "remove", "kind_update"]) {
          const response = await request.post("/api/mcp", {
            headers: {
              ...connection.headers,
              Accept: "application/json, text/event-stream",
              "MCP-Protocol-Version": "2025-03-26",
            },
            data: {
              jsonrpc: "2.0",
              id: 1,
              method: "tools/call",
              params: {
                name: `workspace_subscription_${action}`,
                arguments: {
                  jwId:
                    action === "add"
                      ? fixture.foreign.section.jwId
                      : fixture.own.section.jwId,
                  ...(action === "kind_update" ? { kind: "auditor" } : {}),
                },
              },
            },
          });
          expect(response.status()).toBe(403);
          expect(response.headers()["www-authenticate"]).toContain(
            'error="insufficient_scope"',
          );
          expect(response.headers()["www-authenticate"]).toContain(
            "workspace.subscription:write",
          );
          expect(await response.json()).toEqual({
            error: "insufficient_scope",
          });
          await expectSubscriptionRelations(fixture, fixture.initial);
        }
      }
    } finally {
      await connection?.close();
      await fixture.cleanup();
    }
  });
}
