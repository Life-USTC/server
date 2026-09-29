import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { restStateTest } from "../shared/rest-state-contract-fixture";

restStateTest(
  "openapi.session-and-bearer",
  async ({ rest: { db, origin, fetch }, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const users: string[] = [];
      const clientId = `rest-principal-${crypto.randomUUID()}`;
      const scopes = [
        "workspace.todo:read",
        "workspace.todo:write",
        "account.client-activity:read",
      ];
      await db.oAuthClient.create({
        data: {
          clientId,
          name: "Principal contract",
          scopes,
          redirectUris: ["https://client.example/callback"],
        },
      });
      async function owner(isAdmin = false) {
        const user = await db.user.create({
          data: {
            isAdmin,
            email: `${crypto.randomUUID()}@rest-principal.test`,
          },
        });
        users.push(user.id);
        const todo = await db.todo.create({
          data: { userId: user.id, title: `Private ${user.id}` },
        });
        const sessionToken = crypto.randomUUID();
        await db.session.create({
          data: {
            userId: user.id,
            sessionToken,
            expires: new Date(Date.now() + 3600_000),
          },
        });
        const context = await getBetterAuthInstance().$context;
        const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
        const consent = await db.oAuthConsent.create({
          data: { userId: user.id, clientId, scopes },
        });
        return { user, todo, cookie, consent };
      }
      const alice = await owner();
      const bob = await owner();
      const admin = await owner(true);
      async function bearer(
        actor: typeof alice,
        overrides: Partial<
          Parameters<typeof signResourceBoundOAuthAccessToken>[0]
        > = {},
      ) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          userId: actor.user.id,
          grantId: actor.consent.grantId,
          scopes,
          resources: getOAuthRestAudienceUrls(),
          issuedAt,
          expiresAt: issuedAt + 300,
          ...overrides,
        });
        if (!token) throw new Error("Expected signed access token");
        return `Bearer ${token}`;
      }
      const aliceBearer = await bearer(alice);
      const bobBearer = await bearer(bob);
      const adminBearer = await bearer(admin);
      for (const [headers, expected] of [
        [{ cookie: alice.cookie }, alice],
        [{ authorization: aliceBearer }, alice],
        [{ cookie: alice.cookie, authorization: bobBearer }, bob],
        [{ cookie: admin.cookie }, admin],
      ] as const) {
        const response = await fetch(`${origin}/api/workspace/todos`, {
          headers,
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.todos.map((row: { id: string }) => row.id)).toEqual([
          expected.todo.id,
        ]);
      }
      const invalidHeaders: Record<string, string>[] = [
        {},
        { authorization: "Bearer malformed" },
        { authorization: "Bearer malformed", cookie: alice.cookie },
        {
          authorization: await bearer(alice, {
            scopes: ["account.client-activity:read"],
          }),
        },
        {
          authorization: await bearer(alice, {
            resources: ["http://localhost:3000/api/mcp"],
          }),
        },
        {
          authorization: await bearer(alice, {
            resources: ["http://localhost:3000/api/graphql"],
          }),
        },
        {
          authorization: await bearer(alice, {
            expiresAt: Math.floor(Date.now() / 1000) - 120,
          }),
        },
        {
          authorization: await bearer(alice, { grantId: crypto.randomUUID() }),
        },
      ];
      for (const headers of invalidHeaders) {
        const response = await fetch(`${origin}/api/workspace/todos`, {
          headers,
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "Unauthorized" });
      }
      const patch = (id: string, headers: Record<string, string>) =>
        fetch(`${origin}/api/workspace/todos/${id}`, {
          method: "PATCH",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
      for (const headers of [
        { cookie: alice.cookie },
        { authorization: aliceBearer },
      ] as Record<string, string>[]) {
        const response = await patch(alice.todo.id, headers);
        expect(response.status).toBe(200);
        await response.text();
      }
      for (const headers of [
        { cookie: bob.cookie },
        { authorization: bobBearer },
        { cookie: admin.cookie },
        { authorization: adminBearer },
      ] as Record<string, string>[]) {
        const response = await patch(alice.todo.id, headers);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: "Not found" });
      }
      const readOnly = await patch(alice.todo.id, {
        authorization: await bearer(alice, { scopes: ["workspace.todo:read"] }),
      });
      expect(readOnly.status).toBe(401);
      await readOnly.text();
      for (const [headers, status] of [
        [{ cookie: admin.cookie }, 200],
        [{ cookie: alice.cookie }, 401],
        [{ authorization: adminBearer }, 401],
        [{ authorization: adminBearer, cookie: admin.cookie }, 401],
      ] as const) {
        const response = await fetch(`${origin}/api/admin/users?pageSize=1`, {
          headers,
        });
        expect(response.status).toBe(status);
        await response.text();
      }
      for (const [headers, status] of [
        [{ cookie: alice.cookie }, 401],
        [{ authorization: aliceBearer }, 200],
      ] as const) {
        const response = await fetch(`${origin}/api/account/client-activity`, {
          headers,
        });
        expect(response.status).toBe(status);
        await response.text();
      }
      for (const headers of [
        { cookie: alice.cookie },
        { authorization: aliceBearer },
      ] as Record<string, string>[]) {
        const response = await fetch(
          `${origin}/api/ingestion/publications/batches`,
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: "{}",
          },
        );
        expect(response.status).toBe(401);
        await response.text();
      }
      const sensitive = await fetch(
        `${origin}/api/auth/passkey/update-passkey`,
        {
          method: "POST",
          headers: {
            authorization: aliceBearer,
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            id: "missing-credential",
            name: "Cannot authorize with bearer",
          }),
        },
      );
      expect(sensitive.status).toBe(401);
      await sensitive.text();
      await db.oAuthConsent.delete({ where: { id: alice.consent.id } });
      const revoked = await fetch(`${origin}/api/workspace/todos`, {
        headers: { authorization: aliceBearer, cookie: alice.cookie },
      });
      expect(revoked.status).toBe(401);
      await revoked.text();
      const unchanged = await db.todo.findUniqueOrThrow({
        where: { id: alice.todo.id },
      });
      expect(unchanged).toMatchObject({
        userId: alice.user.id,
        title: alice.todo.title,
        completed: true,
      });
    });
  },
);
