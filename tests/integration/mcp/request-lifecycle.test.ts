import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { withUserDbContext } from "@/lib/db/prisma";
import { createDeferred } from "../../shared/deferred";
import { isolatedMcpTest } from "./_harness/isolated-context";

for (const authenticated of [true, false]) {
  isolatedMcpTest(
    `MCP ${authenticated ? "authenticated" : "anonymous"} close waits for the server's delayed database write`,
    async ({ mcpSessions, isolatedDatabase, expect }) => {
      const userId = "delayed-mcp-handler";
      await isolatedDatabase.owner.user.create({
        data: { id: userId, email: "delayed-mcp@example.test" },
      });
      const session = authenticated
        ? mcpSessions.own(userId)
        : mcpSessions.ownAnonymous();
      const entered = createDeferred();
      const aborted = createDeferred();
      const release = createDeferred();
      const completed = createDeferred();
      // A real SDK handler intentionally completes after its client disconnects.
      // Its database write proves that transport cancellation is not completion.
      session.server.server.setRequestHandler(
        CallToolRequestSchema,
        async (_request, extra) => {
          extra.signal.addEventListener("abort", () => aborted.resolve(), {
            once: true,
          });
          entered.resolve();
          await release.promise;
          await withUserDbContext(userId, (db) =>
            db.todo.create({
              data: { userId, title: "write after disconnect" },
            }),
          );
          completed.resolve();
          return { content: [{ type: "text", text: '{"success":true}' }] };
        },
      );
      await session.initialize();
      const request = session.client.call("delayed-write");
      const requestResult = request.then(
        () => "fulfilled",
        () => "rejected",
      );
      let closeFinished = false;
      let closing: Promise<void> | undefined;
      try {
        await entered.promise;
        closing = session.client.close().then(() => {
          closeFinished = true;
        });
        await aborted.promise;
        expect(await requestResult).toBe("rejected");
        expect(closeFinished).toBe(false);
        expect(await isolatedDatabase.owner.todo.count()).toBe(0);
        release.resolve();
        await closing;
        await completed.promise;
        expect(closeFinished).toBe(true);
        await expect(
          isolatedDatabase.owner.todo.findMany({
            select: { userId: true, title: true },
          }),
        ).resolves.toEqual([{ userId, title: "write after disconnect" }]);
        await expect(session.initialize()).rejects.toThrow("closed");
        await expect(session.client.listTools()).rejects.toThrow();
      } finally {
        release.resolve();
        await closing;
        await session.client.close();
      }
    },
  );
}
