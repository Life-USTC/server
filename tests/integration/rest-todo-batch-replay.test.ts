import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { restStateTest } from "../shared/rest-state-contract-fixture";

restStateTest(
  "todo.batch-result-replay",
  { tags: ["@Todo/REST"] },
  async ({ rest: { db, origin, fetch }, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const owner = await db.user.create({
        data: { email: `${crypto.randomUUID()}@batch-replay.test` },
      });
      const other = await db.user.create({
        data: { email: `${crypto.randomUUID()}@batch-replay.test` },
      });
      const sessionToken = crypto.randomUUID();
      await db.session.create({
        data: {
          userId: owner.id,
          sessionToken,
          expires: new Date(Date.now() + 3_600_000),
        },
      });
      const context = await getBetterAuthInstance().$context;
      const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
      for (const surface of ["rest", "graphql"]) {
        const own = await db.todo.create({
          data: { userId: owner.id, title: `${surface} own` },
        });
        const foreign = await db.todo.create({
          data: { userId: other.id, title: `${surface} foreign` },
        });
        const missing = crypto.randomUUID();
        const ids = [foreign.id, own.id, missing];
        const call = async (action: "complete" | "delete") => {
          const items = ids.map((todoId) => ({ todoId, completed: true }));
          const response = await fetch(
            `${origin}${surface === "rest" ? "/api/workspace/todos/batch" : "/api/graphql"}`,
            {
              method:
                surface === "graphql"
                  ? "POST"
                  : action === "complete"
                    ? "PATCH"
                    : "DELETE",
              headers: {
                cookie,
                origin: "http://localhost:3000",
                "content-type": "application/json",
              },
              body: JSON.stringify(
                surface === "rest"
                  ? action === "complete"
                    ? { items }
                    : { ids }
                  : action === "complete"
                    ? {
                        query:
                          "mutation($items:[TodoCompletionBatchItemInput!]!){todoCompletionsSet(items:$items){results{todoId success error{code}}}}",
                        variables: { items },
                      }
                    : {
                        query:
                          "mutation($ids:[ID!]!){todosDelete(ids:$ids){results{id success error{code}}}}",
                        variables: { ids },
                      },
              ),
            },
          );
          expect(response.status, await response.clone().text()).toBe(200);
          const body = await response.json();
          expect(body.errors).toBeUndefined();
          const results =
            surface === "rest"
              ? body.results
              : body.data[
                  action === "complete" ? "todoCompletionsSet" : "todosDelete"
                ].results;
          return results.map(
            (row: {
              id?: string;
              todoId?: string;
              success: boolean;
              error?: { code: string } | null;
            }) => ({
              id: row.id ?? row.todoId,
              success: row.success,
              error: row.error?.code.toLowerCase() ?? null,
            }),
          );
        };
        const partial = ids.map((id) => ({
          id,
          success: id === own.id,
          error: id === own.id ? null : "not_found",
        }));
        expect(await call("complete")).toEqual(partial);
        const completed = await db.todo.findUniqueOrThrow({
          where: { id: own.id },
        });
        expect(completed.completed).toBe(true);
        expect(await call("complete")).toEqual(partial);
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: own.id } }),
        ).toMatchObject({ id: own.id, completed: true });
        expect(await call("delete")).toEqual(partial);
        expect(await db.todo.findUnique({ where: { id: own.id } })).toBeNull();
        expect(await call("delete")).toEqual(
          ids.map((id) => ({ id, success: false, error: "not_found" })),
        );
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
        ).toEqual(foreign);
      }
    });
  },
);
