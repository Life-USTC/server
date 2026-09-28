import { createServer, type Server } from "node:http";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const modules = {
  ...import.meta.glob<Record<string, RequestHandler>>(
    "../../src/routes/.well-known/**/+server.ts",
  ),
  ...import.meta.glob<Record<string, RequestHandler>>(
    "../../src/routes/api/**/.well-known/**/+server.ts",
  ),
};
const routes = new Map(
  Object.entries(modules).map(([file, load]) => [
    file.replace("../../src/routes", "").replace("/+server.ts", ""),
    load,
  ]),
);
const metadataPaths = [
  "/.well-known/oauth-authorization-server/api/auth",
  "/api/auth/.well-known/openid-configuration",
  "/.well-known/openid-configuration/api/auth",
  "/.well-known/oauth-protected-resource/api/mcp",
  "/.well-known/oauth-protected-resource/api/graphql",
];
let server: Server;
let origin: string;
beforeAll(async () => {
  server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const load = routes.get(new URL(request.url).pathname);
      const route = load ? await load() : undefined;
      const handler =
        route?.[request.method === "HEAD" ? "GET" : request.method];
      const response = handler
        ? await handler({ request } as RequestEvent)
        : new Response(null, { status: 404 });
      await setResponse(outgoing, response);
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  origin = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("APP_PUBLIC_ORIGIN", origin);
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  vi.unstubAllEnvs();
});

it("oauth.canonical-discovery-paths", async () => {
  expect([...routes.keys()].sort()).toEqual([...metadataPaths].sort());
  for (const path of metadataPaths) {
    const response = await fetch(`${origin}${path}`, { redirect: "manual" });
    expect(response.status, path).toBe(200);
    const body = await response.json();
    if (path.includes("oauth-protected-resource"))
      expect(body.resource).toBe(
        `${origin}${path.endsWith("graphql") ? "/api/graphql" : "/api/mcp"}`,
      );
    else expect(body.issuer).toBe(`${origin}/api/auth`);
  }
  const head = await fetch(
    `${origin}/.well-known/oauth-protected-resource/api/mcp`,
    { method: "HEAD" },
  );
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  expect(head.headers.get("content-type")).toContain("application/json");
  for (const path of [
    "/.well-known/oauth-authorization-server",
    "/.well-known/openid-configuration",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-authorization-server/api/mcp",
    "/.well-known/openid-configuration/api/mcp",
    "/api/mcp/.well-known/oauth-authorization-server",
    "/api/mcp/.well-known/openid-configuration",
  ]) {
    expect(
      (await fetch(`${origin}${path}`, { redirect: "manual" })).status,
      path,
    ).toBe(404);
  }
});

it("oauth.user-delegated-grants-only", async () => {
  for (const path of metadataPaths.slice(0, 3)) {
    const response = await fetch(`${origin}${path}`);
    const body = await response.json();
    expect(body.grant_types_supported).toEqual([
      "authorization_code",
      "refresh_token",
      "urn:ietf:params:oauth:grant-type:device_code",
    ]);
    expect(body.device_authorization_endpoint).toBe(
      `${origin}/api/auth/oauth2/device-authorization`,
    );
  }
});

it("oauth.protected-resource-scope-advertisement", async () => {
  const response = await fetch(
    `${origin}/.well-known/oauth-protected-resource/api/mcp`,
  );
  const body = await response.json();
  expect(body.resource).toBe(`${origin}/api/mcp`);
  expect(body.authorization_servers).toEqual([`${origin}/api/auth`]);
  expect(body.bearer_methods_supported).toEqual(["header"]);
  expect(Object.keys(body).filter((name) => name.startsWith("dpop"))).toEqual(
    [],
  );
  expect(body.scopes_supported).toEqual(
    expect.arrayContaining([
      "account.profile:read",
      "workspace.todo:read",
      "workspace.todo:write",
      "account.client-activity:read",
    ]),
  );
  for (const scope of body.scopes_supported as string[]) {
    expect(scope).toMatch(/^[a-z][a-z.-]+:(read|write)$/);
    expect(scope).not.toMatch(/^admin:/);
  }
  expect(body.scopes_supported).not.toContain("account.client-activity:write");
  expect(body.scopes_supported).not.toContain("mcp:tools");
});

it("oauth.discovery-cors", async () => {
  for (const path of metadataPaths) {
    for (const method of ["GET", "OPTIONS"]) {
      const response = await fetch(`${origin}${path}`, {
        method,
        headers: { Origin: "https://unrelated-client.example" },
      });
      expect(response.status).toBe(method === "OPTIONS" ? 204 : 200);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "GET, OPTIONS",
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "Authorization",
      );
      await response.text();
    }
  }
});
