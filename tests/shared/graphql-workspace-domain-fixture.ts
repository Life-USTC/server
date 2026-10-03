import {
  type McpHarness,
  ownMcpHarness,
} from "../integration/mcp/_harness/client";
import { isolatedGraphqlTest } from "./isolated-graphql-fixture";

type Result = {
  success: boolean;
  data: Record<string, unknown>;
  errors?: Array<{ extensions?: { code?: string } }>;
};

export const graphqlWorkspaceTest = isolatedGraphqlTest
  .extend(
    "mcpOwners",
    async ({ graphqlRuntime, onTestFinished }, { onCleanup }) => {
      const userId = "graphql-domain-owner";
      const otherId = "graphql-domain-other";
      const resources: ReturnType<typeof ownMcpHarness>[] = [];
      onCleanup(async () => {
        // Keep the SDK open until every admitted setup/body workflow finishes.
        // The enclosing protocol fixture reports its cached drain failure once.
        await Promise.allSettled([graphqlRuntime.drain()]);
        const results = await Promise.allSettled(
          resources.map((resource) => resource.client.close()),
        );
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length) {
          const error = new AggregateError(
            failures,
            "GraphQL MCP fixture cleanup failed",
          );
          onTestFinished(() => {
            throw error;
          });
        }
      });
      const owner = ownMcpHarness(userId, undefined, {
        run: graphqlRuntime.request,
      });
      resources.push(owner);
      const other = ownMcpHarness(otherId, undefined, {
        run: graphqlRuntime.request,
      });
      resources.push(other);
      return { userId, otherId, owner, other };
    },
  )
  .extend(
    "workspace",
    async ({ isolatedDatabase, graphqlRuntime, mcpOwners, task }) => {
      const workspace = await graphqlRuntime.run(async () => {
        const db = isolatedDatabase.owner;
        const { userId, otherId } = mcpOwners;
        const marker = crypto.randomUUID();
        const youngId = `graphql-event-${marker}`;
        const organizerId = `graphql-organizer-${marker}`;
        const homeworkIds = Array.from({ length: 4 }, () =>
          crypto.randomUUID(),
        );
        const now = new Date(Math.floor(Date.now() / 1000) * 1000);
        const future = new Date(now.getTime() + 30 * 60_000);
        const past = new Date(now.getTime() - 24 * 60 * 60_000);
        const semester = await db.semester.create({
          data: {
            jwId: 1,
            nameCn: "GraphQL workspace semester",
            code: "GRAPHQL-WORKSPACE",
          },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            nameCn: "GraphQL workspace course",
            code: "GRAPHQL-WORKSPACE",
          },
        });
        const section = await db.section.create({
          data: {
            jwId: 1,
            code: "GRAPHQL-WORKSPACE.01",
            courseId: course.id,
            semesterId: semester.id,
          },
        });
        await db.user.createMany({
          data: [userId, otherId].map((id) => ({
            id,
            email: `${id}@example.test`,
          })),
        });
        await db.youngOrganizer.create({
          data: {
            id: organizerId,
            name: "GraphQL organizer",
            normalizedName: organizerId,
          },
        });
        await db.youngEvent.create({
          data: {
            youngId,
            name: "[integration-test] GraphQL event",
            organizerId,
            rawJson: {},
            isActive: true,
            startAt: future,
            endAt: new Date(future.getTime() + 60 * 60_000),
            applyEndAt: future,
            location: "East",
          },
        });
        await db.homework.createMany({
          data: homeworkIds.map((id, index) => ({
            id,
            sectionId: section.id,
            createdById: userId,
            title: `[integration-test] GraphQL completion ${index}`,
            submissionDueAt: index === 0 ? past : index === 2 ? null : future,
          })),
        });
        await graphqlRuntime.request(() => mcpOwners.owner.initialize());
        await graphqlRuntime.request(() => mcpOwners.other.initialize());
        const owner = mcpOwners.owner.client;
        const other = mcpOwners.other.client;
        const run = (
          client: McpHarness,
          document: string,
          variables: Record<string, unknown> = {},
        ) =>
          graphqlRuntime.request(() =>
            client.call<Result>("graphql_operation_run", {
              document,
              variables,
              confirmed: true,
              locale: "en-us",
            }),
          );
        const registered = (
          client: McpHarness,
          operationId: string,
          variables: Record<string, unknown> = {},
        ) =>
          graphqlRuntime.request(() =>
            client.call<Result>("graphql_operation_run", {
              operationId,
              variables,
              confirmed: true,
              locale: "en-us",
            }),
          );

        return {
          db,
          marker,
          userId,
          otherId,
          youngId,
          organizerId,
          owner,
          other,
          section,
          homeworkIds,
          now,
          future,
          past,
          run,
          registered,
          graphqlRuntime,
        };
      });
      task.context.signal.throwIfAborted();
      return workspace;
    },
  );
