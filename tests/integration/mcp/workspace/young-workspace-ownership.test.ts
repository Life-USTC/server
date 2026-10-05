import { createGraphqlYoga } from "@/lib/graphql/server";
import { youngTransportTest as contractTest } from "../../../shared/young-transport-contract-fixture";

for (const method of ["REST", "GraphQL", "MCP"] as const) {
  contractTest(
    `young-workspace.ownership (${method})`,
    { tags: [`@Young/${method}`] },
    async ({ state, expect, protocolRuntime }) => {
      await protocolRuntime.run(async () => {
        const {
          db,
          routes: {
            getYoungWorkspaceRoute,
            putYoungSubscriptionRoute,
            postYoungNotificationReadRoute,
          },
        } = state;

        const {
          users,
          youngIds,
          organizers,
          notifications,
          clients,
          anonymous,
          expectedOwned,
          request,
          graphql,
        } = state;

        for (const index of [0, 1]) {
          const foreign = 1 - index;
          const expected = expectedOwned(index).sort();
          if (method === "REST") {
            const rest = await getYoungWorkspaceRoute(
              await request(
                index,
                `/api/workspace/young-event-subscriptions?userId=${users[foreign]}`,
              ),
              "events",
            );
            expect(rest.status).toBe(200);
            expect(
              (await rest.json()).data
                .map((row: { youngId: string }) => row.youngId)
                .sort(),
            ).toEqual(expected);
          }
          if (method === "GraphQL") {
            const gql = await graphql(
              index,
              `{ workspace { youngEventSubscriptions { items { youngId } } youngOrganizerSubscriptions { items { organizerId } } youngNotifications { items { id } } } }`,
            );
            expect(
              gql.workspace.youngEventSubscriptions.items
                .map((row: { youngId: string }) => row.youngId)
                .sort(),
            ).toEqual(expected);
            expect(
              gql.workspace.youngOrganizerSubscriptions.items.map(
                (row: { organizerId: string }) => row.organizerId,
              ),
            ).toEqual([organizers[index]]);
            expect(
              gql.workspace.youngNotifications.items.map(
                (row: { id: string }) => row.id,
              ),
            ).toEqual([notifications[index]]);
          }
          if (method === "MCP") {
            const mcp = await clients[index].call<{
              data: { youngId: string }[];
            }>("workspace_young_event_subscription_list", { mode: "full" });
            expect(mcp.data.map((row) => row.youngId).sort()).toEqual(expected);
          }
          for (const [kind, tool, field, ownedId] of [
            [
              "organizers",
              "workspace_young_organizer_subscription_list",
              "organizerId",
              organizers[index],
            ],
            [
              "notifications",
              "workspace_young_notification_list",
              "id",
              notifications[index],
            ],
          ] as const) {
            if (method === "REST") {
              const response = await getYoungWorkspaceRoute(
                await request(
                  index,
                  `/api/workspace/young-${kind}?userId=${users[foreign]}`,
                ),
                kind,
              );
              expect(response.status).toBe(200);
              expect(
                (await response.json()).data.map(
                  (row: Record<string, string>) => row[field],
                ),
              ).toEqual([ownedId]);
            }
            if (method === "MCP") {
              const result = await clients[index].call<{
                data: Record<string, string>[];
              }>(tool, { mode: "full" });
              expect(result.data.map((row) => row[field])).toEqual([ownedId]);
            }
          }
          const organizerTarget = organizers[foreign];
          if (method === "REST") {
            const organizerMutation = await putYoungSubscriptionRoute(
              await request(
                index,
                "/api/workspace/young-organizer-subscriptions/target",
                "PUT",
                { subscribed: false },
              ),
              organizerTarget,
              "organizers",
            );
            expect(organizerMutation.status).toBe(200);
            expect((await organizerMutation.json()).subscribed).toBe(false);
          }
          if (method === "GraphQL") {
            expect(
              (
                await graphql(
                  index,
                  `mutation($id: ID!) { youngOrganizerSubscriptionSet(organizerId: $id, subscribed: false) { subscribed } }`,
                  { id: organizerTarget },
                )
              ).youngOrganizerSubscriptionSet.subscribed,
            ).toBe(false);
          }
          if (method === "MCP") {
            expect(
              await clients[index].call(
                "workspace_young_organizer_subscription_set",
                {
                  organizerId: organizerTarget,
                  subscribed: false,
                },
              ),
            ).toMatchObject({ subscribed: false });
          }
          expect(
            await db.userYoungOrganizerSubscription.findUnique({
              where: {
                userId_organizerId: {
                  userId: users[foreign],
                  organizerId: organizerTarget,
                },
              },
            }),
          ).not.toBeNull();
          const target = youngIds[index === 0 ? 3 : 0];
          if (method === "REST") {
            const injected = await putYoungSubscriptionRoute(
              await request(
                index,
                "/api/workspace/young-event-subscriptions/target",
                "PUT",
                { subscribed: false, userId: users[foreign] },
              ),
              target,
              "events",
            );
            expect(injected.status).toBe(400);
            const normal = await putYoungSubscriptionRoute(
              await request(
                index,
                "/api/workspace/young-event-subscriptions/target",
                "PUT",
                { subscribed: false },
              ),
              target,
              "events",
            );
            expect(normal.status).toBe(200);
            expect((await normal.json()).subscribed).toBe(false);
          }
          if (method === "GraphQL") {
            expect(
              (
                await graphql(
                  index,
                  `mutation($id: String!) { youngEventSubscriptionSet(youngId: $id, input: {subscribed: false}) { subscribed } }`,
                  { id: target },
                )
              ).youngEventSubscriptionSet.subscribed,
            ).toBe(false);
          }
          if (method === "MCP") {
            expect(
              await clients[index].call(
                "workspace_young_event_subscription_set",
                {
                  youngId: target,
                  subscribed: false,
                },
              ),
            ).toMatchObject({ subscribed: false });
          }
          expect(
            await db.userYoungEventSubscription.findUnique({
              where: {
                userId_youngId: { userId: users[foreign], youngId: target },
              },
            }),
          ).not.toBeNull();
          if (method === "REST") {
            const read = await postYoungNotificationReadRoute(
              await request(
                index,
                "/api/workspace/young-notifications/read",
                "POST",
              ),
              notifications[foreign],
            );
            expect(read.status).toBe(404);
          }
          if (method === "GraphQL") {
            expect(
              (
                await graphql(
                  index,
                  `mutation($id: ID!) { youngNotificationRead(id: $id) { success } }`,
                  { id: notifications[foreign] },
                )
              ).youngNotificationRead.success,
            ).toBe(false);
          }
          if (method === "MCP") {
            expect(
              await clients[index].call("workspace_young_notification_read", {
                id: notifications[foreign],
              }),
            ).toMatchObject({ success: false });
          }
          expect(
            (
              await db.youngNotification.findUniqueOrThrow({
                where: { id: notifications[foreign] },
              })
            ).readAt,
          ).toBeNull();
        }
        if (method === "REST") {
          expect(
            (
              await getYoungWorkspaceRoute(
                new Request(
                  "https://example.test/api/workspace/young-event-subscriptions",
                ),
                "events",
              )
            ).status,
          ).toBe(401);
          expect(
            (
              await putYoungSubscriptionRoute(
                new Request(
                  "https://example.test/api/workspace/young-event-subscriptions/target",
                  {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ subscribed: false }),
                  },
                ),
                youngIds[0],
                "events",
              )
            ).status,
          ).toBe(401);
        }
        if (method === "GraphQL") {
          const anonymousGraphql = await protocolRuntime.request(() =>
            createGraphqlYoga(false).fetch(
              new Request("https://example.test/api/graphql", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  query:
                    "{ workspace { youngEventSubscriptions { items { youngId } } } }",
                }),
              }),
              { locals: { locale: "zh-cn" } },
            ),
          );
          const rejected = await anonymousGraphql.json();
          expect(rejected.data).toEqual({ workspace: null });
        }
        if (method === "MCP") {
          await expect(
            anonymous.call("workspace_young_event_subscription_list", {}),
          ).rejects.toThrow();
        }
      });
    },
  );
}
