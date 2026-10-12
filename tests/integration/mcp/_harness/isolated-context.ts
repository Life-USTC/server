import { setCloudflareCatalogInvalidator } from "@/lib/adapters/cloudflare-runtime";
import { isolatedDatabaseTest } from "../../../shared/isolated-database";
import { createNodeRuntime } from "../../../shared/node-runtime";
import { createPrivateMcpBus } from "./bus-fixture";
import {
  type McpHarness,
  ownAnonymousMcpHarness,
  ownMcpHarness,
} from "./client";
import { createPrivateMcpSchedules } from "./schedule-fixture";

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
  mcpWorkflow: Runtime;
  _mcpCatalogRevision: undefined;
  mcpRuntime: Runtime;
  mcpSessions: Sessions;
  mcpActor: PrivateMcpActor;
  mcpOtherActor: PrivateMcpActor;
  mcpSection: { id: number; jwId: number; code: string };
  mcpBus: Awaited<ReturnType<typeof createPrivateMcpBus>>;
  mcpSchedules: Awaited<ReturnType<typeof createPrivateMcpSchedules>>;
}>({
  mcpWorkflow: async ({ isolatedDatabase, onTestFinished }, use) => {
    void isolatedDatabase;
    const workflow = createNodeRuntime({});
    try {
      await use(workflow);
    } finally {
      try {
        await workflow.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  _mcpCatalogRevision: async (
    { isolatedDatabase, mcpWorkflow, signal },
    use,
  ) => {
    // Database-local IDs repeat across tests, while production L1 cache lives
    // for the process. Publish a private import revision before any SDK request.
    await mcpWorkflow.run(() =>
      isolatedDatabase.owner.staticImportState.create({
        data: {
          id: "global",
          snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
          snapshotGeneratedAt: new Date(),
          transformRevision: 6,
        },
      }),
    );
    signal.throwIfAborted();
    await use(undefined);
  },
  mcpRuntime: async (
    { isolatedDatabase, _mcpCatalogRevision, mcpWorkflow, onTestFinished },
    use,
  ) => {
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
    const requestRuntime: Runtime = {
      ...runtime,
      run: (work) =>
        runtime.run(() => {
          // Direct SDK requests have no Worker HTML cache. Its real purge
          // is covered by the Worker contracts, not this transport fixture.
          setCloudflareCatalogInvalidator(async () => {});
          return work();
        }),
    };
    try {
      await use(requestRuntime);
    } finally {
      // Sessions close before this fixture unwinds. Their cancellation can
      // release an admitted workflow which still needs this request runtime.
      // The workflow owner alone reports its cached cleanup error.
      await Promise.allSettled([mcpWorkflow.close()]);
      try {
        await requestRuntime.close();
      } catch (error) {
        // Keep dependency cleanup running; the case still fails with this exact error.
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  mcpSessions: async ({ mcpRuntime, mcpWorkflow, onTestFinished }, use) => {
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
      try {
        await sessions.close();
      } catch (error) {
        // Vitest 5 stops a fixture cleanup chain at the first rejection. Report
        // after the runtime and database fixtures have finished their own cleanup.
        onTestFinished(() => {
          throw error;
        });
      }
      // Close SDKs first: blocked server work may only resume on transport
      // cancellation. Manual sessions.close() deliberately does not self-join.
      await Promise.allSettled([mcpWorkflow.close()]);
    }
  },
  mcpActor: async (
    { isolatedDatabase, mcpSessions, mcpWorkflow, signal },
    use,
  ) => {
    const actor = await mcpWorkflow.run(async () => {
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
      return {
        userId: user.id,
        client: session.client,
        name,
        username,
      };
    });
    signal.throwIfAborted();
    await use(actor);
  },
  mcpOtherActor: async (
    { isolatedDatabase, mcpSessions, mcpWorkflow, signal },
    use,
  ) => {
    const actor = await mcpWorkflow.run(async () => {
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
      return {
        userId: user.id,
        client: session.client,
        name,
        username,
      };
    });
    signal.throwIfAborted();
    await use(actor);
  },
  mcpSection: async ({ isolatedDatabase, mcpWorkflow, signal }, use) => {
    const section = await mcpWorkflow.run(() =>
      isolatedDatabase.owner.$transaction(async (db) => {
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
      }),
    );
    signal.throwIfAborted();
    await use(section);
  },
  mcpBus: async ({ isolatedDatabase, mcpWorkflow, signal }, use) => {
    const bus = await mcpWorkflow.run(() =>
      createPrivateMcpBus(isolatedDatabase.owner),
    );
    signal.throwIfAborted();
    await use(bus);
  },
  mcpSchedules: async (
    { isolatedDatabase, mcpSection, mcpWorkflow, signal },
    use,
  ) => {
    const schedules = await mcpWorkflow.run(() =>
      createPrivateMcpSchedules(isolatedDatabase.owner, mcpSection.id),
    );
    signal.throwIfAborted();
    await use(schedules);
  },
});
