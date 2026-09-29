import { expect } from "@playwright/test";
import { test } from "../../../utils/owned-worker";

const metadataPaths = [
  "/.well-known/oauth-authorization-server/api/auth",
  "/api/auth/.well-known/openid-configuration",
  "/.well-known/openid-configuration/api/auth",
  "/.well-known/oauth-protected-resource/api/mcp",
  "/.well-known/oauth-protected-resource/api/graphql",
];

test.describe.configure({ mode: "parallel" });

test("oauth.canonical-discovery-paths", async ({
  isolatedWorker,
  request,
  run,
}) =>
  run(async () => {
    const origin = isolatedWorker.origin;
    for (const path of metadataPaths) {
      const response = await request.get(`${origin}${path}`, {
        maxRedirects: 0,
      });
      expect(response.status(), path).toBe(200);
      const body = await response.json();
      if (path.includes("oauth-protected-resource"))
        expect(body.resource).toBe(
          `${origin}${path.endsWith("graphql") ? "/api/graphql" : "/api/mcp"}`,
        );
      else expect(body.issuer).toBe(`${origin}/api/auth`);
    }
    const head = await request.fetch(
      `${origin}/.well-known/oauth-protected-resource/api/mcp`,
      { method: "HEAD" },
    );
    expect(head.status()).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers()["content-type"]).toContain("application/json");
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
        (await request.get(`${origin}${path}`, { maxRedirects: 0 })).status(),
        path,
      ).toBe(404);
    }
  }));
test("oauth.user-delegated-grants-only", async ({
  isolatedWorker,
  request,
  run,
}) =>
  run(async () => {
    const origin = isolatedWorker.origin;
    for (const path of metadataPaths.slice(0, 3)) {
      const response = await request.get(`${origin}${path}`);
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
  }));
test("oauth.protected-resource-scope-advertisement", async ({
  isolatedWorker,
  request,
  run,
}) =>
  run(async () => {
    const origin = isolatedWorker.origin;
    const response = await request.get(
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
    expect(body.scopes_supported).not.toContain(
      "account.client-activity:write",
    );
    expect(body.scopes_supported).not.toContain("mcp:tools");
  }));
test("oauth.discovery-cors", async ({ isolatedWorker, request, run }) =>
  run(async () => {
    const origin = isolatedWorker.origin;
    for (const path of metadataPaths) {
      for (const method of ["GET", "OPTIONS"]) {
        const response = await request.fetch(`${origin}${path}`, {
          method,
          headers: { Origin: "https://unrelated-client.example" },
        });
        expect(response.status()).toBe(method === "OPTIONS" ? 204 : 200);
        expect(response.headers()["access-control-allow-origin"]).toBe("*");
        expect(response.headers()["access-control-allow-methods"]).toBe(
          "GET, OPTIONS",
        );
        expect(response.headers()["access-control-allow-headers"]).toContain(
          "Authorization",
        );
        await response.text();
      }
    }
  }));
