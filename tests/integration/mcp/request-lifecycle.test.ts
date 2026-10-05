import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { withUserDbContext } from "@/lib/db/prisma";
import { createDeferred } from "../../shared/deferred";
import { isolatedMcpTest } from "./_harness/isolated-context";

isolatedMcpTest(
  "MCP session disposal rejects acquisition after delayed actor creation",
  { tags: ["@MCP/MCP"] },
  async ({ mcpWorkflow, mcpSessions, isolatedDatabase, expect, signal }) =>
    mcpWorkflow.run(async () => {
      const created = createDeferred();
      const release = createDeferred();
      const cancelled = createDeferred<never>();
      void cancelled.promise.catch(() => undefined);
      const cancel = () => {
        release.resolve();
        cancelled.reject(signal.reason);
      };
      signal.throwIfAborted();
      signal.addEventListener("abort", cancel, { once: true });
      const lateActor = (async () => {
        const user = await isolatedDatabase.owner.user.create({
          data: { id: "late-mcp-user", email: "late-mcp@example.test" },
        });
        created.resolve();
        await release.promise;
        const session = mcpSessions.own(user.id);
        await session.initialize();
      })();
      void lateActor.catch(() => undefined);
      try {
        await Promise.race([created.promise, lateActor, cancelled.promise]);
        await mcpSessions.close();
        release.resolve();
        await expect(lateActor).rejects.toThrow("sessions are closed");
        expect(() => mcpSessions.ownAnonymous()).toThrow("sessions are closed");
      } finally {
        signal.removeEventListener("abort", cancel);
        release.resolve();
        await lateActor.catch(() => undefined);
      }
    }),
);

for (const authenticated of [true, false]) {
  isolatedMcpTest(
    `MCP ${authenticated ? "authenticated" : "anonymous"} close waits for the server's delayed database write`,
    { tags: ["@MCP/MCP"] },
    async ({ mcpWorkflow, mcpSessions, isolatedDatabase, expect, signal }) =>
      mcpWorkflow.run(async () => {
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
        // Observe a failed write before the close promise finishes draining it.
        void completed.promise.catch(() => undefined);
        const cancelled = createDeferred<never>();
        void cancelled.promise.catch(() => undefined);
        const cancel = () => {
          release.resolve();
          cancelled.reject(signal.reason);
        };
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
            try {
              await withUserDbContext(userId, (db) =>
                db.todo.create({
                  data: { userId, title: "write after disconnect" },
                }),
              );
              completed.resolve();
            } catch (error) {
              completed.reject(error);
              throw error;
            }
            return { content: [{ type: "text", text: '{"success":true}' }] };
          },
        );
        let closeFinished = false;
        let closing: Promise<void> | undefined;
        signal.throwIfAborted();
        signal.addEventListener("abort", cancel, { once: true });
        try {
          await session.initialize();
          const request = session.client.call("delayed-write");
          const requestResult = request.then(
            () => "fulfilled",
            () => "rejected",
          );
          await Promise.race([
            entered.promise,
            request.then(() => {
              throw new Error(
                "Request completed before the delayed handler entered",
              );
            }),
            cancelled.promise,
          ]);
          closing = session.client.close().then(() => {
            closeFinished = true;
          });
          await Promise.race([aborted.promise, closing, cancelled.promise]);
          expect(await requestResult).toBe("rejected");
          expect(closeFinished).toBe(false);
          expect(await isolatedDatabase.owner.todo.count()).toBe(0);
          release.resolve();
          await closing;
          await Promise.race([completed.promise, cancelled.promise]);
          expect(closeFinished).toBe(true);
          await expect(
            isolatedDatabase.owner.todo.findMany({
              select: { userId: true, title: true },
            }),
          ).resolves.toEqual([{ userId, title: "write after disconnect" }]);
          await expect(session.initialize()).rejects.toThrow("closed");
          await expect(session.client.listTools()).rejects.toThrow();
        } finally {
          signal.removeEventListener("abort", cancel);
          release.resolve();
          await closing;
          await session.client.close();
        }
      }),
  );
}
