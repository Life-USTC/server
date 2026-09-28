import { isolatedDatabaseTest } from "../../../shared/isolated-database";
import { createNodeRuntime } from "../../../shared/node-runtime";
import {
  type McpHarness,
  ownAnonymousMcpHarness,
  ownMcpHarness,
} from "./client";

type Runtime = ReturnType<typeof createNodeRuntime>;
type Sessions = {
  own(
    userId: string,
    scopes?: readonly string[],
  ): ReturnType<typeof ownMcpHarness>;
  ownAnonymous(): ReturnType<typeof ownAnonymousMcpHarness>;
  close(): Promise<void>;
};

export type PrivateMcpActor = {
  client: McpHarness;
  userId: string;
  name: string;
  username: string;
};

/** Explicit private state; each SDK server request owns its runtime lifetime. */
export const isolatedMcpTest = isolatedDatabaseTest.extend<{
  mcpRuntime: Runtime;
  mcpSessions: Sessions;
  mcpActor: PrivateMcpActor;
  mcpOtherActor: PrivateMcpActor;
  mcpSection: { id: number; jwId: number; code: string };
}>({
  mcpRuntime: async ({ isolatedDatabase }, use) => {
    const runtime = createNodeRuntime({
      APP_PUBLIC_ORIGIN: "https://life.example",
      APP_CANONICAL_ORIGIN: "https://life.example",
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      HYPERDRIVE_AUTH: { connectionString: isolatedDatabase.connections.auth },
      HYPERDRIVE_MAINTENANCE: {
        connectionString: isolatedDatabase.connections.maintenance,
      },
      // Direct SDK tests observe transport/domain semantics. Queue delivery
      // and limiter bindings are exercised by the real Worker contracts.
      CALENDAR_EXPORT_REBUILD: { send: async () => {} },
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    try {
      await use(runtime);
    } finally {
      await runtime.close();
    }
  },
  mcpSessions: async ({ mcpRuntime }, use) => {
    const clients: McpHarness[] = [];
    let closed = false;
    function requireOpen() {
      if (closed) throw new Error("Private MCP sessions are closed");
    }
    const sessions: Sessions = {
      own(userId, scopes) {
        requireOpen();
        const owned = ownMcpHarness(userId, scopes, mcpRuntime);
        clients.push(owned.client);
        return owned;
      },
      ownAnonymous() {
        requireOpen();
        const owned = ownAnonymousMcpHarness(mcpRuntime);
        clients.push(owned.client);
        return owned;
      },
      close: closeSessions,
    };
    async function closeSessions() {
      closed = true;
      const results = await Promise.allSettled(
        clients.map((client) => client.close()),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(
          failures,
          "Private MCP sessions failed to close",
        );
    }
    try {
      // Teardown is registered before dependents create/initialize clients.
      await use(sessions);
    } finally {
      await closeSessions();
    }
  },
  mcpActor: async ({ isolatedDatabase, mcpSessions }, use) => {
    const name = "MCP owner";
    const username = "mcp-owner";
    const user = await isolatedDatabase.owner.user.create({
      data: {
        id: "mcp-owner",
        email: "mcp-owner@example.test",
        name,
        username,
      },
    });
    const session = mcpSessions.own(user.id);
    await session.initialize();
    await use({
      userId: user.id,
      client: session.client,
      name,
      username,
    });
  },
  mcpOtherActor: async ({ isolatedDatabase, mcpSessions }, use) => {
    const name = "MCP other";
    const username = "mcp-other";
    const user = await isolatedDatabase.owner.user.create({
      data: {
        id: "mcp-other",
        email: "mcp-other@example.test",
        name,
        username,
      },
    });
    const session = mcpSessions.own(user.id);
    await session.initialize();
    await use({
      userId: user.id,
      client: session.client,
      name,
      username,
    });
  },
  mcpSection: async ({ isolatedDatabase }, use) => {
    const section = await isolatedDatabase.owner.$transaction(async (db) => {
      const semester = await db.semester.create({
        data: { jwId: 1, code: "mcp-semester", nameCn: "MCP 测试学期" },
      });
      const course = await db.course.create({
        data: { jwId: 1, code: "MCP", nameCn: "MCP 测试课程" },
      });
      return db.section.create({
        data: {
          jwId: 1,
          code: "MCP.01",
          courseId: course.id,
          semesterId: semester.id,
        },
        select: { id: true, jwId: true, code: true },
      });
    });
    await use(section);
  },
});
