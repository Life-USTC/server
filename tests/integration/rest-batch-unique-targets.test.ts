import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { restStateTest } from "../shared/rest-state-contract-fixture";

restStateTest(
  "openapi.rest-batch-unique-targets",
  async ({ rest: { db, origin, fetch }, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const user = await db.user.create({
        data: { email: `${crypto.randomUUID()}@batch.test` },
      });
      const token = crypto.randomUUID();
      await db.session.create({
        data: {
          userId: user.id,
          sessionToken: token,
          expires: new Date(Date.now() + 3600_000),
        },
      });
      const context = await getBetterAuthInstance().$context;
      const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
      const todo = await db.todo.create({
        data: {
          userId: user.id,
          title: "batch target remains unchanged",
          completed: false,
        },
      });
      const contracts = [
        {
          path: "/api/workspace/todos/batch",
          method: "PATCH",
          body: (ids: string[]) => ({
            items: ids.map((todoId, index) => ({
              todoId,
              completed: index === 0,
            })),
          }),
        },
        {
          path: "/api/workspace/todos/batch",
          method: "DELETE",
          body: (ids: string[]) => ({ ids }),
        },
        {
          path: "/api/workspace/homeworks/completions",
          method: "PUT",
          body: (ids: string[]) => ({
            items: ids.map((homeworkId, index) => ({
              homeworkId,
              completed: index === 0,
            })),
          }),
        },
        {
          path: "/api/community/comments/batch",
          method: "DELETE",
          body: (ids: string[]) => ({ ids }),
        },
      ];
      for (const contract of contracts) {
        for (const ids of [
          [todo.id, todo.id],
          [todo.id, ` ${todo.id} `],
        ]) {
          const response = await fetch(`${origin}${contract.path}`, {
            method: contract.method,
            headers: { cookie, origin, "content-type": "application/json" },
            body: JSON.stringify(contract.body(ids)),
          });
          expect(response.status, `${contract.method} ${contract.path}`).toBe(
            400,
          );
          expect(await response.json()).toEqual({
            error: contract.path.includes("homeworks")
              ? "Invalid completion batch payload"
              : "Invalid batch payload",
          });
          expect(
            await db.todo.findUniqueOrThrow({ where: { id: todo.id } }),
          ).toEqual(todo);
        }
        // Distinct targets pass validation and return actual per-item domain outcomes.
        const response = await fetch(`${origin}${contract.path}`, {
          method: contract.method,
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify(
            contract.body([crypto.randomUUID(), crypto.randomUUID()]),
          ),
        });
        expect(response.status).toBe(200);
        const payload = (await response.json()) as {
          results: Array<{ success: boolean }>;
        };
        expect(payload.results).toHaveLength(2);
        expect(payload.results.every((item) => item.success === false)).toBe(
          true,
        );
      }
    });
  },
);
