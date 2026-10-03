import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { restStateTest } from "../shared/rest-state-contract-fixture";

restStateTest(
  "openapi.rate-limit-accuracy-boundary",
  async ({
    rest: { db, origin, fetch },
    protocolRuntime,
    rateLimit,
    rateLimit: { budgetCalls },
  }) => {
    await protocolRuntime.run(async () => {
      const user = await db.user.create({
        data: { email: `${crypto.randomUUID()}@limiter.test` },
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
      for (const mode of ["limited", "unavailable"] as const) {
        rateLimit.mode = mode;
        budgetCalls.length = 0;
        const denied = await fetch(`${origin}/api/workspace/todos`, {
          method: "POST",
          headers: { cookie, origin, "content-type": "application/json" },
          body: JSON.stringify({ title: "Do not persist this mutation" }),
        });
        expect(denied.status).toBe(mode === "limited" ? 429 : 503);
        expect(denied.headers.get("retry-after")).toBe("60");
        for (const name of denied.headers.keys())
          expect(name).not.toMatch(
            /(?:rate.?limit.*(?:remaining|reset|quota)|quota)/i,
          );
        expect(Object.keys(await denied.json())).toEqual(["error"]);
        expect(budgetCalls).toHaveLength(1);
        expect(await db.todo.count({ where: { userId: user.id } })).toBe(0);

        // HTTP POST does not imply a domain mutation: these utility reads and
        // browser preference cookies are independent of the authenticated budget.
        const section = await db.section.findFirstOrThrow({
          where: { semesterId: { not: null }, retiredAt: null },
        });
        const utilities = [
          {
            path: "/api/account/preferences",
            body: { locale: "en-us" },
            authenticated: false,
          },
          {
            path: "/api/catalog/sections/match-codes",
            body: { codes: [section.code], semesterId: section.semesterId },
            authenticated: false,
          },
          {
            path: "/api/workspace/subscriptions/query",
            body: { sectionIds: [section.id], semesterId: section.semesterId },
            authenticated: true,
          },
        ];
        for (const utility of utilities) {
          budgetCalls.length = 0;
          const response = await fetch(`${origin}${utility.path}`, {
            method: "POST",
            headers: {
              ...(utility.authenticated ? { cookie } : {}),
              origin,
              "content-type": "application/json",
            },
            body: JSON.stringify(utility.body),
          });
          const body = await response.text();
          expect(response.status, `${utility.path}: ${body}`).toBe(200);
          expect(budgetCalls).toEqual([]);
        }
        budgetCalls.length = 0;
        const session = await fetch(`${origin}/api/auth/get-session`, {
          headers: { cookie },
        });
        expect(session.status, await session.clone().text()).toBe(200);
        expect((await session.json()).user.id).toBe(user.id);
        expect(budgetCalls).toEqual([]);
      }
      const auth = await getBetterAuthInstance().$context;
      expect(auth.options.rateLimit?.enabled).not.toBe(false);
    });
  },
);
