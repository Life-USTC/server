import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { withUserDbContext } from "@/lib/db/prisma";
import { isolatedMcpTest } from "../../integration/mcp/_harness/isolated-context";
import { createDeferred } from "../../shared/deferred";
import {
  errorTree,
  type McpFixtureFailurePhase,
} from "./mcp-fixture-failure-reporter";

const output = process.env.MCP_FIXTURE_PROBE_OUTPUT;
const inputPhase = process.env.MCP_FIXTURE_PROBE_PHASE;
if (
  !output ||
  ![
    "setup",
    "teardown",
    "body",
    "body-teardown",
    "runtime",
    "timeout",
  ].includes(inputPhase ?? "")
)
  throw new Error("Missing native MCP fixture probe phase/output");
const phase = inputPhase as McpFixtureFailurePhase;
const probeOutput = output;
function record(event: string) {
  appendFileSync(
    join(probeOutput, "phases.jsonl"),
    JSON.stringify({ event, at: Date.now() }) + "\n",
  );
}
const test = isolatedMcpTest.extend(
  "probe",
  async ({
    mcpWorkflow,
    isolatedDatabase,
    _templateResources,
    _databaseResources,
    mcpActor,
    mcpOtherActor,
    mcpSessions,
    mcpRuntime,
    signal,
  }) => {
    const setupResult = await mcpWorkflow.run(async () => {
      const records = await isolatedDatabase.owner.$transaction(async (db) => {
        const todo = await db.todo.create({
          data: {
            userId: mcpActor.userId,
            title: "Committed native fixture state",
          },
        });
        const event = await db.featureOperationEvent.create({
          data: {
            id: crypto.randomUUID(),
            userId: mcpActor.userId,
            feature: "workspace.subscription",
            operation: "create",
            protocol: "mcp",
            surface: "mcp",
            authMode: "oauth",
            outcome: "success",
            errorClass: "none",
            durationMs: 1,
          },
        });
        return { todo, event };
      });
      const todo = await isolatedDatabase.owner.todo.findUniqueOrThrow({
        where: { id: records.todo.id },
      });
      const event =
        await isolatedDatabase.owner.featureOperationEvent.findUniqueOrThrow({
          where: { id: records.event.id },
        });
      writeFileSync(
        join(probeOutput, "resources.json"),
        JSON.stringify({
          ..._templateResources.state(),
          database: isolatedDatabase.name,
          userIds: [mcpActor.userId, mcpOtherActor.userId],
          todo: { id: todo.id, userId: todo.userId, title: todo.title },
          event: { id: event.id, userId: event.userId },
        }),
      );
      record("state-committed");
      for (const [name, actor] of [
        ["first", mcpActor],
        ["second", mcpOtherActor],
      ] as const) {
        const close = actor.client.close;
        actor.client.close = async () => {
          record(`${name}-close-start`);
          await close();
          record(`${name}-close-finished`);
          if (phase === "teardown" || phase === "body-teardown")
            throw new Error(`MCP-NATIVE-CLOSE-${name}`);
        };
      }
      const closeSessions = mcpSessions.close;
      mcpSessions.close = async () => {
        try {
          await closeSessions();
        } catch (error) {
          writeFileSync(
            join(probeOutput, "raw-close-error.json"),
            JSON.stringify({ at: Date.now(), error: errorTree(error) }),
          );
          throw error;
        }
      };
      const closeRuntime = mcpRuntime.close;
      mcpRuntime.close = async () => {
        record("runtime-close-start");
        await closeRuntime();
        record("runtime-close-finished");
        if (phase === "runtime") {
          const error = new Error("MCP-NATIVE-RUNTIME");
          writeFileSync(
            join(probeOutput, "raw-runtime-error.json"),
            JSON.stringify({ at: Date.now(), error: errorTree(error) }),
          );
          throw error;
        }
      };
      const disposeDatabase = _databaseResources.dispose;
      _databaseResources.dispose = async () => {
        record("database-dispose-start");
        await disposeDatabase();
        record("database-dispose-finished");
      };
      let timeoutRequest: (() => Promise<void>) | undefined;
      if (phase === "timeout") {
        const release = createDeferred();
        const session = mcpSessions.own(mcpActor.userId);
        signal.addEventListener("abort", () => record("native-test-aborted"), {
          once: true,
        });
        session.server.server.setRequestHandler(
          CallToolRequestSchema,
          async (_request, extra) => {
            extra.signal.addEventListener(
              "abort",
              () => {
                if (!signal.aborted) {
                  release.reject(
                    new Error("MCP work aborted before native timeout"),
                  );
                  return;
                }
                record("timeout-work-released");
                release.resolve();
              },
              { once: true },
            );
            record("timeout-work-entered");
            await release.promise;
            const written = await withUserDbContext(mcpActor.userId, (db) =>
              db.todo.create({
                data: {
                  userId: mcpActor.userId,
                  title: "MCP write drained after native timeout",
                },
                select: { id: true, userId: true, title: true },
              }),
            );
            const persisted =
              await isolatedDatabase.owner.todo.findUniqueOrThrow({
                where: { id: written.id },
                select: { id: true, userId: true, title: true },
              });
            writeFileSync(
              join(probeOutput, "timeout-work.json"),
              JSON.stringify({
                at: Date.now(),
                written,
                persisted,
                nativeAborted: signal.aborted,
                transportAborted: extra.signal.aborted,
              }),
            );
            record("timeout-write-finished");
            return { content: [{ type: "text", text: '{"success":true}' }] };
          },
        );
        await session.initialize();
        const close = session.client.close;
        session.client.close = async () => {
          record("timeout-session-close-start");
          await close();
          record("timeout-session-close-finished");
        };
        timeoutRequest = async () => {
          const outcome = await session.client
            .call("native-timeout-write")
            .then(
              () => "fulfilled",
              () => "rejected",
            );
          writeFileSync(
            join(probeOutput, "timeout-client.json"),
            JSON.stringify({ outcome, at: Date.now() }),
          );
          record("timeout-client-settled");
        };
      }
      if (phase === "setup") {
        record("setup-rejected");
        throw new Error("MCP-NATIVE-SETUP");
      }
      return { ...records, timeoutRequest };
    });
    signal.throwIfAborted();
    return setupResult;
  },
);

if (phase === "body") {
  test.beforeEach(async ({ mcpWorkflow, probe, expect }) =>
    mcpWorkflow.run(async () => {
      expect(probe.todo.userId).toBe("mcp-owner");
      record("before-each-acquired");
    }),
  );
}

test(
  "native MCP fixture failure releases all owned state",
  {
    timeout: phase === "timeout" ? 5_000 : 30_000,
  },
  async ({ mcpWorkflow, probe, isolatedDatabase, expect }) =>
    mcpWorkflow.run(async () => {
      if (phase === "setup")
        throw new Error("Native setup failure was bypassed");
      expect(
        await isolatedDatabase.owner.todo.findUnique({
          where: { id: probe.todo.id },
        }),
      ).toMatchObject({
        userId: probe.todo.userId,
        title: "Committed native fixture state",
      });
      expect(
        await isolatedDatabase.owner.featureOperationEvent.findUnique({
          where: { id: probe.event.id },
        }),
      ).toMatchObject({ userId: probe.todo.userId });
      if (phase === "body" || phase === "body-teardown") {
        record("body-rejected");
        throw new Error("MCP-NATIVE-BODY");
      }
      if (phase === "timeout") {
        record("body-entered");
        if (!probe.timeoutRequest)
          throw new Error("Native timeout work missing");
        await probe.timeoutRequest();
        return;
      }
      record("body-finished");
    }),
);
