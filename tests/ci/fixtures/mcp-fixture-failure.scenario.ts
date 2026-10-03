import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { withUserDbContext } from "@/lib/db/prisma";
import { isolatedMcpTest } from "../../integration/mcp/_harness/isolated-context";
import { createDeferred } from "../../shared/deferred";

const output = process.env.MCP_FIXTURE_PROBE_OUTPUT;
const phase = process.env.MCP_FIXTURE_PROBE_PHASE;
if (!output || !["setup", "body-teardown", "timeout"].includes(phase ?? ""))
  throw new Error("Missing native MCP fixture probe phase/output");
const directory = output;
function save(name: string, data: unknown) {
  writeFileSync(join(directory, name), JSON.stringify(data));
}

const test = isolatedMcpTest.extend(
  "probe",
  async ({
    mcpWorkflow,
    isolatedDatabase,
    _templateResources,
    mcpActor,
    mcpOtherActor,
    mcpSessions,
    signal,
  }) => {
    const setup = await mcpWorkflow.run(async () => {
      const todo = await isolatedDatabase.owner.todo.create({
        data: {
          userId: mcpActor.userId,
          title: "Committed native fixture state",
        },
        select: { id: true, userId: true, title: true },
      });
      save("resources.json", {
        ..._templateResources.state(),
        database: isolatedDatabase.name,
        todo,
      });
      if (phase === "setup") throw new Error("MCP-NATIVE-SETUP");
      if (phase === "body-teardown") {
        for (const [name, actor] of [
          ["first", mcpActor],
          ["second", mcpOtherActor],
        ] as const) {
          const close = actor.client.close;
          actor.client.close = async () => {
            await close();
            throw new Error(`MCP-NATIVE-CLOSE-${name}`);
          };
        }
      }
      let timeoutRequest: (() => Promise<void>) | undefined;
      if (phase === "timeout") {
        const release = createDeferred();
        const session = mcpSessions.own(mcpActor.userId);
        session.server.server.setRequestHandler(
          CallToolRequestSchema,
          async (_request, extra) => {
            extra.signal.addEventListener(
              "abort",
              () => {
                if (!signal.aborted)
                  release.reject(
                    new Error("MCP work aborted before native timeout"),
                  );
                else release.resolve();
              },
              { once: true },
            );
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
            save("timeout-work.json", {
              written,
              persisted,
              nativeAborted: signal.aborted,
              transportAborted: extra.signal.aborted,
            });
            return { content: [{ type: "text", text: '{"success":true}' }] };
          },
        );
        await session.initialize();
        timeoutRequest = async () => {
          const outcome = await session.client
            .call("native-timeout-write")
            .then(
              () => "fulfilled",
              () => "rejected",
            );
          save("timeout-client.json", { outcome });
        };
      }
      return { todo, timeoutRequest };
    });
    signal.throwIfAborted();
    return setup;
  },
);

test(
  "native MCP fixture failure releases all owned state",
  { timeout: phase === "timeout" ? 5_000 : 30_000 },
  async ({ mcpWorkflow, probe, isolatedDatabase, expect }) =>
    mcpWorkflow.run(async () => {
      expect(
        await isolatedDatabase.owner.todo.findUnique({
          where: { id: probe.todo.id },
        }),
      ).toMatchObject(probe.todo);
      if (phase === "body-teardown") throw new Error("MCP-NATIVE-BODY");
      if (!probe.timeoutRequest) throw new Error("Native timeout work missing");
      await probe.timeoutRequest();
    }),
);
