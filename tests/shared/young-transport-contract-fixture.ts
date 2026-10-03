import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  getPersonalCalendarRoute,
  getYoungOrganizerStateRoute,
  getYoungSubscriptionStateRoute,
  getYoungWorkspaceRoute,
  postYoungNotificationReadRoute,
  putYoungSubscriptionRoute,
} from "@/lib/api/routes/young-workspace-routes";
import { createGraphqlYoga } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/mcp/urls";
import type { McpHarness } from "../integration/mcp/_harness/client";
import { mcpProtocolTest, ownProtocolRoute } from "./mcp-protocol-fixture";

// Each native case owns its provider process, database and SDK sessions.
export const youngTransportTest = mcpProtocolTest.extend(
  "state",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime, mcpSessions }) => {
    const users = [crypto.randomUUID(), crypto.randomUUID()];
    const clientId = `young-contract-${crypto.randomUUID()}`;
    const scopes = [
      "workspace.young-subscription:read",
      "workspace.young-subscription:write",
      "workspace.young-notification:read",
      "workspace.young-notification:write",
      "workspace.calendar:read",
    ];
    const grants: string[] = [];
    const youngIds = Array.from(
      { length: 4 },
      () => `transport-${crypto.randomUUID()}`,
    );
    const organizers = [crypto.randomUUID(), crypto.randomUUID()];
    const notifications = [crypto.randomUUID(), crypto.randomUUID()];
    const clients: McpHarness[] = [];
    const day = "2027-01-15";
    const homeworkId = crypto.randomUUID();
    const todoId = crypto.randomUUID();
    const expectedOwned = (index: number) =>
      index === 0 ? youngIds.slice(0, 3) : youngIds.slice(3);
    async function request(
      index: number,
      path: string,
      method = "GET",
      body?: unknown,
      audience = getOAuthRestAudienceUrls()[0],
    ) {
      return protocolRuntime.request(async () => {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          userId: users[index],
          grantId: grants[index],
          scopes,
          resources: [audience],
          issuedAt,
          expiresAt: issuedAt + 300,
        });
        if (!token) throw new Error("Expected signed resource token");
        return new Request(`https://example.test${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      });
    }
    async function graphql(
      index: number,
      query: string,
      variables: Record<string, unknown> = {},
    ) {
      return protocolRuntime.request(async () => {
        const response = await createGraphqlYoga(false).fetch(
          await request(
            index,
            "/api/graphql",
            "POST",
            { query, variables },
            getOAuthGraphqlResourceUrl(),
          ),
          { locals: { locale: "zh-cn" } },
        );
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        return body.data;
      });
    }

    const initialized = await protocolRuntime.run(async () => {
      const academic = await db.$transaction(async (tx) => {
        // Private revision prevents process-local catalog caches reusing row IDs.
        await tx.staticImportState.create({
          data: {
            id: "global",
            snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
            snapshotGeneratedAt: new Date(),
            transformRevision: 6,
          },
        });
        await tx.user.createMany({
          data: users.map((id) => ({
            id,
            name: "Young transport reader",
            email: `${id}@test.invalid`,
          })),
        });
        await tx.oAuthClient.create({
          data: {
            clientId,
            name: "Young transport",
            scopes,
            redirectUris: ["https://client.example/callback"],
          },
        });
        for (const userId of users) {
          grants.push(
            (
              await tx.oAuthConsent.create({
                data: { clientId, userId, scopes },
              })
            ).grantId,
          );
        }
        await tx.youngOrganizer.createMany({
          data: organizers.map((id) => ({ id, name: id, normalizedName: id })),
        });
        for (const [index, youngId] of youngIds.entries()) {
          await tx.youngEvent.create({
            data: {
              youngId,
              organizerId: organizers[index === 3 ? 1 : 0],
              name: `Activity ${index}`,
              isActive: true,
              rawJson: {},
              startAt: new Date(`${day}T${15 + index}:00:00+08:00`),
              endAt: new Date(`${day}T${15 + index}:30:00+08:00`),
            },
          });
          await tx.userYoungEventSubscription.create({
            data: {
              userId: users[index === 3 ? 1 : 0],
              youngId,
              remindSignup: false,
              remindDeadline: false,
              remindStart: false,
              observedState: JSON.stringify([
                `Activity ${index}`,
                null,
                null,
                null,
                false,
                new Date(`${day}T${15 + index}:00:00+08:00`),
                new Date(`${day}T${15 + index}:30:00+08:00`),
                null,
                null,
              ]),
            },
          });
        }
        for (let i = 0; i < 2; i++) {
          await tx.userYoungOrganizerSubscription.create({
            data: { userId: users[i], organizerId: organizers[i] },
          });
          await tx.youngNotification.create({
            data: {
              id: notifications[i],
              userId: users[i],
              youngId: youngIds[i === 0 ? 0 : 3],
              kind: "event_changed",
              title: `Private notice ${i}`,
              body: "Owner context",
              dedupeKey: notifications[i],
            },
          });
        }
        const source = await tx.course.create({
          data: {
            jwId: 1,
            code: "YOUNGTRANSPORT",
            nameCn: "Young transport course",
          },
        });
        const marker = 1;
        const sectionId = (
          await tx.section.create({
            data: {
              courseId: source.id,
              jwId: marker,
              code: `TRANSPORT.${marker}`,
            },
          })
        ).id;
        const groupId = (
          await tx.scheduleGroup.create({
            data: {
              jwId: marker,
              sectionId,
              no: 1,
              isDefault: true,
              stdCount: 0,
              limitCount: 0,
              actualPeriods: 2,
            },
          })
        ).id;
        await tx.schedule.create({
          data: {
            sectionId,
            scheduleGroupId: groupId,
            date: new Date(`${day}T00:00:00Z`),
            weekday: 5,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            startTime: 800,
            endTime: 925,
            periods: 2,
          },
        });
        await tx.exam.create({
          data: {
            sectionId,
            jwId: marker,
            examDate: new Date(`${day}T00:00:00Z`),
            startTime: 1000,
            endTime: 1100,
          },
        });
        await tx.homework.create({
          data: {
            id: homeworkId,
            sectionId,
            title: "Homework deadline",
            submissionDueAt: new Date(`${day}T12:00:00+08:00`),
          },
        });
        await tx.todo.create({
          data: {
            id: todoId,
            userId: users[0],
            title: "Todo deadline",
            dueAt: new Date(`${day}T13:00:00+08:00`),
          },
        });
        await tx.userSectionSubscription.create({
          data: { userId: users[0], sectionId },
        });

        return { sectionId, groupId };
      });
      for (const userId of users)
        clients.push(await mcpSessions.createMcpHarness(userId));
      const anonymous = await mcpSessions.createAnonymousMcpHarness();
      return { ...academic, anonymous };
    });
    return {
      db,
      routes: {
        getPersonalCalendarRoute: ownProtocolRoute(
          protocolRuntime,
          getPersonalCalendarRoute,
        ),
        getYoungOrganizerStateRoute: ownProtocolRoute(
          protocolRuntime,
          getYoungOrganizerStateRoute,
        ),
        getYoungSubscriptionStateRoute: ownProtocolRoute(
          protocolRuntime,
          getYoungSubscriptionStateRoute,
        ),
        getYoungWorkspaceRoute: ownProtocolRoute(
          protocolRuntime,
          getYoungWorkspaceRoute,
        ),
        postYoungNotificationReadRoute: ownProtocolRoute(
          protocolRuntime,
          postYoungNotificationReadRoute,
        ),
        putYoungSubscriptionRoute: ownProtocolRoute(
          protocolRuntime,
          putYoungSubscriptionRoute,
        ),
      },
      users,
      clientId,
      scopes,
      grants,
      youngIds,
      organizers,
      notifications,
      clients,
      ...initialized,
      day,
      homeworkId,
      todoId,
      expectedOwned,
      request,
      graphql,
    };
  },
);
