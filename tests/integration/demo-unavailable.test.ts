import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, expect, it } from "vitest";
import { authPostRoute } from "@/lib/api/routes/auth";
import { resolveApiPrincipal } from "@/lib/auth/api-auth";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import { createMcpServer } from "@/lib/mcp/server";
import { createFixturePrisma } from "../shared/prisma";

const fixtures = createFixturePrisma();
const userIds: string[] = [];
const origin = "http://localhost:3000";

afterAll(async () => {
  await fixtures.user.deleteMany({ where: { id: { in: userIds } } });
  await Promise.all([
    fixtures.$disconnect(),
    authPrisma.$disconnect(),
    runtimePrisma.$disconnect(),
  ]);
});

it("demo.planned-only", async () => {
  // Inspect executable registrations, not feature specifications.
  const auth = getBetterAuthInstance();
  expect(Object.keys(auth.api).filter((name) => /demo/i.test(name))).toEqual(
    [],
  );
  const openapi = JSON.parse(
    await readFile(
      new URL("../../public/openapi.generated.json", import.meta.url),
      "utf8",
    ),
  ) as { paths: Record<string, unknown> };
  expect(
    Object.keys(openapi.paths).filter((path) => /demo/i.test(path)),
  ).toEqual([]);
  expect(graphqlSchemaSdl).not.toMatch(/\bdemo\w*/i);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "demo-unavailable", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((tool) => /demo/i.test(tool.name))).toEqual([]);
  } finally {
    await client.close();
    await server.close();
  }
  const response = await authPostRoute(
    new Request(`${origin}/api/auth/demo`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
});

it("demo.no-live-writes", async () => {
  const [actor, victim] = await Promise.all(
    ["actor", "victim"].map(async (name) => {
      const user = await fixtures.user.create({
        data: {
          name: `[integration-test] Demo boundary ${name}`,
          email: `demo-boundary-${crypto.randomUUID()}@example.test`,
        },
      });
      userIds.push(user.id);
      return user;
    }),
  );
  const token = crypto.randomUUID();
  const session = await fixtures.session.create({
    data: {
      userId: actor.id,
      sessionToken: token,
      expires: new Date(Date.now() + 3_600_000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(token)),
  );
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${btoa(String.fromCharCode(...signature))}`)}`;
  for (const authenticated of [false, true]) {
    const principal = await resolveApiPrincipal(
      new Request(
        `${origin}/api/workspace/todos?demo=true&userId=${victim.id}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-demo-user-id": victim.id,
            "x-user-id": victim.id,
            cookie: `${authenticated ? `${cookie}; ` : ""}demo_user=${victim.id}; demo=true`,
          },
          body: JSON.stringify({
            demo: true,
            userId: victim.id,
            principal: { kind: "demo", userId: victim.id },
          }),
        },
      ),
      { bearerScope: { feature: "workspace.todo", action: "write" } },
    );
    expect(principal).toEqual(
      authenticated
        ? { kind: "session", userId: actor.id, sessionId: session.id }
        : null,
    );
  }
  expect(
    await fixtures.session.findUnique({
      where: { id: session.id },
      select: { userId: true },
    }),
  ).toEqual({ userId: actor.id });
  expect(await fixtures.session.count({ where: { userId: victim.id } })).toBe(
    0,
  );
});
